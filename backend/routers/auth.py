from fastapi import APIRouter, HTTPException
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_KEY
from models import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def seed_new_trainer(trainer_id: str):
    """
    Seed workout types, muscle groups, and exercises for a new trainer.
    Uses service_role to bypass RLS (RLS only allows trainer_id = auth.uid(),
    but there's no row yet for this new trainer).
    """
    admin = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Create trainer profile
    admin.table("trainer_profiles").insert({
        "id": trainer_id,
        "name": "",
    }).execute()

    # Seed workout types
    for name in ["Push", "Pull", "FBW"]:
        admin.table("workout_types").insert({
            "name": name,
            "trainer_id": trainer_id,
        }).execute()

    # Seed muscle groups
    groups = {}
    for name in ["KLATKA PIERSIOWA", "PLECY", "NOGI", "BARKI"]:
        res = admin.table("muscle_groups").insert({
            "name": name,
            "trainer_id": trainer_id,
        }).execute()
        groups[name] = res.data[0]["id"]

    # Seed exercises
    exercises_map = {
        "KLATKA PIERSIOWA": [
            "Wyciskanie sztangi na ławce płaskiej",
            "Wyciskanie sztangielek na ławce płaskiej",
            "Rozpiętki ze sztangielkami",
            "Pompki",
        ],
        "PLECY": [
            "Martwy ciąg",
            "Podciąganie na drążku",
            "Wiosłowanie sztangą",
            "Ściąganie drążka wyciągu górnego",
        ],
        "NOGI": [
            "Przysiady ze sztangą",
            "Prostowanie nóg na maszynie",
            "Uginanie nóg na maszynie",
            "Wykroki ze sztangielkami",
        ],
        "BARKI": [
            "Wyciskanie sztangi nad głowę",
            "Wyciskanie sztangielek siedząc",
            "Unoszenie sztangielek bokiem",
            "Arnoldki",
        ],
    }
    for group_name, exercises in exercises_map.items():
        mg_id = groups[group_name]
        for ex_name in exercises:
            admin.table("exercises").insert({
                "muscle_group_id": mg_id,
                "name": ex_name,
                "unit": "KG",
                "trainer_id": trainer_id,
            }).execute()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest):
    """Login trainer via Supabase Auth. Auto-seeds data for new trainers."""
    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        res = auth_client.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password,
        })
        user_id = res.user.id

        # Check if this is a new trainer (no trainer_profiles entry)
        admin = create_client(SUPABASE_URL, SUPABASE_KEY)
        profile = admin.table("trainer_profiles").select("id").eq("id", user_id).execute()
        if not profile.data:
            seed_new_trainer(user_id)

        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user_id": user_id,
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
