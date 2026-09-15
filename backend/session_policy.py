"""Signed application inactivity lease, independent of Supabase JWT rotation.

Only login and explicit foreground user activity issue a new 72-hour deadline.
An access/refresh exchange never extends it. No database migration is required.
"""
import base64
import hashlib
import hmac
import json
import time
from uuid import UUID, uuid4
from fastapi import HTTPException
import config

IDLE_SECONDS = 3 * 24 * 60 * 60


def _key():
    secret = getattr(config, 'AUTH_SESSION_SECRET', '') or config.SUPABASE_KEY
    if not secret:
        raise HTTPException(503, 'Usługa sesji chwilowo niedostępna.')
    return hmac.new(secret.encode(), b'atylla/session-idle/v1', hashlib.sha256).digest()


def _encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')


def _expired():
    return HTTPException(401, detail={
        'code': 'idle_session_expired',
        'message': 'Sesja wygasła po 3 dniach bez aktywności. Zaloguj się ponownie.',
    })


def verify_lease(token):
    if not isinstance(token, str) or len(token) > 4096:
        raise _expired()
    try:
        payload, signature = token.split('.')
        expected = _encode(hmac.new(_key(), payload.encode('ascii'), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError('signature')
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        UUID(claims['sub']); UUID(claims['sid'])
        if claims['v'] != 1 or not isinstance(claims['iat'], int) or not isinstance(claims['exp'], int):
            raise ValueError('claims')
        if claims['exp'] - claims['iat'] != IDLE_SECONDS or claims['iat'] > time.time() + 60 or time.time() >= claims['exp']:
            raise ValueError('expired')
        return claims
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise _expired() from None


def issue_lease(user_id, session_id=None):
    now = int(time.time())
    claims = dict(v=1, sub=str(UUID(str(user_id))), sid=str(UUID(session_id)) if session_id else str(uuid4()),
                  iat=now, exp=now + IDLE_SECONDS)
    payload = _encode(json.dumps(claims, separators=(',', ':'), sort_keys=True).encode())
    signature = _encode(hmac.new(_key(), payload.encode(), hashlib.sha256).digest())
    return dict(idle_token=payload + '.' + signature, idle_expires_at=claims['exp'],
                session_id=claims['sid'], idle_timeout_seconds=IDLE_SECONDS)
