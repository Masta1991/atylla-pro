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


def _id_list(v):
    """Identyfikatory jako stringi (kolumny uuid[] / json)."""
    out = []
    for x in (v or []):
        try:
            out.append(str(x))
        except Exception:
            pass
    return out


def monthly_share_group(cid, clients_by_id):
    """Domknięcie współdzielenia miesięcznego (1 poziom w obie strony)."""
    cid = str(cid)
    group = {cid}
    c = clients_by_id.get(cid, {})
    for mid in _id_list(c.get("shared_monthly_with")):
        group.add(mid)
    for oid, o in clients_by_id.items():
        if cid in _id_list(o.get("shared_monthly_with")):
            group.add(oid)
    return group


def package_share_members(pkg):
    """Właściciel + członkowie wspólnej puli pakietu."""
    members = [str(pkg["client_id"])]
    for mid in _id_list(pkg.get("shared_client_ids")):
        if mid not in members:
            members.append(mid)
    return members


def assign_client_packages_status(clients, supabase):
    clients_by_id = {str(c["id"]): c for c in clients}
    client_ids_pkg = [c["id"] for c in clients if c.get("billing_type") == "package"]
    client_ids_single = [c["id"] for c in clients if c.get("billing_type") == "single" and c.get("package_purchase_date")]

    pkgs_res = supabase.table("client_packages").select("*").in_("client_id", [c["id"] for c in clients]).execute() if clients else None
    packages = pkgs_res.data if pkgs_res else []

    active_packages = {}
    member_pkg = {}  # członek wspólnej puli -> aktywny pakiet
    for p in packages:
        if p.get("end_training_id") is None:
            active_packages[p["client_id"]] = p
            for mid in package_share_members(p):
                member_pkg.setdefault(str(mid), p)

    active_client_ids = list(active_packages.keys()) + client_ids_single

    # Członkowie wspólnych pul (pakiet + miesięczne) — ich eventy też są potrzebne.
    fetch_ids = set(str(x) for x in active_client_ids)
    for p in packages:
        if p.get("end_training_id") is None:
            fetch_ids.update(package_share_members(p))
    for c in clients:
        if c.get("billing_type") == "single" and c.get("package_purchase_date"):
            fetch_ids.update(monthly_share_group(c["id"], clients_by_id))
    fetch_ids = list(fetch_ids)

    if not active_client_ids:
        for c in clients:
            if c.get("billing_type") == "package":
                c["package_current_count"] = 0
                c["package_purchase_date"] = None
            c["shared_with"] = []
        return clients

    all_events_res = supabase.table("calendar_events") \
        .select("id, client_id, event_date, event_hour, status, is_settled") \
        .in_("client_id", fetch_ids) \
        .order("event_date") \
        .order("event_hour") \
        .execute()

    client_events = {}
    for e in all_events_res.data:
        cid = e["client_id"]
        if cid not in client_events:
            client_events[cid] = []
        client_events[cid].append(e)

    # Absencje: odwołane BEZ rozliczenia = absencja bez rozliczonego treningu w tym slocie.
    abs_by_client = {}
    try:
        abs_res = supabase.table("absences").select("client_id,absence_date,absence_hour").in_("client_id", fetch_ids).execute()
        for a in (abs_res.data or []):
            abs_by_client.setdefault(a["client_id"], []).append(a)
    except Exception:
        pass

    def count_free_absences(cid, start_date, evs):
        settled_keys = {(e["event_date"], e["event_hour"]) for e in evs if e.get("is_settled")}
        settled_days = {e["event_date"] for e in evs if e.get("is_settled")}
        free = 0
        for a in abs_by_client.get(cid, []):
            if a["absence_date"] < start_date:
                continue
            h = a.get("absence_hour")
            if h is None:
                if a["absence_date"] not in settled_days:
                    free += 1
            elif (a["absence_date"], h) not in settled_keys:
                free += 1
        return free
        
    # Eventy po znormalizowanych (string) id klienta.
    events_by_cid = {}
    for cid_key, evs in client_events.items():
        events_by_cid.setdefault(str(cid_key), []).extend(evs)

    def union_events(members):
        union = []
        for m in members:
            union.extend(events_by_cid.get(str(m), []))
        union.sort(key=lambda e: (e["event_date"], e["event_hour"]))
        return union

    assigned = set()
    for c in clients:
        cid = str(c["id"])
        if cid in assigned:
            continue
        if c.get("billing_type") == "package":
            pkg = active_packages.get(c["id"]) or member_pkg.get(cid)
            if pkg:
                members = [m for m in package_share_members(pkg) if m in clients_by_id]
                union = union_events(members)
                start_id = pkg["start_training_id"]
                offset = pkg.get("offset", 0)

                start_idx = next((i for i, e in enumerate(union) if str(e["id"]) == str(start_id)), None)

                if start_idx is not None:
                    current_count = offset
                    cancelled_settled = 0
                    start_date = union[start_idx]["event_date"]
                    for idx in range(start_idx, len(union)):
                        if union[idx].get("status") == "deleted":
                            continue
                        if union[idx]["is_settled"]:
                            current_count += 1
                            if union[idx]["status"] == "cancelled":
                                cancelled_settled += 1
                    for m in members:
                        mc = clients_by_id[m]
                        mc["package_current_count"] = current_count
                        mc["package_size"] = pkg.get("size", 10)
                        mc["package_purchase_date"] = start_date
                        mc["active_package_id"] = pkg["id"]
                        mc["cancelled_settled_count"] = cancelled_settled
                        mc["cancelled_free_count"] = count_free_absences(m, start_date, union)
                        mc["shared_with"] = [x for x in members if x != m]
                        assigned.add(m)
                else:
                    for m in members:
                        mc = clients_by_id[m]
                        mc["package_current_count"] = 0
                        mc["package_purchase_date"] = None
                        mc["cancelled_settled_count"] = 0
                        mc["shared_with"] = [x for x in members if x != m]
                        assigned.add(m)
            else:
                c["package_current_count"] = 0
                c["package_purchase_date"] = None
                c["cancelled_settled_count"] = 0
                c["shared_with"] = []
                assigned.add(cid)
        elif c.get("billing_type") == "single":
            pd = c.get("package_purchase_date")
            if pd:
                members = [m for m in monthly_share_group(cid, clients_by_id) if m in clients_by_id]
                union = union_events(members)
                starts = [clients_by_id[m].get("package_purchase_date") for m in members
                          if clients_by_id[m].get("package_purchase_date")]
                start = min(starts) if starts else pd
                current_count = 0
                cancelled_settled = 0
                for e in union:
                    if e.get("status") == "deleted":
                        continue
                    if e["event_date"] >= start and e["is_settled"]:
                        current_count += 1
                        if e["status"] == "cancelled":
                            cancelled_settled += 1
                free = sum(count_free_absences(m, start, union) for m in members)
                for m in members:
                    mc = clients_by_id[m]
                    mc["package_current_count"] = current_count
                    mc["cancelled_settled_count"] = cancelled_settled
                    mc["cancelled_free_count"] = free
                    mc["shared_with"] = [x for x in members if x != m]
                    assigned.add(m)
            else:
                c["package_current_count"] = 0
                c["cancelled_settled_count"] = 0
                c["shared_with"] = []
                assigned.add(cid)
        else:
            c["shared_with"] = []
            assigned.add(cid)

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

    # Odklej z cudzych wspólnych pul pakietowych (inaczej licznik wracałby z puli).
    try:
        others = supabase.table("client_packages").select("id,shared_client_ids").filter(
            "shared_client_ids", "ov", "{" + str(client_id) + "}").execute()
        for p in (others.data or []):
            rest = [x for x in (p.get("shared_client_ids") or []) if str(x) != str(client_id)]
            supabase.table("client_packages").update({"shared_client_ids": rest}).eq("id", p["id"]).execute()
    except Exception:
        pass

    # Odklej z cudzych linków miesięcznych + wyczyść własne.
    try:
        mrows = supabase.table("clients").select("id,shared_monthly_with").filter(
            "shared_monthly_with", "ov", "{" + str(client_id) + "}").execute()
        for r in (mrows.data or []):
            rest = [x for x in (r.get("shared_monthly_with") or []) if str(x) != str(client_id)]
            supabase.table("clients").update({"shared_monthly_with": rest}).eq("id", r["id"]).execute()
    except Exception:
        pass

    # Wyzeruj liczniki w kliencie (active_package_id jest liczone dynamicznie
    # w assign_client_packages_status — nie ma takiej kolumny w tabeli).
    res = supabase.table("clients").update({
        "package_purchase_date": None,
        "package_current_count": 0,
        "package_size": 0,
        "shared_monthly_with": []
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
    # The database has ON DELETE CASCADE for client_packages, workout_logs, measurements, and absences.
    # calendar_events has ON DELETE SET NULL to keep the timeslot free.
    res = supabase.table("clients").delete().eq("id", client_id).execute()
    if not res.data:
        # Prawidłowo obsłuż brak klienta
        pass
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

