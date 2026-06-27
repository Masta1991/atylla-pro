from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from datetime import date as DateType
from database import get_supabase, get_user_supabase
from models import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    CalendarSwapRequest, AbsenceCreate, AbsenceResponse, ReplaceWeekRequest
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


# ── Absences ─────────────────────────────────────────────────────────────────

@router.get("/absences", response_model=List[AbsenceResponse])
def get_absences(date_from: Optional[str] = Query(None), request: Request = None):
    supabase, _ = get_user_supabase(request)
    query = supabase.table("absences").select("*, clients(name)").order("absence_date", desc=True)
    if date_from:
        query = query.gte("absence_date", date_from)
    res = query.execute()
    return res.data or []

@router.post("/absences", response_model=AbsenceResponse, status_code=201)
def create_absence(data: AbsenceCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    payload = data.model_dump(mode='json')
    payload["trainer_id"] = user_id
    on_conflict = "client_id,absence_date"
    if data.absence_hour is not None:
        on_conflict = "client_id,absence_date,absence_hour"
    res = supabase.table("absences").upsert(
        payload, on_conflict=on_conflict
    ).execute()

    # Cancel (soft-delete) any existing events on that day/hour for this client
    query = supabase.table("calendar_events").update({
        "status": "deleted", 
        "updated_at": "now()"
    }).eq("client_id", data.client_id).eq("event_date", data.absence_date.isoformat())
    
    if data.absence_hour is not None:
        query = query.eq("event_hour", data.absence_hour)
    query.execute()

    return res.data[0]

@router.delete("/absences/{absence_id}")
def delete_absence(absence_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("absences").delete().eq("id", absence_id).execute()
    return {"status": "deleted"}


# ── Calendar Events ──────────────────────────────────────────────────────────


def assign_chronological_numbers(events, supabase):
    client_ids = list(set([
        ev["client_id"] for ev in events
        if ev.get("client_id") and ev.get("clients") and ev["clients"].get("billing_type") != "package"
    ]))
    
    if not client_ids:
        return events
        
    all_events_res = supabase.table("calendar_events") \
        .select("id, client_id, event_date, event_hour") \
        .in_("client_id", client_ids) \
        .neq("status", "deleted") \
        .order("event_date") \
        .order("event_hour") \
        .execute()
        
    event_order = {}
    for ev in all_events_res.data:
        cid = ev["client_id"]
        if cid not in event_order:
            event_order[cid] = []
        event_order[cid].append(ev["id"])
        
    for ev in events:
        cid = ev.get("client_id")
        if cid in event_order:
            try:
                idx = event_order[cid].index(ev["id"]) + 1
                if ev.get("clients"):
                    ev["clients"]["package_current_count"] = idx
            except ValueError:
                pass
                
    return events


@router.get("/", response_model=List[CalendarEventResponse])
def list_events(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    request: Request = None,
):
    supabase, _ = get_user_supabase(request)
    query = supabase.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count), workout_types(name), training_plans(name)")

    if date_from:
        query = query.gte("event_date", date_from)
    if date_to:
        query = query.lte("event_date", date_to)
    if client_id:
        query = query.eq("client_id", client_id)

    res = query.neq("status", "deleted").order("event_date,event_hour").execute()
    events = res.data or []
    return assign_chronological_numbers(events, supabase)


@router.get("/week/{monday_date}", response_model=List[CalendarEventResponse])
def get_week_events(monday_date: str, request: Request):
    """Get events from Monday to Saturday of a given week."""
    from datetime import datetime, timedelta
    monday = datetime.strptime(monday_date, "%Y-%m-%d").date()
    saturday = monday + timedelta(days=5)

    supabase, _ = get_user_supabase(request)
    res = (
        supabase.table("calendar_events")
        .select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count), workout_types(name), training_plans(name)")
        .gte("event_date", monday.isoformat())
        .lte("event_date", saturday.isoformat())
        .neq("status", "deleted")
        .order("event_date,event_hour")
        .execute()
    )
    events = res.data or []
    return assign_chronological_numbers(events, supabase)


@router.get("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def get_event(event_date: str, event_hour: int, request: Request):
    supabase, _ = get_user_supabase(request)
    res = (
        supabase.table("calendar_events")
        .select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count), workout_types(name), training_plans(name)")
        .eq("event_date", event_date)
        .eq("event_hour", event_hour)
        .neq("status", "deleted")
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Event not found")
    events = assign_chronological_numbers([res.data], supabase)
    return events[0]


@router.post("/", response_model=CalendarEventResponse, status_code=201)
def create_or_update_event(data: CalendarEventCreate, request: Request):
    """Upsert: create or replace calendar event."""
    supabase, user_id = get_user_supabase(request)
    payload = data.model_dump(exclude_none=True, mode='json')
    payload["trainer_id"] = user_id

    try:
        res = supabase.table("calendar_events").upsert(
            payload, on_conflict="event_date,event_hour,trainer_id"
        ).execute()
        return res.data[0]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=repr(e))


@router.post("/replace-week")
def replace_week(data: ReplaceWeekRequest, request: Request):
    """Hard delete all events for a given week, then insert new ones."""
    from datetime import timedelta
    supabase, user_id = get_user_supabase(request)
    
    # Target date range
    monday = data.monday_date
    saturday = monday + timedelta(days=5)

    try:
        # 1. Hard delete all calendar_events between monday and saturday for this trainer
        supabase.table("calendar_events") \
            .delete() \
            .gte("event_date", monday.isoformat()) \
            .lte("event_date", saturday.isoformat()) \
            .eq("trainer_id", user_id) \
            .execute()
        
        # 2. Insert new events
        if data.events:
            payloads = []
            for ev in data.events:
                p = ev.model_dump(exclude_none=True, mode='json')
                p["trainer_id"] = user_id
                payloads.append(p)
                
            res = supabase.table("calendar_events").upsert(
                payloads, on_conflict="event_date,event_hour,trainer_id"
            ).execute()
            
            # Raise exception if Supabase returns an error
            if hasattr(res, 'error') and res.error:
                raise Exception(f"Supabase upsert error: {res.error}")
            
        return {"status": "replaced"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=repr(e))


@router.delete("/clear-week/{monday_date}")
def clear_week(monday_date: str, request: Request):
    """Hard delete all events for a given week."""
    from datetime import timedelta, date
    supabase, user_id = get_user_supabase(request)
    
    # Parse monday_date string to date object
    monday = date.fromisoformat(monday_date)
    # week = Mon to Sun (6 days later) to be safe and delete entire week
    sunday = monday + timedelta(days=6)

    try:
        res = supabase.table("calendar_events") \
            .delete() \
            .gte("event_date", monday.isoformat()) \
            .lte("event_date", sunday.isoformat()) \
            .eq("trainer_id", user_id) \
            .execute()
        return {"status": "cleared"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=repr(e))


@router.put("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def update_event(event_date: str, event_hour: int, data: CalendarEventUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
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
def swap_events(data: CalendarSwapRequest, request: Request):
    """Swap two calendar events (drag-and-drop)."""
    supabase, user_id = get_user_supabase(request)

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
            "trainer_id": user_id,
        }, on_conflict="event_date,event_hour,trainer_id").execute()

    if ev2_data:
        supabase.table("calendar_events").upsert({
            "event_date": data.date1.isoformat(),
            "event_hour": data.hour1,
            "client_id": ev2_data.get("client_id"),
            "workout_type_id": ev2_data.get("workout_type_id"),
            "status": "active",
            "trainer_id": user_id,
        }, on_conflict="event_date,event_hour,trainer_id").execute()

    # If one slot was empty, delete the original
    if not ev1_data:
        supabase.table("calendar_events").delete().eq("event_date", data.date2.isoformat()).eq("event_hour", data.hour2).execute()
    if not ev2_data:
        supabase.table("calendar_events").delete().eq("event_date", data.date1.isoformat()).eq("event_hour", data.hour1).execute()

    return {"status": "swapped"}


@router.get("/stats")
def get_calendar_stats(months: int = Query(1), request: Request = None):
    from datetime import datetime, date, timedelta
    today = date.today()
    
    start_year = today.year
    start_month = today.month - months
    while start_month <= 0:
        start_month += 12
        start_year -= 1
        
    try:
        start_date = date(start_year, start_month, today.day)
    except ValueError:
        next_month = start_month + 1
        next_year = start_year
        if next_month > 12:
            next_month = 1
            next_year += 1
        start_date = date(next_year, next_month, 1) - timedelta(days=1)
        
    supabase, _ = get_user_supabase(request)
    
    # Active events count
    active_res = supabase.table("calendar_events") \
        .select("id", count="exact") \
        .gte("event_date", start_date.isoformat()) \
        .lte("event_date", today.isoformat()) \
        .neq("status", "deleted") \
        .execute()
    active_count = active_res.count or 0
    
    # Cancelled events count
    cancelled_res = supabase.table("calendar_events") \
        .select("id", count="exact") \
        .gte("event_date", start_date.isoformat()) \
        .lte("event_date", today.isoformat()) \
        .eq("status", "deleted") \
        .execute()
    cancelled_count = cancelled_res.count or 0
    
    # 12 months chart data
    year_ago = today - timedelta(days=365)
    events_res = supabase.table("calendar_events") \
        .select("event_date") \
        .gte("event_date", year_ago.isoformat()) \
        .lte("event_date", today.isoformat()) \
        .neq("status", "deleted") \
        .execute()
        
    monthly_counts = {}
    temp_date = year_ago
    while temp_date <= today:
        key = temp_date.strftime("%Y-%m")
        monthly_counts[key] = 0
        if temp_date.month == 12:
            temp_date = date(temp_date.year + 1, 1, 1)
        else:
            temp_date = date(temp_date.year, temp_date.month + 1, 1)
            
    for ev in (events_res.data or []):
        d_str = ev.get("event_date")
        if d_str:
            key = d_str[:7]
            if key in monthly_counts:
                monthly_counts[key] += 1
                
    sorted_months = sorted(monthly_counts.items())
    chart_data = [{"month": k, "count": v} for k, v in sorted_months]
    
    return {
        "total_planned": active_count + cancelled_count,
        "cancelled": cancelled_count,
        "final": active_count,
        "chart_data": chart_data
    }


@router.post("/{event_date}/{event_hour}/settle")
def settle_event(event_date: str, event_hour: int, request: Request):
    supabase, _ = get_user_supabase(request)
    ev = supabase.table("calendar_events").select("*,clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count),workout_types(name),training_plans(name)").eq("event_date", event_date).eq("event_hour", event_hour).single().execute()
    if not ev.data:
        raise HTTPException(404, "Workout not found in calendar")
        
    if ev.data.get("is_settled"):
        return {"status": "already settled"}
        
    client_id = ev.data.get("client_id")
    if not client_id:
        raise HTTPException(400, "No client assigned to this workout")
        
    client = supabase.table("clients").select("package_current_count").eq("id", client_id).single().execute()
    curr_count = client.data.get("package_current_count") or 0
    
    supabase.table("clients").update({"package_current_count": curr_count + 1}).eq("id", client_id).execute()
    supabase.table("calendar_events").update({"is_settled": True}).eq("event_date", event_date).eq("event_hour", event_hour).execute()
    
    return {"status": "settled", "new_count": curr_count + 1}


@router.delete("/{event_date}/{event_hour}")
def delete_event(event_date: str, event_hour: int, request: Request):
    """Soft-delete: set status='deleted', log to deleted_workouts, and create absence."""
    supabase, user_id = get_user_supabase(request)

    ev = supabase.table("calendar_events").select("*,clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count),workout_types(name),training_plans(name)").eq("event_date", event_date).eq("event_hour", event_hour).execute()

    if ev.data and len(ev.data) > 0:
        event = ev.data[0]
        supabase.table("deleted_workouts").insert({
            "event_date": event_date,
            "event_hour": event_hour,
            "client_name": event.get("clients", {}).get("name") if isinstance(event.get("clients"), dict) else None,
            "workout_type": event.get("workout_types", {}).get("name") if isinstance(event.get("workout_types"), dict) else None,
            "trainer_id": user_id,
        }).execute()
        
        # Also delete workout logs for this client on this date to prevent stale data
        client_id = event.get("client_id")
        if client_id:
            supabase.table("workout_logs").delete().eq("client_id", client_id).eq("session_date", event_date).execute()
            # Create absence record so it shows in Absences module and on calendar
            supabase.table("absences").upsert({
                "client_id": client_id,
                "absence_date": event_date,
                "absence_hour": event_hour,
                "trainer_id": user_id,
            }, on_conflict="client_id,absence_date,absence_hour").execute()

    # Soft delete
    supabase.table("calendar_events").update({"status": "deleted", "updated_at": "now()"}).eq("event_date", event_date).eq("event_hour", event_hour).execute()

    return {"status": "deleted"}


@router.delete("/events/{event_date}/{event_hour}/hard")
def hard_delete_event(event_date: str, event_hour: int, request: Request):
    """Hard delete (remove row entirely)."""
    supabase, _ = get_user_supabase(request)
    supabase.table("calendar_events").delete().eq("event_date", event_date).eq("event_hour", event_hour).execute()
    return {"status": "deleted"}
