from fastapi import APIRouter, HTTPException, Request
from typing import List
from database import get_supabase, get_user_supabase
from models import (
    WorkoutTypeCreate, WorkoutTypeResponse,
    MuscleGroupCreate, MuscleGroupResponse,
    ExerciseCreate, ExerciseResponse, ExerciseUpdate,
    TrainingPlanCreate, TrainingPlanResponse,
    PlanExerciseCreate, PlanExerciseUpdate,
)

router = APIRouter(prefix="/config", tags=["config"])

# ── Workout Types ────────────────────────────────────────────────────────────

@router.get("/workout-types")
def list_workout_types(request: Request):
    supabase, _ = get_user_supabase(request)
    try:
        res = supabase.table("workout_types").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}

@router.post("/workout-types", response_model=WorkoutTypeResponse, status_code=201)
def create_workout_type(data: WorkoutTypeCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    existing = supabase.table("workout_types").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"'{data.name}' already exists")
    res = supabase.table("workout_types").insert({"name": data.name, "trainer_id": user_id}).execute()
    return res.data[0]

@router.put("/workout-types/{type_id}", response_model=WorkoutTypeResponse)
def update_workout_type(type_id: str, data: WorkoutTypeCreate, request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("workout_types").update({"name": data.name}).eq("id", type_id).execute()
    if not res.data:
        raise HTTPException(404, "Workout type not found")
    return res.data[0]

@router.delete("/workout-types/{type_id}")
def delete_workout_type(type_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("workout_types").delete().eq("id", type_id).execute()
    return {"status": "deleted"}


# ── Muscle Groups ────────────────────────────────────────────────────────────

@router.get("/muscle-groups", response_model=List[MuscleGroupResponse])
def list_muscle_groups(request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("muscle_groups").select("*").order("name").execute()
    return res.data or []

@router.post("/muscle-groups", response_model=MuscleGroupResponse, status_code=201)
def create_muscle_group(data: MuscleGroupCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    existing = supabase.table("muscle_groups").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"'{data.name}' already exists")
    res = supabase.table("muscle_groups").insert({"name": data.name, "trainer_id": user_id}).execute()
    return res.data[0]

@router.delete("/muscle-groups/{group_id}")
def delete_muscle_group(group_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("muscle_groups").delete().eq("id", group_id).execute()
    return {"status": "deleted"}


# ── Exercises ────────────────────────────────────────────────────────────────

@router.get("/exercises", response_model=List[ExerciseResponse])
def list_exercises(muscle_group_id: str = None, request: Request = None):
    supabase, _ = get_user_supabase(request)
    query = supabase.table("exercises").select("*")
    if muscle_group_id:
        query = query.eq("muscle_group_id", muscle_group_id)
    res = query.order("sort_order").order("name").execute()
    return res.data or []

@router.get("/exercises/by-group")
def list_exercises_grouped(request: Request):
    """Get exercises grouped by muscle group."""
    supabase, _ = get_user_supabase(request)
    groups = supabase.table("muscle_groups").select("*").order("name").execute()
    exercises = supabase.table("exercises").select("*").order("sort_order").order("name").execute()

    result = {}
    for g in (groups.data or []):
        result[g["name"]] = [
            {"id": e["id"], "name": e["name"], "unit": e.get("unit", "KG")}
            for e in (exercises.data or [])
            if e["muscle_group_id"] == g["id"]
        ]
    return result

@router.post("/exercises", response_model=ExerciseResponse, status_code=201)
def create_exercise(data: ExerciseCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    existing = supabase.table("exercises").select("id").eq("muscle_group_id", str(data.muscle_group_id)).eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Exercise '{data.name}' already exists in this group")
    payload = data.model_dump(mode='json')
    payload["trainer_id"] = user_id
    res = supabase.table("exercises").insert(payload).execute()
    return res.data[0]

@router.delete("/exercises/{exercise_id}")
def delete_exercise(exercise_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("exercises").delete().eq("id", exercise_id).execute()
    return {"status": "deleted"}

@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(exercise_id: str, data: ExerciseUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = data.model_dump(exclude_unset=True)
    res = supabase.table("exercises").update(payload).eq("id", exercise_id).execute()
    if not res.data:
        raise HTTPException(404, "Exercise not found")
    return res.data[0]


# ── Training Plans ───────────────────────────────────────────────────────────

@router.get("/plans", response_model=List[TrainingPlanResponse])
def list_plans(request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("training_plans").select("*").order("name").execute()
    return res.data or []

@router.get("/plans/{plan_id}/exercises")
def get_plan_exercises(plan_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    res = (
        supabase.table("plan_exercises")
        .select("*,exercises(*,muscle_groups(name))")
        .eq("plan_id", plan_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []

@router.post("/plans", response_model=TrainingPlanResponse, status_code=201)
def create_plan(data: TrainingPlanCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    existing = supabase.table("training_plans").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Plan '{data.name}' already exists")

    plan_data = {"name": data.name, "trainer_id": user_id}
    if data.workout_type_id:
        plan_data["workout_type_id"] = str(data.workout_type_id)

    plan = supabase.table("training_plans").insert(plan_data).execute()

    if data.exercise_ids:
        records = [
            {"plan_id": plan.data[0]["id"], "exercise_id": str(eid), "sort_order": i, "trainer_id": user_id}
            for i, eid in enumerate(data.exercise_ids)
        ]
        supabase.table("plan_exercises").insert(records).execute()

    return plan.data[0]

@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("training_plans").delete().eq("id", plan_id).execute()
    return {"status": "deleted"}

@router.post("/plans/{plan_id}/exercises", status_code=201)
def add_exercise_to_plan(plan_id: str, data: PlanExerciseCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    res = supabase.table("plan_exercises").insert({
        "plan_id": plan_id,
        "exercise_id": str(data.exercise_id),
        "sort_order": data.sort_order,
        "sets_data": data.sets_data,
        "trainer_id": user_id,
    }).execute()
    return res.data[0] if res.data else None

@router.put("/plan-exercises/{id}")
def update_plan_exercise(id: str, data: PlanExerciseUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
    if not payload:
        return {"status": "no update"}
    res = supabase.table("plan_exercises").update(payload).eq("id", id).execute()
    return res.data[0] if res.data else None

@router.delete("/plan-exercises/{id}")
def remove_exercise_from_plan(id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("plan_exercises").delete().eq("id", id).execute()
    return {"status": "deleted"}
