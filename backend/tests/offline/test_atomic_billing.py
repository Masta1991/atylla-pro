"""API contract for atomic billing. Real SQL behavior is tested in PGlite."""
import unittest
from unittest.mock import Mock, patch
import httpx
from postgrest.exceptions import APIError
from offline_support import clients, UID, CID, NOW, HTTPException, TestClient, app


class AtomicBillingTests(unittest.TestCase):
    def invoke(self, action):
        if action == 'close':
            return clients.close_client_cycle(CID, clients.CloseCycleRequest(
                end_date='2026-09-02', expected_updated_at=NOW), None)
        return clients.hard_reset_client(CID, clients.BillingVersionRequest(
            expected_updated_at=NOW), None)

    def test_single_rpc_without_followup_read_or_rest_write(self):
        for action in ('close', 'reset'):
            db = Mock()
            db.rpc.return_value.execute.return_value.data = {'id': CID}
            with patch.object(clients, 'get_user_supabase', return_value=(db, UID)):
                self.assertEqual(self.invoke(action), {'id': CID})
            db.table.assert_not_called()
            db.rpc.assert_called_once()
            name, payload = db.rpc.call_args.args
            self.assertEqual(name, 'billing_cycle_v1')
            self.assertEqual(payload['p_action'], action)
            self.assertEqual(payload['p_client_id'], CID)
            self.assertEqual(payload['p_expected_updated_at'], '2026-09-13T00:00:00+00:00')

    def test_read_failure_missing_migration_conflict_and_unknown_commit_abort(self):
        for action in ('close', 'reset'):
            for error, status in [
                (APIError(dict(code='XX000', message='injected read failure')), 500),
                (APIError(dict(code='PGRST202', message='missing migration')), 503),
                (APIError(dict(code='P0001', message='changed')), 409),
                (APIError(dict(code='42501', message='foreign user')), 403),
                (httpx.ReadTimeout('unknown commit'), 502),
            ]:
                with self.subTest(action=action, status=status):
                    db = Mock()
                    db.rpc.return_value.execute.side_effect = error
                    with patch.object(clients, 'get_user_supabase', return_value=(db, UID)), self.assertRaises(HTTPException) as ctx:
                        self.invoke(action)
                    self.assertEqual(ctx.exception.status_code, status)
                    db.table.assert_not_called()
                    db.rpc.assert_called_once()

    def test_old_client_cannot_write_without_reviewed_version(self):
        with TestClient(app) as api, patch.object(clients, 'get_user_supabase') as auth:
            self.assertEqual(api.post(f'/clients/{CID}/close-cycle', json={'end_date':'2026-09-02'}).status_code, 422)
            self.assertEqual(api.post(f'/clients/{CID}/hard-reset', json={}).status_code, 422)
            auth.assert_not_called()
