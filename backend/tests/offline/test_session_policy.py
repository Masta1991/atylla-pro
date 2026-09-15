"""72-hour inactivity acceptance with a controlled clock and no network."""
import types
import asyncio
import unittest
from unittest.mock import Mock, patch, mock_open
from offline_support import UID, CID, app, TestClient, HTTPException
import database
import session_policy as policy
from routers import auth
from postgrest.exceptions import APIError
from main import global_exception_handler


class SessionPolicyTests(unittest.TestCase):
    def setUp(self):
        self.clock = patch.object(policy.time, 'time', return_value=1800000000)
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)
        self.api = TestClient(app)
        self.lease = policy.issue_lease(UID)

    def test_exactly_72_hours_and_boundary(self):
        self.assertEqual(self.lease['idle_expires_at'], 1800259200)
        self.now.return_value += policy.IDLE_SECONDS - 1
        self.assertEqual(policy.verify_lease(self.lease['idle_token'])['sub'], UID)
        self.now.return_value += 1
        with self.assertRaises(HTTPException) as exc:
            policy.verify_lease(self.lease['idle_token'])
        self.assertEqual(exc.exception.detail['code'], 'idle_session_expired')

    def test_activity_after_two_days_extends_another_three(self):
        self.now.return_value += 2 * 86400
        fake = Mock()
        fake.auth.get_user.return_value = types.SimpleNamespace(user=types.SimpleNamespace(id=UID))
        with patch.object(database, 'create_client', return_value=fake):
            res = self.api.post('/auth/activity', headers={
                'Authorization': 'Bearer synthetic', 'X-Atylla-Session': self.lease['idle_token']})
        self.assertEqual(res.status_code, 200, res.text)
        renewed = res.json()
        self.assertEqual(renewed['session_id'], self.lease['session_id'])
        self.assertEqual(renewed['idle_expires_at'], 1800000000 + 5 * 86400)
        self.now.return_value = 1800000000 + 4 * 86400
        self.assertEqual(policy.verify_lease(renewed['idle_token'])['sub'], UID)
        with self.assertRaises(HTTPException):
            policy.verify_lease(self.lease['idle_token'])

    def test_expired_activity_and_refresh_cannot_revive_session(self):
        self.now.return_value += policy.IDLE_SECONDS
        with patch.object(auth, 'create_client') as auth_factory, patch.object(database, 'create_client') as db_factory:
            refresh = self.api.post('/auth/refresh', json={'refresh_token': 'synthetic', 'idle_token': self.lease['idle_token']})
            activity = self.api.post('/auth/activity', headers={'Authorization': 'Bearer synthetic', 'X-Atylla-Session': self.lease['idle_token']})
        self.assertEqual(refresh.status_code, 401)
        self.assertEqual(activity.status_code, 401)
        auth_factory.assert_not_called()
        db_factory.assert_not_called()

    def test_refresh_rotates_without_extending_inactivity(self):
        self.now.return_value += 2 * 86400
        fake = Mock()
        fake.auth.refresh_session.return_value = types.SimpleNamespace(
            session=types.SimpleNamespace(access_token='new', refresh_token='next'),
            user=types.SimpleNamespace(id=UID))
        with patch.object(auth, 'create_client', return_value=fake):
            res = self.api.post('/auth/refresh', json={'refresh_token': 'synthetic', 'idle_token': self.lease['idle_token']})
        self.assertEqual(res.json(), {'access_token': 'new', 'refresh_token': 'next'})
        self.assertEqual(policy.verify_lease(self.lease['idle_token'])['exp'], self.lease['idle_expires_at'])

    def test_lease_cannot_be_used_with_another_user(self):
        fake = Mock()
        fake.auth.get_user.return_value = types.SimpleNamespace(user=types.SimpleNamespace(id=CID))
        with patch.object(database, 'create_client', return_value=fake):
            res = self.api.post('/auth/activity', headers={'Authorization': 'Bearer other', 'X-Atylla-Session': self.lease['idle_token']})
        self.assertEqual(res.status_code, 401)
        fake.table.assert_not_called()

    def test_tampering_missing_and_malformed_fail_closed(self):
        for token in [None, '', 'x.y', 'é.x', self.lease['idle_token'] + 'x', 'x' * 4097]:
            with self.subTest(token=str(token)[:10]), self.assertRaises(HTTPException) as exc:
                policy.verify_lease(token)
            self.assertEqual(exc.exception.status_code, 401)

    def test_legacy_refresh_requires_one_login(self):
        with patch.object(auth, 'create_client') as factory:
            res = self.api.post('/auth/refresh', json={'refresh_token': 'legacy'})
        self.assertEqual(res.status_code, 401)
        factory.assert_not_called()

    def test_sdk_cannot_rotate_tokens_in_background(self):
        options = database._http1_options()
        self.addCleanup(options.httpx_client.close)
        self.assertFalse(options.auto_refresh_token)
        self.assertFalse(options.persist_session)

    def test_login_issues_signed_lease(self):
        fake = Mock()
        fake.auth.sign_in_with_password.return_value = types.SimpleNamespace(
            user=types.SimpleNamespace(id=UID), session=types.SimpleNamespace(access_token='access', refresh_token='refresh'))
        fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{'id': UID}]
        with patch.object(auth, 'create_client', return_value=fake):
            res = self.api.post('/auth/login', json={'email': 'qa@example.invalid', 'password': 'synthetic'})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(policy.verify_lease(res.json()['idle_token'])['sub'], UID)
        self.assertEqual(res.json()['idle_timeout_seconds'], 259200)

    def test_server_jwt_configuration_error_is_not_session_expiry(self):
        error = APIError(dict(code='PGRST300',message='JWT secret missing',details='',hint=''))
        with patch('builtins.open',mock_open()):
            result = asyncio.run(global_exception_handler(None,error))
        self.assertEqual(result.status_code,500)

    def test_only_actual_invalid_jwt_codes_are_mapped_to_401(self):
        for code in ['PGRST301','PGRST303']:
            error = APIError(dict(code=code,message='invalid JWT',details='',hint=''))
            result = asyncio.run(global_exception_handler(None,error))
            self.assertEqual(result.status_code,401)
        with patch('builtins.open',mock_open()):
            result = asyncio.run(global_exception_handler(None,RuntimeError('JWT unrelated failure')))
        self.assertEqual(result.status_code,500)
