from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# ── Clients ──────────────────────────────────────────────────────────────────

class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    join_date: Optional[date] = None
    notes: Optional[str] = None
    default_workout_type_id: Optional[UUID] = None
    default_plan_id: Optional[UUID] = None
    strength_progression: List[str] = Field(default_factory=list)
    training_schedule: List[dict] = Field(default_factory=list)
    billing_type: Optional[str] = "package"
    package_purchase_date: Optional[date] = None
    package_size: Optional[int] = 10
    package_current_count: Optional[int] = 0
    payment_history: Optional[List[dict]] = Field(default_factory=list)
    active_package_id: Optional[UUID] = None
    cancelled_settled_count: Optional[int] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    join_date: Optional[date] = None
    notes: Optional[str] = None
    phone: Optional[str] = None
    default_workout_type_id: Optional[UUID] = None
    strength_progression: Optional[List[str]] = None
    training_schedule: Optional[List[dict]] = None
    billing_type: Optional[str] = None
    package_purchase_date: Optional[date] = None
    package_size: Optional[int] = None
    package_current_count: Optional[int] = None
    payment_history: Optional[List[dict]] = None
    active_package_id: Optional[UUID] = None
    cancelled_settled_count: Optional[int] = None

class ClientResponse(ClientBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Calendar ─────────────────────────────────────────────────────────────────

class CalendarEventBase(BaseModel):
    event_date: date
    event_hour: int = Field(ge=6, le=21)
    client_id: Optional[UUID] = None
    workout_type_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    status: str = "active"
    is_settled: bool = False
    note: Optional[str] = None
    main_group: Optional[str] = None
    added_groups: Optional[List[str]] = Field(default_factory=list)
    is_replacement: bool = False
    replaced_client_id: Optional[UUID] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class ReplaceWeekRequest(BaseModel):
    monday_date: date
    events: List[CalendarEventCreate]

class CalendarEventUpdate(BaseModel):
    client_id: Optional[UUID] = None
    workout_type_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    status: Optional[str] = None
    is_settled: Optional[bool] = None
    note: Optional[str] = None
    main_group: Optional[str] = None
    added_groups: Optional[List[str]] = None
    is_replacement: Optional[bool] = None
    replaced_client_id: Optional[UUID] = None

class AdjustHistoryPackageRequest(BaseModel):
    archived_at: str
    completed_count: int
    comment: str

class StartBillingRequest(BaseModel):
    start_date: str

class EndBillingRequest(BaseModel):
    end_date: str

class CalendarSwapRequest(BaseModel):
    date1: date
    hour1: int
    date2: date
    hour2: int

class CalendarEventResponse(CalendarEventBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    default_workout_type_id: Optional[UUID] = None
    default_plan_id: Optional[UUID] = None
    training_plans: Optional[dict] = None
    workout_types: Optional[dict] = None
    clients: Optional[dict] = None
    model_config = {"from_attributes": True}


# ── Absences ─────────────────────────────────────────────────────────────────

class AbsenceBase(BaseModel):
    client_id: UUID
    absence_date: date
    absence_hour: Optional[int] = None

class AbsenceCreate(AbsenceBase):
    pass

class AbsenceResponse(AbsenceBase):
    id: UUID
    created_at: datetime
    clients: Optional[dict] = None
    model_config = {"from_attributes": True}


# ── Workout Logs ─────────────────────────────────────────────────────────────

class WorkoutLogBase(BaseModel):
    client_id: UUID
    exercise_id: UUID
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    week_number: int
    session_date: date

class WorkoutLogCreate(WorkoutLogBase):
    pass

class WorkoutLogBatch(BaseModel):
    """Batch save multiple workout logs at once"""
    client_id: UUID
    session_date: date
    week_number: int
    logs: List[WorkoutLogCreate]

class WorkoutLogResponse(WorkoutLogBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Measurements ─────────────────────────────────────────────────────────────

class MeasurementBase(BaseModel):
    client_id: UUID
    measure_date: date
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_pct: Optional[float] = None

class MeasurementCreate(MeasurementBase):
    pass

class MeasurementUpdate(BaseModel):
    measure_date: Optional[date] = None
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_pct: Optional[float] = None

class MeasurementResponse(MeasurementBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Config (Workout Types, Muscle Groups, Exercises, Plans) ──────────────────

class WorkoutTypeBase(BaseModel):
    name: str

class WorkoutTypeCreate(WorkoutTypeBase):
    pass

class WorkoutTypeResponse(WorkoutTypeBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class MuscleGroupBase(BaseModel):
    name: str

class MuscleGroupCreate(MuscleGroupBase):
    pass

class MuscleGroupResponse(MuscleGroupBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class ExerciseBase(BaseModel):
    muscle_group_id: UUID
    name: str
    unit: Optional[str] = "KG"
    sort_order: Optional[int] = 0

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    sort_order: Optional[int] = None

class ExerciseResponse(ExerciseBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class TrainingPlanBase(BaseModel):
    name: str
    workout_type_id: Optional[UUID] = None

class TrainingPlanCreate(TrainingPlanBase):
    exercise_ids: List[UUID] = Field(default_factory=list)

class TrainingPlanResponse(TrainingPlanBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}

class PlanExerciseCreate(BaseModel):
    exercise_id: UUID
    sort_order: Optional[int] = 0
    sets_data: Optional[List[dict]] = Field(default_factory=list)
    superset_id: Optional[UUID] = None

class PlanExerciseUpdate(BaseModel):
    sets_data: Optional[List[dict]] = None
    sort_order: Optional[int] = None
    superset_id: Optional[UUID] = None


# ── Packages SSOT ────────────────────────────────────────────────────────────

class ClientPackageBase(BaseModel):
    client_id: UUID
    size: int
    start_training_id: UUID
    end_training_id: Optional[UUID] = None
    offset: int = 0

class ClientPackageCreate(BaseModel):
    size: int
    start_training_id: UUID
    offset: int = 0

class ClientPackageUpdate(BaseModel):
    end_training_id: Optional[UUID] = None

class ClientPackageResponse(ClientPackageBase):
    id: UUID
    trainer_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: UUID
