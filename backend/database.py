from supabase import create_client, Client
from fastapi import Request, HTTPException
from config import SUPABASE_URL, SUPABASE_KEY

_supabase: Client = None


def get_supabase() -> Client:
    """Service-role client — bypasses RLS. Use for admin operations ONLY (email, etc.)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def get_user_supabase(request: Request) -> tuple[Client, str]:
    """
    User-scoped Supabase client — respects RLS policies.
    Extracts JWT from Authorization header, returns (client, user_id).
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = auth.removeprefix("Bearer ")
    try:
        client = create_client(SUPABASE_URL, token)
        user = client.auth.get_user()
        return client, user.user.id
    except Exception as e:
        raise HTTPException(401, f"Invalid or expired token: {str(e)}")
