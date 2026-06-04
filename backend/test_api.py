from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

class TrainingPlanBase(BaseModel):
    name: str
    workout_type_id: Optional[UUID] = None

class TrainingPlanCreate(TrainingPlanBase):
    exercise_ids: List[UUID] = Field(default_factory=list)

try:
    data = {"name": "test", "workout_type_id": "d74ff3af-96de-4f1e-bf27-18bcf5f7a95b"}
    obj = TrainingPlanCreate(**data)
    print("Success:", obj.model_dump())
except Exception as e:
    print("Error:", e)
