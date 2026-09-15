from supabase import create_client, Client
from fastapi import Request, HTTPException
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY
import time
import httpx
from supabase_auth.errors import AuthApiError, AuthRetryableError
from session_policy import verify_lease

_supabase: Client = None


def _http1_options():
    """Wymuś HTTP/1.1 do Supabase. postgrest-py domyślnie stawia http2=True,
    a brzeg Supabase zrywa strumienie h2 (RemoteProtocolError ConnectionTerminated
    → puste ekrany na prodzie). Timeout jak fabryczny postgrest (120 s)."""
    from supabase.lib.client_options import SyncClientOptions
    return SyncClientOptions(httpx_client=httpx.Client(http2=False, timeout=120.0),
                             auto_refresh_token=False, persist_session=False)


def get_supabase() -> Client:
    """Service-role client — bypasses RLS. Use for admin operations ONLY (email, etc.)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=_http1_options())
    return _supabase


def utcnow_iso():
    """Znacznik czasu do kolumn updated_at. NIE używać stringu "now()"
    (Postgres odrzuca go jako timestamptz → ciche 500 w update)."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


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
    token = auth.removeprefix("Bearer ").strip()
    if not token or len(token) > 16384:
        raise HTTPException(401, "Invalid token")
    lease = verify_lease(request.headers.get('X-Atylla-Session'))
    try:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options=_http1_options())
        # Verify with Auth before any side effect (email has no RLS query).
        # Never derive authority from an unverified JWT payload.
        verified = client.auth.get_user(token)
        if not verified or not verified.user or not verified.user.id:
            raise HTTPException(401, "Invalid or expired token")
        if str(verified.user.id) != lease['sub']:
            raise HTTPException(401, 'Sesja nie należy do tego użytkownika.')
        client.postgrest.auth(token)
        return client, str(verified.user.id)
    except HTTPException:
        raise
    except (httpx.TransportError, AuthRetryableError):
        raise HTTPException(503, "Usługa logowania chwilowo niedostępna. Spróbuj ponownie.")
    except AuthApiError as exc:
        if exc.status >= 500:
            raise HTTPException(503, "Usługa logowania chwilowo niedostępna. Spróbuj ponownie.")
        raise HTTPException(401, "Invalid or expired token")


def atomic_rpc(client, name: str, payload: dict):
    """One database transaction. Never retry writes or fall back to DELETE.

    Versioned RPC names prevent calling the unsafe pre-audit migration.
    A transport error may mean the commit succeeded: the caller must reload.
    """
    from postgrest.exceptions import APIError
    try:
        result = client.rpc(name, payload).execute()
        if result.data is None:
            raise HTTPException(502, "Brak potwierdzenia zapisu. Odśwież dane przed kolejną próbą.")
        return result.data
    except httpx.TransportError:
        raise HTTPException(502, "Nie udało się potwierdzić zapisu. Odśwież dane przed kolejną próbą.")
    except APIError as exc:
        code = str(exc.code)
        if code == 'P0001' and exc.message == 'DUPLICATE_SESSION_CONFIRMATION_REQUIRED':
            raise HTTPException(409, {'code': 'duplicate_session', 'message':
                'Trening dla tego klienta jest już zarejestrowany tego dnia. Dodać kolejny?'})
        if code in {"PGRST202", "42883"}:
            raise HTTPException(503, "Bezpieczny zapis wymaga aktualizacji bazy. Operacja niedostępna.")
        if code == "42501":
            raise HTTPException(403, "Brak uprawnień do wskazanych danych.")
        if code in {"23503", "23505", "23514", "22023", "P0001", "22P02"}:
            # SQL raises only controlled domain text for P0001; never expose DB internals.
            detail = exc.message if code == "P0001" else "Dane są nieprawidłowe lub kolidują z istniejącym zapisem."
            raise HTTPException(409, detail)
        raise HTTPException(500, "Nie udało się zapisać zmian.")
