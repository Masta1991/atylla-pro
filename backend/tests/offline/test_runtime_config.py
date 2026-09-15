import unittest
from types import SimpleNamespace
from unittest.mock import patch
from offline_support import app, config, TestClient
from runtime_config import ConfigurationError, REQUIRED, validate_config, validate_environment


class RuntimeConfigurationTests(unittest.TestCase):
    def settings(self):
        return SimpleNamespace(SUPABASE_URL='https://example.supabase.co',
            SUPABASE_ANON_KEY='synthetic-anon', SUPABASE_KEY='synthetic-service',
            AUTH_SESSION_SECRET='synthetic-session-secret-at-least-32')

    def test_each_required_variable_is_enforced_without_disclosing_values(self):
        for external, attr in REQUIRED.items():
            with self.subTest(variable=external):
                settings=self.settings();setattr(settings, attr, '  ')
                with self.assertRaises(ConfigurationError) as caught:
                    validate_config(settings)
                self.assertIn(external, str(caught.exception))
                self.assertNotIn('synthetic-service', str(caught.exception))

    def test_missing_url_prevents_server_start(self):
        with patch.object(config, 'SUPABASE_URL', ''):
            with self.assertRaisesRegex(ConfigurationError, 'SUPABASE_URL'):
                with TestClient(app):
                    self.fail('Server must not start without its database URL')

    def test_health_is_unavailable_when_config_is_incomplete(self):
        with patch.object(config, 'SUPABASE_KEY', ''):
            response=TestClient(app).get('/health')
            self.assertEqual(response.status_code,503)
            self.assertEqual(response.json(),{'status':'not_ready'})

    def test_valid_settings_allow_start_and_health(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/health').status_code,200)

    def test_deployment_environment_cannot_fall_back_to_local_dotenv(self):
        with self.assertRaisesRegex(ConfigurationError, 'SUPABASE_URL'):
            validate_environment({})

    def test_invalid_url_and_short_secret_are_rejected(self):
        for value in ['not-a-url','https://secret@example.supabase.co','https://example.supabase.co/?token=secret','http://example.supabase.co']:
            settings=self.settings();settings.SUPABASE_URL=value
            with self.assertRaises(ConfigurationError) as caught:
                validate_config(settings)
            self.assertNotIn(value,str(caught.exception))
        settings=self.settings();settings.AUTH_SESSION_SECRET='short'
        with self.assertRaisesRegex(ConfigurationError, '32'):
            validate_config(settings)

    def test_missing_optional_static_files_are_404(self):
        with patch('main.os.path.isfile',return_value=False):
            client=TestClient(app)
            for path in ['/sw.js','/favicon.ico','/manifest.json']:
                self.assertEqual(client.get(path).status_code,404)
