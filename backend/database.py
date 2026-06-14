from supabase import create_client, Client
from fastapi import Request, HTTPException
from config import SUPABASE_URL, SUPABASE_KEY
import json, base64

_supabase: Client = None


def get_supabase() -> Client:
    """Service-role client — bypasses RLS. Use for admin operations ONLY (email, etc.)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def _decode_jwt_user_id(token: str) -> str:
    """Extract user ID (sub claim) from JWT without verification."""
    try:
        payload = token.split(".")[1]
        # Add padding
        payload += "=" * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        return claims.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token format")


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
        user_id = _decode_jwt_user_id(token)
        if not user_id:
            raise HTTPException(401, "Token missing user ID")
        client = create_client(SUPABASE_URL, token)
        return client, user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Invalid or expired token: {str(e)}")
