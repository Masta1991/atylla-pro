from fastapi import APIRouter, HTTPException, Request
from typing import List
from datetime import date, datetime, timedelta
from models import ClientCreate, ClientUpdate, ClientResponse, ClientPackageCreate, ClientPackageUpdate, ClientPackageResponse, StartBillingRequest, EndBillingRequest
from database import get_supabase, get_user_supabase
from pydantic import BaseModel

class AdjustPackageRequest(BaseModel):
    new_count: int
    comment: str

class NewPackageRequest(BaseModel):
    last_paid_event_date: str = None
    last_paid_event_hour: int = None

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
    end_date_limit = next_monday + timedelta(days=6)

    # Fetch existing events for this client in the two weeks
    res = supabase.table("calendar_events") \
        .select("event_date,event_hour,status") \
        .eq("client_id", client_id) \
        .gte("event_date", this_monday.isoformat()) \
        .lte("event_date", end_date_limit.isoformat()) \
        .execute()
        
    existing = {(r["event_date"], r["event_hour"]): r["status"] for r in (res.data or [])}

    for week_start in [this_monday, next_monday]:
        for entry in schedule:
            day = entry.get("day", 0)
            hour = entry.get("hour", 8)
            wt_id = entry.get("workout_type_id") or entry.get("plan_id")

            if not (0 <= day <= 5 and 6 <= hour <= 21):
                continue

            event_date = week_start + timedelta(days=day)
            event_date_str = event_date.isoformat()

            # Skip if already exists (whether active, deleted, or settled)
            # This prevents overwriting manual modifications or deletions
            if (event_date_str, hour) in existing:
                continue

            payload = {
                "event_date": event_date_str,
                "event_hour": hour,
                "client_id": client_id,
                "workout_type_id": wt_id,
                "status": "active",
                "trainer_id": user_id,
            }
            supabase.table("calendar_events").insert(payload).execute()


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


def assign_client_packages_status(clients, supabase):
    client_ids_pkg = [c["id"] for c in clients if c.get("billing_type") == "package"]
    client_ids_single = [c["id"] for c in clients if c.get("billing_type") == "single" and c.get("package_purchase_date")]
    
    pkgs_res = supabase.table("client_packages").select("*").in_("client_id", client_ids_pkg).execute() if client_ids_pkg else None
    packages = pkgs_res.data if pkgs_res else []
    
    active_packages = {p["client_id"]: p for p in packages if p.get("end_training_id") is None}
    
    active_client_ids = list(active_packages.keys()) + client_ids_single
    
    if not active_client_ids:
        for c in clients:
            if c.get("billing_type") == "package":
                c["package_current_count"] = 0
                c["package_purchase_date"] = None
        return clients

    all_events_res = supabase.table("calendar_events") \
        .select("id, client_id, event_date, event_hour, status, is_settled") \
        .in_("client_id", active_client_ids) \
        .order("event_date") \
        .order("event_hour") \
        .execute()
        
    client_events = {}
    for e in all_events_res.data:
        cid = e["client_id"]
        if cid not in client_events:
            client_events[cid] = []
        client_events[cid].append(e)
        
    for c in clients:
        cid = c["id"]
        if c.get("billing_type") == "package":
            if cid in active_packages:
                pkg = active_packages[cid]
                evs = client_events.get(cid, [])
                start_id = pkg["start_training_id"]
                offset = pkg.get("offset", 0)
                
                start_idx = next((i for i, e in enumerate(evs) if e["id"] == start_id), None)
                
                if start_idx is not None:
                    current_count = offset
                    cancelled_settled = 0
                    start_date = evs[start_idx]["event_date"]
                    for idx in range(start_idx, len(evs)):
                        if evs[idx].get("status") == "deleted":
                            continue
                        if evs[idx]["is_settled"]:
                            current_count += 1
                            if evs[idx]["status"] == "cancelled":
                                cancelled_settled += 1
                    c["package_current_count"] = current_count
                    c["package_size"] = pkg.get("size", 10)
                    c["package_purchase_date"] = start_date
                    c["active_package_id"] = pkg["id"]
                    c["cancelled_settled_count"] = cancelled_settled
                else:
                    c["package_current_count"] = 0
                    c["package_purchase_date"] = None
                    c["cancelled_settled_count"] = 0
            else:
                c["package_current_count"] = 0
                c["package_purchase_date"] = None
                c["cancelled_settled_count"] = 0
        elif c.get("billing_type") == "single":
            pd = c.get("package_purchase_date")
            if pd:
                evs = client_events.get(cid, [])
                current_count = 0
                cancelled_settled = 0
                for e in evs:
                    if e.get("status") == "deleted":
                        continue
                    if e["event_date"] >= pd and e["is_settled"]:
                        current_count += 1
                        if e["status"] == "cancelled":
                            cancelled_settled += 1
                c["package_current_count"] = current_count
                c["cancelled_settled_count"] = cancelled_settled
            else:
                c["package_current_count"] = 0
                c["cancelled_settled_count"] = 0
                
    return clients

@router.get("/", response_model=List[ClientResponse])
def list_clients(request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").order("name").execute()
    clients = res.data or []
    return assign_client_packages_status(clients, supabase)

@router.put("/packages/{package_id}", response_model=ClientPackageResponse)
def end_client_package(package_id: str, data: ClientPackageUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = data.model_dump(exclude_none=True, mode='json')
    payload["updated_at"] = "now()"
    
    # We can handle the un-setting of end_training_id if they send null
    if "end_training_id" in data.model_fields_set and data.end_training_id is None:
        payload["end_training_id"] = None

    res = supabase.table("client_packages").update(payload).eq("id", package_id).execute()
    if not res.data:
        raise HTTPException(404, "Package not found")
    return res.data[0]

@router.delete("/packages/{package_id}")
def delete_client_package(package_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("client_packages").delete().eq("id", package_id).execute()
    return {"status": "deleted"}

@router.post("/{client_id}/hard-reset", response_model=ClientResponse)
def hard_reset_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    
    # Usuń wszystkie powiązane pakiety SSOT
    supabase.table("client_packages").delete().eq("client_id", client_id).execute()
    
    # Wyzeruj liczniki w kliencie
    res = supabase.table("clients").update({
        "package_purchase_date": None,
        "package_current_count": 0,
        "package_size": 0,
        "active_package_id": None
    }).eq("id", client_id).execute()
    
    if not res.data:
        raise HTTPException(404, "Client not found")
        
    return assign_client_packages_status([res.data[0]], supabase)[0]

@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return assign_client_packages_status([res.data], supabase)[0]


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

    if "package_purchase_date" in data.model_fields_set and data.package_purchase_date is None:
        payload["package_purchase_date"] = None

    res = supabase.table("clients").update(payload).eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")

    if "training_schedule" in data.model_fields_set:
        schedule = data.training_schedule
        if schedule is not None:
            generate_client_events(supabase, user_id, client_id, schedule)

    return assign_client_packages_status([res.data[0]], supabase)[0]


@router.delete("/{client_id}")
def delete_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    # Clean up related records explicitly to prevent orphaned data or FK constraint errors
    supabase.table("client_packages").delete().eq("client_id", client_id).execute()
    supabase.table("calendar_events").delete().eq("client_id", client_id).execute()
    supabase.table("workouts").delete().eq("client_id", client_id).execute()
    # Finally delete the client
    supabase.table("clients").delete().eq("id", client_id).execute()
    return {"status": "deleted"}


@router.post("/regenerate-schedules")
def regenerate_schedules(request: Request):
    count = generate_all_schedules(request)
    return {"status": "ok", "clients_processed": count}



@router.get("/{client_id}/packages", response_model=List[ClientPackageResponse])
def get_client_packages(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("client_packages").select("*").eq("client_id", client_id).order("created_at").execute()
    return res.data or []

@router.post("/{client_id}/packages", response_model=ClientPackageResponse, status_code=201)
def create_client_package(client_id: str, data: ClientPackageCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    payload = data.model_dump(mode='json')
    payload["client_id"] = client_id
    payload["trainer_id"] = user_id
    res = supabase.table("client_packages").insert(payload).execute()
    return res.data[0]

