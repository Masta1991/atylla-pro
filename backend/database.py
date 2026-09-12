from supabase import create_client, Client
from fastapi import Request, HTTPException
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY
import json, base64, time
import httpx

_supabase: Client = None


def _http1_options():
    """Wymuś HTTP/1.1 do Supabase. postgrest-py domyślnie stawia http2=True,
    a brzeg Supabase zrywa strumienie h2 (RemoteProtocolError ConnectionTerminated
    → puste ekrany na prodzie). Timeout jak fabryczny postgrest (120 s)."""
    from supabase.lib.client_options import SyncClientOptions
    return SyncClientOptions(httpx_client=httpx.Client(http2=False, timeout=120.0))


def get_supabase() -> Client:
    """Service-role client — bypasses RLS. Use for admin operations ONLY (email, etc.)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=_http1_options())
    return _supabase


def _decode_jwt_user_id(token: str) -> str:
    """Extract user ID (sub claim) from JWT without verification."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        return claims.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token format")


def supabase_retry(fn, attempts=3, base_delay=0.4):
    """Ponów odczyt, gdy Supabase zerwie połączenie w trakcie
    (httpcore RemoteProtocolError / timeouty). Błędy logiki i walidacji
    przechodzą od razu — ponawiamy tylko transport."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except httpx.TransportError as e:
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (2 ** i))
    raise last


def get_user_supabase(request: Request) -> tuple[Client, str]:
    """
    User-scoped Supabase client — respects RLS policies.
    Uses anon key for apikey header + user JWT for Authorization.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = auth.removeprefix("Bearer ")
    try:
        user_id = _decode_jwt_user_id(token)
        if not user_id:
            raise HTTPException(401, "Token missing user ID")
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options=_http1_options())
        client.postgrest.auth(token)
        return client, user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Invalid or expired token: {str(e)}")
