from fastapi import APIRouter, HTTPException, Request
from typing import List
from datetime import date, datetime, timedelta
from database import get_supabase, get_user_supabase
from models import ClientCreate, ClientUpdate, ClientResponse
from pydantic import BaseModel

class AdjustPackageRequest(BaseModel):
    new_count: int
    comment: str

class AdjustHistoryPackageRequest(BaseModel):
    archived_at: str
    new_count: int
    comment: str

router = APIRouter(prefix="/clients", tags=["clients"])


def get_monday(dt=None):
    d = dt or date.today()
    day = d.weekday()
    return d - timedelta(days=day)


def generate_client_events(supabase, user_id, client_id, schedule):
    today = date.today()
    this_monday = get_monday(today)
    next_monday = this_monday + timedelta(days=7)

    for week_start in [this_monday, next_monday]:
        for entry in schedule:
            day = entry.get("day", 0)
            hour = entry.get("hour", 8)
            wt_id = entry.get("workout_type_id") or entry.get("plan_id")

            if not (0 <= day <= 5 and 6 <= hour <= 21):
                continue

            event_date = week_start + timedelta(days=day)
            event_date_str = event_date.isoformat()

            payload = {
                "event_date": event_date_str,
                "event_hour": hour,
                "client_id": client_id,
                "workout_type_id": wt_id,
                "status": "active",
                "trainer_id": user_id,
            }
            supabase.table("calendar_events").upsert(
                payload, on_conflict="event_date,event_hour,trainer_id"
            ).execute()


def generate_all_schedules(request: Request):
    supabase, user_id = get_user_supabase(request)
    clients = supabase.table("clients").select("id,training_schedule").not_.is_("training_schedule", "null").execute()
    count = 0
    for c in (clients.data or []):
        schedule = c.get("training_schedule") or []
        if schedule:
            generate_client_events(supabase, user_id, c["id"], schedule)
            count += 1
    return count


@router.get("/", response_model=List[ClientResponse])
def list_clients(request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").order("name").execute()
    return res.data or []


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return res.data


@router.post("/", response_model=ClientResponse, status_code=201)
def create_client(data: ClientCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    payload = data.model_dump(exclude_none=True, mode='json')
    payload["trainer_id"] = user_id
    res = supabase.table("clients").insert(payload).execute()
    return res.data[0]


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: str, data: ClientUpdate, request: Request):
    supabase, user_id = get_user_supabase(request)
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
    payload["updated_at"] = "now()"

    res = supabase.table("clients").update(payload).eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")

    schedule = data.training_schedule or (res.data[0].get("training_schedule") if res.data else None)
    if schedule:
        generate_client_events(supabase, user_id, client_id, schedule)

    return res.data[0]


@router.delete("/{client_id}")
def delete_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("clients").delete().eq("id", client_id).execute()
    return {"status": "deleted"}


@router.post("/regenerate-schedules")
def regenerate_schedules(request: Request):
    count = generate_all_schedules(request)
    return {"status": "ok", "clients_processed": count}


@router.post("/{client_id}/adjust-package")
def adjust_package(client_id: str, data: AdjustPackageRequest, request: Request):
    supabase, _ = get_user_supabase(request)
    client = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not client.data:
        raise HTTPException(404, "Client not found")

    c = client.data
    history = c.get("payment_history") or []
    history.append({
        "date": datetime.now().isoformat(),
        "action": "adjust",
        "old_count": c.get("package_current_count", 0),
        "new_count": data.new_count,
        "comment": data.comment,
    })

    supabase.table("clients").update({
        "package_current_count": data.new_count,
        "payment_history": history,
    }).eq("id", client_id).execute()

    return {"status": "ok"}


@router.post("/{client_id}/new-package")
def new_package(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    client = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not client.data:
        raise HTTPException(404, "Client not found")

    c = client.data
    history = c.get("payment_history") or []
    history.append({
        "date": datetime.now().isoformat(),
        "action": "archive",
        "old_count": c.get("package_current_count", 0),
        "package_size": c.get("package_size", 10),
    })

    supabase.table("clients").update({
        "package_current_count": 0,
        "payment_history": history,
    }).eq("id", client_id).execute()

    return {"status": "ok"}


@router.post("/{client_id}/adjust-history-package")
def adjust_history_package(client_id: str, data: AdjustHistoryPackageRequest, request: Request):
    supabase, _ = get_user_supabase(request)
    client = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not client.data:
        raise HTTPException(404, "Client not found")

    c = client.data
    history = c.get("payment_history") or []
    history.append({
        "date": datetime.now().isoformat(),
        "action": "adjust_history",
        "archived_at": data.archived_at,
        "old_count": c.get("package_current_count", 0),
        "new_count": data.new_count,
        "comment": data.comment,
    })

    supabase.table("clients").update({
        "package_current_count": data.new_count,
        "payment_history": history,
    }).eq("id", client_id).execute()

    return {"status": "ok"}
