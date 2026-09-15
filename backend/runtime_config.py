"""Required server configuration. Diagnostics contain names, never secret values."""
import os
from types import SimpleNamespace
from urllib.parse import urlsplit

REQUIRED = {
    'SUPABASE_URL': 'SUPABASE_URL',
    'SUPABASE_ANON_KEY': 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY': 'SUPABASE_KEY',
    'AUTH_SESSION_SECRET': 'AUTH_SESSION_SECRET',
}


class ConfigurationError(RuntimeError):
    pass


def validate_config(settings):
    missing = [name for name, attr in REQUIRED.items()
               if not str(getattr(settings, attr, '') or '').strip()]
    if missing:
        raise ConfigurationError('Missing required server variables: ' + ', '.join(missing))
    try:
        url = urlsplit(settings.SUPABASE_URL)
        valid_url = (url.scheme == 'https' and bool(url.hostname)
                     or url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1'))
        valid_url = valid_url and not (url.username or url.password or url.query or url.fragment)
        valid_url = valid_url and url.path in ('', '/') and 'your-project' not in url.netloc
    except ValueError:
        valid_url = False
    if not valid_url:
        raise ConfigurationError('Invalid server variable: SUPABASE_URL')
    if len(settings.AUTH_SESSION_SECRET.strip()) < 32:
        raise ConfigurationError('AUTH_SESSION_SECRET must contain at least 32 characters')


def validate_environment(environ):
    # Deliberately does not load .env: deployment must validate Railway variables.
    validate_config(SimpleNamespace(**{attr: environ.get(name, '') for name, attr in REQUIRED.items()}))


if __name__ == '__main__':
    try:
        validate_environment(os.environ)
    except ConfigurationError as error:
        raise SystemExit(str(error))
    print('Required server configuration: OK')
