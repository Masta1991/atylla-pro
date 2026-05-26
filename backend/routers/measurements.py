from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_supabase
from models import MeasurementCreate, MeasurementUpdate, MeasurementResponse

router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.get("/", response_model=List[MeasurementResponse])
def list_measurements(
    client_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    supabase = get_supabase()
    query = supabase.table("measurements").select("*")

    if client_id:
        query = query.eq("client_id", client_id)
    if date_from:
        query = query.gte("measure_date", date_from)
    if date_to:
        query = query.lte("measure_date", date_to)

    res = query.order("measure_date").execute()
    return res.data or []


@router.get("/{measurement_id}", response_model=MeasurementResponse)
def get_measurement(measurement_id: str):
    supabase = get_supabase()
    res = supabase.table("measurements").select("*").eq("id", measurement_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Measurement not found")
    return res.data


@router.post("/", response_model=MeasurementResponse, status_code=201)
def create_measurement(data: MeasurementCreate):
    supabase = get_supabase()
    payload = data.model_dump(exclude_none=True, mode='json')
    res = supabase.table("measurements").insert(payload).execute()
    return res.data[0]


@router.put("/{measurement_id}", response_model=MeasurementResponse)
def update_measurement(measurement_id: str, data: MeasurementUpdate):
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
    payload["updated_at"] = "now()"

    res = supabase.table("measurements").update(payload).eq("id", measurement_id).execute()
    if not res.data:
        raise HTTPException(404, "Measurement not found")
    return res.data[0]


@router.delete("/{measurement_id}")
def delete_measurement(measurement_id: str):
    supabase = get_supabase()
    supabase.table("measurements").delete().eq("id", measurement_id).execute()
    return {"status": "deleted"}
