from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from database import get_user_supabase
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

    # Handle existing events on that day/hour for this client
    # If the event is settled, we mark it as 'cancelled' so it stays on the calendar and counts for billing.
    # If unsettled, we mark it as 'deleted' so it disappears (leaving only the absence indicator).
    query_evs = supabase.table("calendar_events").select("id, is_settled").eq("client_id", data.client_id).eq("event_date", data.absence_date.isoformat())
    if data.absence_hour is not None:
        query_evs = query_evs.eq("event_hour", data.absence_hour)
    
    existing_evs = query_evs.execute().data
    for ev in existing_evs:
        new_status = "cancelled" if ev.get("is_settled") else "deleted"
        supabase.table("calendar_events").update({"status": new_status, "updated_at": "now()"}).eq("id", ev["id"]).execute()

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
        if ev.get("client_id") and ev.get("clients")
    ]))
    
    if not client_ids:
        return events
        
    pkgs_res = supabase.table("client_packages").select("*").in_("client_id", client_ids).execute()
    packages = pkgs_res.data or []
    
    all_events_res = supabase.table("calendar_events") \
        .select("id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(billing_type, package_purchase_date, payment_history)") \
        .in_("client_id", client_ids) \
        .order("event_date") \
        .order("event_hour") \
        .execute()
        
    all_client_events = {}
    client_info = {}
    for e in all_events_res.data:
        cid = e["client_id"]
        if cid not in all_client_events:
            all_client_events[cid] = []
        all_client_events[cid].append(e)
        if cid not in client_info and e.get("clients"):
            client_info[cid] = e["clients"]
        
    client_packages = {}
    for p in packages:
        cid = p["client_id"]
        if cid not in client_packages:
            client_packages[cid] = []
        client_packages[cid].append(p)
        
    event_counts = {}
    
    for cid, evs in all_client_events.items():
        cinfo = client_info.get(cid, {})
        b_type = cinfo.get("billing_type")
        
        if b_type == "package":
            pkgs = client_packages.get(cid, [])
            ev_id_to_idx = {e["id"]: i for i, e in enumerate(evs)}
            
            def get_pkg_start_idx(p):
                return ev_id_to_idx.get(p["start_training_id"], 999999)
            pkgs.sort(key=get_pkg_start_idx)
            
            for i, pkg in enumerate(pkgs):
                start_id = pkg["start_training_id"]
                end_id = pkg.get("end_training_id")
                offset = pkg.get("offset", 0)
                
                start_idx = ev_id_to_idx.get(start_id)
                if start_idx is None:
                    continue 
                    
                end_idx = ev_id_to_idx.get(end_id) if end_id else len(evs)
                if end_idx is None:
                    end_idx = len(evs)
                
                if i + 1 < len(pkgs):
                    next_start_idx = ev_id_to_idx.get(pkgs[i+1]["start_training_id"])
                    if next_start_idx is not None and next_start_idx < end_idx:
                        end_idx = next_start_idx - 1
                
                current_count = offset
                for idx in range(start_idx, end_idx + 1):
                    if idx >= len(evs):
                        break
                    e = evs[idx]
                    
                    if e.get("status") == "deleted":
                        continue
                        
                    e_id = e["id"]
                    
                    if e["is_settled"]:
                        current_count += 1
                        
                        pkg_size = pkg.get("size", 10)
                        if current_count <= pkg_size:
                            event_counts[e_id] = current_count
                            event_counts[f"{e_id}_size"] = pkg_size
                        else:
                            pass
        else:
            purchase_date = cinfo.get("package_purchase_date")
            history = cinfo.get("payment_history") or []
            
            start_dates = []
            for h in history:
                if h.get("action") == "end":
                    pd = h.get("purchase_date")
                    if pd and pd != "0000-00-00":
                        start_dates.append(pd)
            if purchase_date:
                start_dates.append(purchase_date)
            start_dates = sorted(list(set(start_dates)))
            
            event_order_single = {}
            for e in evs:
                ev_date = e["event_date"]
                cycle_key = "single"
                belongs_to_history = False
                for h in history:
                    if h.get("action") == "end":
                        pd = h.get("purchase_date") or "0000-00-00"
                        ed = h.get("end_date") or "9999-12-31"
                        if pd <= ev_date <= ed:
                            if ev_date == ed and not e.get("is_settled"):
                                continue
                            cycle_key = f"pkg_{pd}"
                            belongs_to_history = True
                            break
                if not belongs_to_history:
                    if purchase_date and ev_date >= purchase_date:
                        cycle_key = f"pkg_{purchase_date}"
                    else:
                        cycle_key = "before_any"
                        # We do NOT want to fall back to a historical start date if the history was explicitly closed.
                        # If there's an active purchase_date, it would be caught above.
                        # If not, it means the cycle is completely closed and no new one started.
                
                if cycle_key != "before_any":
                    if cycle_key not in event_order_single:
                        event_order_single[cycle_key] = []
                    event_order_single[cycle_key].append(e["id"])
                    
            for ck, e_ids in event_order_single.items():
                current_count = 0
                for e_id in e_ids:
                    # Find the event to check if it's settled
                    ev = next((x for x in evs if x["id"] == e_id), None)
                    if ev and ev.get("is_settled"):
                        current_count += 1
                        event_counts[e_id] = current_count

    for ev in events:
        cid = ev.get("client_id")
        if cid and ev.get("clients"):
            b_type = ev["clients"].get("billing_type")
            e_id = ev["id"]
            
            has_active_or_history = False
            
            if b_type == "package":
                pkgs = client_packages.get(cid, [])
                is_start = any(p["start_training_id"] == e_id for p in pkgs)
                ev["is_start_of_package"] = is_start

                if e_id in event_counts:
                    ev["clients"]["package_current_count"] = event_counts[e_id]
                    ev["clients"]["package_size"] = event_counts.get(f"{e_id}_size", 10)
                    has_active_or_history = True
                else:
                    ev["clients"]["package_current_count"] = 0
                    has_active_or_history = False
            else:
                if e_id in event_counts:
                    ev["clients"]["package_current_count"] = event_counts[e_id]
                    has_active_or_history = True
                else:
                    ev["clients"]["package_current_count"] = 0
                    has_active_or_history = False
                    
            ev["clients"]["has_active_billing_or_history"] = has_active_or_history
                
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
            .eq("is_settled", False) \
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
        supabase.table("calendar_events") \
            .delete() \
            .gte("event_date", monday.isoformat()) \
            .lte("event_date", sunday.isoformat()) \
            .eq("trainer_id", user_id) \
            .eq("is_settled", False) \
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
            "status": ev1_data.get("status", "active"),
            "is_settled": ev1_data.get("is_settled", False),
            "trainer_id": user_id,
        }, on_conflict="event_date,event_hour,trainer_id").execute()

    if ev2_data:
        supabase.table("calendar_events").upsert({
            "event_date": data.date1.isoformat(),
            "event_hour": data.hour1,
            "client_id": ev2_data.get("client_id"),
            "workout_type_id": ev2_data.get("workout_type_id"),
            "status": ev2_data.get("status", "active"),
            "is_settled": ev2_data.get("is_settled", False),
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
    from datetime import date, timedelta
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
    
    year_ago = today - timedelta(days=365)
    
    # Fetch all events (except hard deleted) for the past 12 months
    events_res = supabase.table("calendar_events") \
        .select("event_date, status, is_settled") \
        .gte("event_date", year_ago.isoformat()) \
        .lte("event_date", today.isoformat()) \
        .neq("status", "deleted") \
        .execute()
        
    all_events = events_res.data or []
    
    start_date_str = start_date.isoformat()
    active_count = 0
    cancelled_count = 0
    
    monthly_counts = {}
    temp_date = year_ago
    while temp_date <= today:
        key = temp_date.strftime("%Y-%m")
        monthly_counts[key] = 0
        if temp_date.month == 12:
            temp_date = date(temp_date.year + 1, 1, 1)
        else:
            temp_date = date(temp_date.year, temp_date.month + 1, 1)
            
    for ev in all_events:
        d_str = ev.get("event_date")
        if not d_str:
            continue
            
        is_valid_active = ev.get("status") == "active" or (ev.get("status") == "cancelled" and ev.get("is_settled"))
        is_free_cancellation = ev.get("status") == "cancelled" and not ev.get("is_settled")
        
        # Calculate recent period stats (e.g. past month)
        if d_str >= start_date_str:
            if is_valid_active:
                active_count += 1
            elif is_free_cancellation:
                cancelled_count += 1
                
        # Calculate 12-month chart data
        if is_valid_active:
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
        
    supabase.table("calendar_events").update({"is_settled": True}).eq("event_date", event_date).eq("event_hour", event_hour).execute()
    
    return {"status": "settled"}


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
        
        # Decide status: if it was settled, it must remain on the calendar as 'cancelled' to hold the billing number
        new_status = "cancelled" if event.get("is_settled") else "deleted"
        
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

        # Soft delete or cancel
        supabase.table("calendar_events").update({"status": new_status, "updated_at": "now()"}).eq("id", event["id"]).execute()

    return {"status": "deleted"}


@router.delete("/events/{event_date}/{event_hour}/hard")
def hard_delete_event(event_date: str, event_hour: int, request: Request):
    """Hard delete (remove row entirely)."""
    supabase, _ = get_user_supabase(request)
    supabase.table("calendar_events").delete().eq("event_date", event_date).eq("event_hour", event_hour).execute()
    return {"status": "deleted"}
