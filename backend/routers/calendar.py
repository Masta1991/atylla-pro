from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import date as DateType
from database import get_supabase
from models import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    CalendarSwapRequest,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/", response_model=List[CalendarEventResponse])
def list_events(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
):
    supabase = get_supabase()
    query = supabase.table("calendar_events").select("*, clients(name), workout_types(name)")

    if date_from:
        query = query.gte("event_date", date_from)
    if date_to:
        query = query.lte("event_date", date_to)
    if client_id:
        query = query.eq("client_id", client_id)

    res = query.neq("status", "deleted").order("event_date,event_hour").execute()
    return res.data or []


@router.get("/week/{monday_date}", response_model=List[CalendarEventResponse])
def get_week_events(monday_date: str):
    """Get events from Monday to Saturday of a given week."""
    from datetime import datetime, timedelta
    monday = datetime.strptime(monday_date, "%Y-%m-%d").date()
    saturday = monday + timedelta(days=5)

    supabase = get_supabase()
    res = (
        supabase.table("calendar_events")
        .select("*, clients(name), workout_types(name)")
        .gte("event_date", monday.isoformat())
        .lte("event_date", saturday.isoformat())
        .neq("status", "deleted")
        .order("event_date,event_hour")
        .execute()
    )
    return res.data or []


@router.get("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def get_event(event_date: str, event_hour: int):
    supabase = get_supabase()
    res = (
        supabase.table("calendar_events")
        .select("*, clients(name), workout_types(name)")
        .eq("event_date", event_date)
        .eq("event_hour", event_hour)
        .neq("status", "deleted")
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Event not found")
    return res.data


@router.post("/", response_model=CalendarEventResponse, status_code=201)
def create_or_update_event(data: CalendarEventCreate):
    """Upsert: create or replace calendar event."""
    supabase = get_supabase()
    payload = data.model_dump(exclude_none=True, mode='json')

    try:
        res = supabase.table("calendar_events").upsert(
            payload, on_conflict="event_date,event_hour"
        ).execute()
        return res.data[0]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=repr(e))


@router.put("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def update_event(event_date: str, event_hour: int, data: CalendarEventUpdate):
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump(exclude_none=True).items() if v is not None}
    payload["updated_at"] = "now()"

    res = (
        supabase.table("calendar_events")
        .update(payload)
        .eq("event_date", event_date)
        .eq("event_hour", event_hour)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Event not found")
    return res.data[0]


@router.post("/swap")
def swap_events(data: CalendarSwapRequest):
    """Swap two calendar events (drag-and-drop)."""
    supabase = get_supabase()

    # Fetch both events
    res1 = supabase.table("calendar_events").select("*").eq("event_date", data.date1.isoformat()).eq("event_hour", data.hour1).execute()
    res2 = supabase.table("calendar_events").select("*").eq("event_date", data.date2.isoformat()).eq("event_hour", data.hour2).execute()

    ev1_data = res1.data[0] if res1.data else None
    ev2_data = res2.data[0] if res2.data else None

    if not ev1_data and not ev2_data:
        raise HTTPException(404, "No events to swap")

    # Swap: move ev1 to slot2, ev2 to slot1
    if ev1_data:
        supabase.table("calendar_events").upsert({
            "event_date": data.date2.isoformat(),
            "event_hour": data.hour2,
            "client_id": ev1_data.get("client_id"),
            "workout_type_id": ev1_data.get("workout_type_id"),
            "status": "active",
        }, on_conflict="event_date,event_hour").execute()

    if ev2_data:
        supabase.table("calendar_events").upsert({
            "event_date": data.date1.isoformat(),
            "event_hour": data.hour1,
            "client_id": ev2_data.get("client_id"),
            "workout_type_id": ev2_data.get("workout_type_id"),
            "status": "active",
        }, on_conflict="event_date,event_hour").execute()

    # If one slot was empty, delete the original
    if not ev1_data:
        supabase.table("calendar_events").delete().eq("event_date", data.date2.isoformat()).eq("event_hour", data.hour2).execute()
    if not ev2_data:
        supabase.table("calendar_events").delete().eq("event_date", data.date1.isoformat()).eq("event_hour", data.hour1).execute()

    return {"status": "swapped"}


@router.delete("/{event_date}/{event_hour}")
def delete_event(event_date: str, event_hour: int):
    """Soft-delete: set status='deleted' and log to deleted_workouts."""
    supabase = get_supabase()

    ev = supabase.table("calendar_events").select("*,clients(name),workout_types(name)").eq("event_date", event_date).eq("event_hour", event_hour).single().execute()

    if ev.data:
        supabase.table("deleted_workouts").insert({
            "event_date": event_date,
            "event_hour": event_hour,
            "client_name": ev.data.get("clients", {}).get("name") if isinstance(ev.data.get("clients"), dict) else None,
            "workout_type": ev.data.get("workout_types", {}).get("name") if isinstance(ev.data.get("workout_types"), dict) else None,
        }).execute()

    # Soft delete
    supabase.table("calendar_events").update({"status": "deleted", "updated_at": "now()"}).eq("event_date", event_date).eq("event_hour", event_hour).execute()

    return {"status": "deleted"}


@router.delete("/events/{event_date}/{event_hour}/hard")
def hard_delete_event(event_date: str, event_hour: int):
    """Hard delete (remove row entirely)."""
    supabase = get_supabase()
    supabase.table("calendar_events").delete().eq("event_date", event_date).eq("event_hour", event_hour).execute()
    return {"status": "deleted"}
