from fastapi import APIRouter, HTTPException
from typing import List
from datetime import date, datetime, timedelta
from database import get_supabase
from models import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter(prefix="/clients", tags=["clients"])


def get_monday(dt=None):
    d = dt or date.today()
    day = d.weekday()
    return d - timedelta(days=day)


def generate_client_events(supabase, client_id, schedule):
    today = date.today()
    this_monday = get_monday(today)
    next_monday = this_monday + timedelta(days=7)

    for week_start in [this_monday, next_monday]:
        for entry in schedule:
            day = entry.get("day", 0)
            hour = entry.get("hour", 8)
            wt_id = entry.get("workout_type_id")

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
            }
            supabase.table("calendar_events").upsert(
                payload, on_conflict="event_date,event_hour"
            ).execute()


def generate_all_schedules():
    supabase = get_supabase()
    clients = supabase.table("clients").select("id,training_schedule").not_.is_("training_schedule", "null").execute()
    count = 0
    for c in (clients.data or []):
        schedule = c.get("training_schedule") or []
        if schedule:
            generate_client_events(supabase, c["id"], schedule)
            count += 1
    return count


@router.get("/", response_model=List[ClientResponse])
def list_clients():
    supabase = get_supabase()
    res = supabase.table("clients").select("*").order("name").execute()
    return res.data or []


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str):
    supabase = get_supabase()
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return res.data


@router.post("/", response_model=ClientResponse, status_code=201)
def create_client(data: ClientCreate):
    supabase = get_supabase()
    existing = supabase.table("clients").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Client '{data.name}' already exists")

    payload = data.model_dump(exclude_none=True, mode='json')
    res = supabase.table("clients").insert(payload).execute()
    client = res.data[0]

    if data.training_schedule:
        generate_client_events(supabase, client["id"], data.training_schedule)

    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: str, data: ClientUpdate):
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
    payload["updated_at"] = "now()"

    res = supabase.table("clients").update(payload).eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")

    if data.training_schedule is not None:
        generate_client_events(supabase, client_id, data.training_schedule or [])

    return res.data[0]


@router.delete("/{client_id}")
def delete_client(client_id: str):
    supabase = get_supabase()
    res = supabase.table("clients").delete().eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return {"status": "deleted", "name": res.data[0]["name"]}


@router.post("/generate-schedules")
def regenerate_schedules():
    count = generate_all_schedules()
    return {"status": "generated", "clients_processed": count}
