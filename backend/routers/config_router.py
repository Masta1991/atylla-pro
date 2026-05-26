from fastapi import APIRouter, HTTPException
from typing import List
from database import get_supabase
from models import (
    WorkoutTypeCreate, WorkoutTypeResponse,
    MuscleGroupCreate, MuscleGroupResponse,
    ExerciseCreate, ExerciseResponse,
    TrainingPlanCreate, TrainingPlanResponse,
)

router = APIRouter(prefix="/config", tags=["config"])

# ── Workout Types ────────────────────────────────────────────────────────────

@router.get("/workout-types")
def list_workout_types():
    supabase = get_supabase()
    try:
        res = supabase.table("workout_types").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}

@router.post("/workout-types", response_model=WorkoutTypeResponse, status_code=201)
def create_workout_type(data: WorkoutTypeCreate):
    supabase = get_supabase()
    existing = supabase.table("workout_types").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"'{data.name}' already exists")
    res = supabase.table("workout_types").insert({"name": data.name}).execute()
    return res.data[0]

@router.put("/workout-types/{type_id}", response_model=WorkoutTypeResponse)
def update_workout_type(type_id: str, data: WorkoutTypeCreate):
    supabase = get_supabase()
    res = supabase.table("workout_types").update({"name": data.name}).eq("id", type_id).execute()
    if not res.data:
        raise HTTPException(404, "Workout type not found")
    return res.data[0]

@router.delete("/workout-types/{type_id}")
def delete_workout_type(type_id: str):
    supabase = get_supabase()
    supabase.table("workout_types").delete().eq("id", type_id).execute()
    return {"status": "deleted"}


# ── Muscle Groups ────────────────────────────────────────────────────────────

@router.get("/muscle-groups", response_model=List[MuscleGroupResponse])
def list_muscle_groups():
    supabase = get_supabase()
    res = supabase.table("muscle_groups").select("*").order("name").execute()
    return res.data or []

@router.post("/muscle-groups", response_model=MuscleGroupResponse, status_code=201)
def create_muscle_group(data: MuscleGroupCreate):
    supabase = get_supabase()
    existing = supabase.table("muscle_groups").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"'{data.name}' already exists")
    res = supabase.table("muscle_groups").insert({"name": data.name}).execute()
    return res.data[0]

@router.delete("/muscle-groups/{group_id}")
def delete_muscle_group(group_id: str):
    supabase = get_supabase()
    supabase.table("muscle_groups").delete().eq("id", group_id).execute()
    return {"status": "deleted"}


# ── Exercises ────────────────────────────────────────────────────────────────

@router.get("/exercises", response_model=List[ExerciseResponse])
def list_exercises(muscle_group_id: str = None):
    supabase = get_supabase()
    query = supabase.table("exercises").select("*")
    if muscle_group_id:
        query = query.eq("muscle_group_id", muscle_group_id)
    res = query.order("name").execute()
    return res.data or []

@router.get("/exercises/by-group")
def list_exercises_grouped():
    """Get exercises grouped by muscle group."""
    supabase = get_supabase()
    groups = supabase.table("muscle_groups").select("*").order("name").execute()
    exercises = supabase.table("exercises").select("*").order("name").execute()

    result = {}
    for g in (groups.data or []):
        result[g["name"]] = [
            {"id": e["id"], "name": e["name"]}
            for e in (exercises.data or [])
            if e["muscle_group_id"] == g["id"]
        ]
    return result

@router.post("/exercises", response_model=ExerciseResponse, status_code=201)
def create_exercise(data: ExerciseCreate):
    supabase = get_supabase()
    existing = supabase.table("exercises").select("id").eq("muscle_group_id", str(data.muscle_group_id)).eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Exercise '{data.name}' already exists in this group")
    res = supabase.table("exercises").insert(data.model_dump()).execute()
    return res.data[0]

@router.delete("/exercises/{exercise_id}")
def delete_exercise(exercise_id: str):
    supabase = get_supabase()
    supabase.table("exercises").delete().eq("id", exercise_id).execute()
    return {"status": "deleted"}


# ── Training Plans ───────────────────────────────────────────────────────────

@router.get("/plans", response_model=List[TrainingPlanResponse])
def list_plans():
    supabase = get_supabase()
    res = supabase.table("training_plans").select("*").order("name").execute()
    return res.data or []

@router.get("/plans/{plan_id}/exercises")
def get_plan_exercises(plan_id: str):
    supabase = get_supabase()
    res = (
        supabase.table("plan_exercises")
        .select("*,exercises(*,muscle_groups(name))")
        .eq("plan_id", plan_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []

@router.post("/plans", response_model=TrainingPlanResponse, status_code=201)
def create_plan(data: TrainingPlanCreate):
    supabase = get_supabase()
    existing = supabase.table("training_plans").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Plan '{data.name}' already exists")

    plan = supabase.table("training_plans").insert({"name": data.name}).execute()

    if data.exercise_ids:
        records = [
            {"plan_id": plan.data[0]["id"], "exercise_id": str(eid), "sort_order": i}
            for i, eid in enumerate(data.exercise_ids)
        ]
        supabase.table("plan_exercises").insert(records).execute()

    return plan.data[0]

@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str):
    supabase = get_supabase()
    supabase.table("training_plans").delete().eq("id", plan_id).execute()
    return {"status": "deleted"}
