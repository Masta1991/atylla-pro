from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# ── Clients ──────────────────────────────────────────────────────────────────

class ClientBase(BaseModel):
    name: str
    join_date: Optional[date] = None
    notes: Optional[str] = None
    email: Optional[str] = None
    default_workout_type_id: Optional[UUID] = None
    strength_progression: List[str] = Field(default_factory=list)
    training_schedule: List[dict] = Field(default_factory=list)

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    join_date: Optional[date] = None
    notes: Optional[str] = None
    email: Optional[str] = None
    default_workout_type_id: Optional[UUID] = None
    strength_progression: Optional[List[str]] = None
    training_schedule: Optional[List[dict]] = None

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
    status: str = "active"

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventUpdate(BaseModel):
    client_id: Optional[UUID] = None
    workout_type_id: Optional[UUID] = None
    status: Optional[str] = None

class CalendarSwapRequest(BaseModel):
    date1: date
    hour1: int
    date2: date
    hour2: int

class CalendarEventResponse(CalendarEventBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    clients: Optional[dict] = None
    workout_types: Optional[dict] = None
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

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class TrainingPlanBase(BaseModel):
    name: str

class TrainingPlanCreate(TrainingPlanBase):
    exercise_ids: List[UUID] = Field(default_factory=list)

class TrainingPlanResponse(TrainingPlanBase):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: UUID
