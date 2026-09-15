from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from uuid import UUID
from database import get_supabase, get_user_supabase, utcnow_iso
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
    calendar_event_id: Optional[UUID] = Query(None),
    request: Request = None,
):
    """Filter editor logs by event; date-only queries remain aggregated history."""
    supabase, _ = get_user_supabase(request)
    query = (
        supabase.table("workout_logs")
        .select("*")
        .eq("client_id", client_id)
    )
    if session_date:
        query = query.eq("session_date", session_date)

    if calendar_event_id:
        query = query.eq("calendar_event_id", str(calendar_event_id))

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
    """Replace a session using only the audited, versioned transaction."""
    from database import atomic_rpc
    supabase, user_id = get_user_supabase(request)
    if not data.logs:
        raise HTTPException(400, "Pusty trening — zaznacz ćwiczenia przed zapisem.")
    for log in data.logs:
        if log.client_id != data.client_id or log.session_date != data.session_date:
            raise HTTPException(400, "Log must belong to the batch client and date")
    payload = {
        "p_client_id": str(data.client_id),
        "p_session_date": data.session_date.isoformat(),
        "p_week_number": data.week_number,
        "p_trainer_id": user_id,
        "p_logs": [{"exercise_id": str(log.exercise_id),
                    "weight_kg": log.weight_kg, "reps": log.reps}
                   for log in data.logs],
    }
    if data.calendar_event_id:
        payload['p_event_id'] = str(data.calendar_event_id)
        return atomic_rpc(supabase, 'save_event_workout_batch_v1', payload)
    return atomic_rpc(supabase, 'save_workout_batch_v2', payload)

@router.put("/{log_id}", response_model=WorkoutLogResponse)
def update_workout_log(log_id: str, weight_kg: Optional[float] = None, reps: Optional[int] = None, request: Request = None):
    supabase, _ = get_user_supabase(request)
    payload = {"updated_at": utcnow_iso()}
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
