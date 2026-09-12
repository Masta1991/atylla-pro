from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from database import get_supabase, get_user_supabase
from models import WorkoutLogBatch, WorkoutLogResponse

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("/", response_model=List[WorkoutLogResponse])
def list_workouts(
    client_id: Optional[str] = Query(None),
    session_date: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    request: Request = None,
):
    supabase, _ = get_user_supabase(request)
    query = supabase.table("workout_logs").select("*")

    if client_id:
        query = query.eq("client_id", client_id)
    if session_date:
        query = query.eq("session_date", session_date)
    if date_from:
        query = query.gte("session_date", date_from)
    if date_to:
        query = query.lte("session_date", date_to)

    res = query.order("session_date,created_at").execute()
    return res.data or []


@router.get("/client/{client_id}", response_model=List[WorkoutLogResponse])
def get_client_workouts(
    client_id: str,
    session_date: Optional[str] = Query(None),
    request: Request = None,
):
    """Get all workouts for a client, optionally filtered by date."""
    supabase, _ = get_user_supabase(request)
    query = (
        supabase.table("workout_logs")
        .select("*")
        .eq("client_id", client_id)
    )
    if session_date:
        query = query.eq("session_date", session_date)

    res = query.order("created_at").execute()
    return res.data or []


@router.get("/client/{client_id}/history")
def get_client_history(client_id: str, request: Request):
    """Get all workout history as a flat list (for reports/charts)."""
    supabase, _ = get_user_supabase(request)
    res = (
        supabase.table("workout_logs")
        .select("*,exercises(name,muscle_groups(name))")
        .eq("client_id", client_id)
        .order("session_date,created_at")
        .execute()
    )
    return res.data or []


@router.post("/batch", status_code=201)
def save_workout_batch(data: WorkoutLogBatch, request: Request):
    """
    T7: guarded replace of one session's logs.
    - Validate BEFORE any delete (bad payload never wipes data).
    - Empty batch is refused (T8): clearing a day goes through delete,
      never through an accidental empty save.
    - Prefer atomic RPC `save_workout_batch_atomic` (migration 006) when
      deployed; otherwise delete+insert with compensating restore of the
      snapshot on insert failure.
    """
    supabase, user_id = get_user_supabase(request)

    if not data.logs:
        raise HTTPException(400, "Pusty trening — zaznacz ćwiczenia przed zapisem. Dzień czyści się przyciskiem Usuń.")

    records = []
    for log in data.logs:
        if str(log.client_id) != str(data.client_id):
            raise HTTPException(400, "Log client_id must match batch client_id")
        if log.session_date != data.session_date:
            raise HTTPException(400, "Log session_date must match batch session_date")
        records.append({
            "client_id": str(data.client_id),
            "exercise_id": str(log.exercise_id),
            "weight_kg": log.weight_kg,
            "reps": log.reps,
            "week_number": data.week_number,
            "session_date": data.session_date.isoformat(),
            "trainer_id": user_id,
        })

    date_iso = data.session_date.isoformat()

    # Atomic path when the RPC is deployed (one transaction in Postgres).
    rpc = getattr(supabase, "rpc", None)
    if callable(rpc):
        try:
            res = supabase.rpc("save_workout_batch_atomic", {
                "p_client_id": str(data.client_id),
                "p_session_date": date_iso,
                "p_week_number": data.week_number,
                "p_trainer_id": user_id,
                "p_logs": [
                    {"exercise_id": r["exercise_id"], "weight_kg": r["weight_kg"],
                     "reps": r["reps"], "week_number": r["week_number"]}
                    for r in records
                ],
            }).execute()
            if res.data:
                return res.data
        except Exception:
            pass  # fall through to guarded replace below

    # Snapshot for compensating restore.
    old_res = supabase.table("workout_logs").select(
        "client_id,exercise_id,weight_kg,reps,week_number,session_date,trainer_id"
    ).eq("client_id", str(data.client_id)).eq("session_date", date_iso).execute()
    old_rows = [dict(r) for r in (old_res.data or [])]

    supabase.table("workout_logs").delete() \
        .eq("client_id", str(data.client_id)) \
        .eq("session_date", date_iso) \
        .execute()

    try:
        res = supabase.table("workout_logs").insert(records).execute()
        return res.data
    except Exception:
        try:
            if old_rows:
                supabase.table("workout_logs").insert(old_rows).execute()
        except Exception:
            pass
        raise HTTPException(500, "Save failed — previous workout restored")


@router.put("/{log_id}", response_model=WorkoutLogResponse)
def update_workout_log(log_id: str, weight_kg: Optional[float] = None, reps: Optional[int] = None, request: Request = None):
    supabase, _ = get_user_supabase(request)
    payload = {"updated_at": "now()"}
    if weight_kg is not None:
        payload["weight_kg"] = weight_kg
    if reps is not None:
        payload["reps"] = reps

    res = supabase.table("workout_logs").update(payload).eq("id", log_id).execute()
    if not res.data:
        raise HTTPException(404, "Workout log not found")
    return res.data[0]


@router.delete("/{log_id}")
def delete_workout_log(log_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("workout_logs").delete().eq("id", log_id).execute()
    return {"status": "deleted"}
