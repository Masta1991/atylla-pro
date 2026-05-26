from fastapi import APIRouter, HTTPException
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_ANON_KEY
from models import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest):
    """Login trainer via Supabase Auth."""
    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        res = auth_client.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password,
        })
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user_id": res.user.id,
        }
    except Exception as e:
        raise HTTPException(401, f"Login failed: {str(e)}")


@router.post("/refresh")
def refresh_token(refresh_token: str):
    """Refresh the access token."""
    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        res = auth_client.auth.refresh_session(refresh_token)
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
        }
    except Exception as e:
        raise HTTPException(401, f"Token refresh failed: {str(e)}")
