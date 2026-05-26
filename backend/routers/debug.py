from fastapi import APIRouter
from models import CalendarEventResponse
router = APIRouter()
@router.get("/debug_model")
def debug_model():
    return list(CalendarEventResponse.model_fields.keys())
