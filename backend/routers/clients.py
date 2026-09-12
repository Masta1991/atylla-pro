from fastapi import APIRouter, HTTPException, Request
from typing import List
from datetime import date, datetime, timedelta
from models import ClientCreate, ClientUpdate, ClientResponse, ClientPackageCreate, ClientPackageUpdate, ClientPackageResponse, StartBillingRequest, EndBillingRequest
from database import get_supabase, get_user_supabase, supabase_retry, utcnow_iso
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


class PackageStartAtRequest(BaseModel):
    event_id: str
    size: int = 10


class PackageEndAtRequest(BaseModel):
    event_id: str

router = APIRouter(prefix="/clients", tags=["clients"])


def _slot_done(event_date: str, event_hour: int) -> bool:
    """2.0: slot odbyty = minela pelna godzina slotu w Europe/Warsaw.
    Planowany (przyszly) trening NIE nabija licznika."""
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime as _dt
        WARSAW = ZoneInfo("Europe/Warsaw")
        now = _dt.now(WARSAW)
        y, m, d = (int(x) for x in str(event_date).split("-"))
        h = int(event_hour)
        if h + 1 >= 24:
            return now.date().isoformat() > str(event_date)
        slot_end = _dt(y, m, d, h + 1, 0, 0, tzinfo=WARSAW)
        return now > slot_end
    except Exception:
        return False


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
    for p in packages:
        if p.get("end_training_id") is None:
            active_packages[p["client_id"]] = p
    # T6: własny pakiet ma pierwszeństwo — członek z własnym pakietem nie należy
    # do cudzej puli (ani mapowanie, ani unia, ani nadpisanie wyniku).
    _own_ids = {str(k) for k in active_packages.keys()}
    member_pkg = {}  # członek wspólnej puli -> aktywny pakiet
    for p in packages:
        if p.get("end_training_id") is None:
            for mid in package_share_members(p):
                mid = str(mid)
                if mid == str(p["client_id"]):
                    continue
                if mid in _own_ids:
                    continue
                member_pkg.setdefault(mid, p)

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

    # T10: stronicowanie jak w calendar.py — unikamy obcięcia do 1000 wierszy
    # PostgREST (brak kotwicy startu / zaniżony licznik przy dużych historiach).
    def _events_page(page, size):
        return supabase.table("calendar_events") \
            .select("id, client_id, event_date, event_hour, status, is_settled") \
            .in_("client_id", fetch_ids) \
            .order("event_date") \
            .order("event_hour") \
            .range(page * size, (page + 1) * size - 1) \
            .execute()
    try:
        all_events_data = []
        _page, _size = 0, 1000
        while True:
            _rows = _events_page(_page, _size).data or []
            all_events_data.extend(_rows)
            if len(_rows) < _size:
                break
            _page += 1
        all_events_res = type("R", (), {"data": all_events_data})()
    except (AttributeError, TypeError):
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
        # FIX 2026-09-07 (Ania): slot ponownie zajety AKTYWNYM treningiem tego
        # klienta (usuniety + wpisany ponownie) to nie odwolanie — absencja
        # jest nieaktualna i nie liczy sie do "odwolanych bez rozliczenia".
        active_keys = {(e["event_date"], e["event_hour"]) for e in evs
                       if str(e.get("client_id")) == str(cid) and e.get("status") == "active"}
        active_days = {e["event_date"] for e in evs
                       if str(e.get("client_id")) == str(cid) and e.get("status") == "active"}
        free = 0
        for a in abs_by_client.get(cid, []):
            if a["absence_date"] < start_date:
                continue
            h = a.get("absence_hour")
            if h is None:
                if a["absence_date"] not in settled_days and a["absence_date"] not in active_days:
                    free += 1
            elif (a["absence_date"], h) not in settled_keys and (a["absence_date"], h) not in active_keys:
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
            pkg = active_packages.get(c["id"]) or active_packages.get(str(c["id"])) or member_pkg.get(cid)
            if pkg:
                # T6: z puli wypadają członkowie z WŁASNYM innym pakietem
                # (właściciel tej puli zostaje — jego pakiet to właśnie pkg).
                members = [m for m in package_share_members(pkg)
                           if m in clients_by_id and (
                               str(m) == str(pkg["client_id"])
                               or not any(str(p.get("client_id")) == str(m)
                                          and p.get("end_training_id") is None
                                          and str(p.get("id")) != str(pkg.get("id"))
                                          for p in packages))]
                union = union_events(members)
                start_id = pkg["start_training_id"]
                # Prod: offset/size bywają NULL — None nie może wejść do licznika.
                offset = pkg.get("offset") or 0

                start_idx = next((i for i, e in enumerate(union) if str(e["id"]) == str(start_id)), None)

                if start_idx is not None:
                    # 2.0: licznik = TYLKO odbyte + odwolane-oplacone.
                    # Planowane (przyszle sloty) NIE nabijaja licznika.
                    # tile_number na kafelku zostaje pozycyjny (kalendarz),
                    # package_current_count rosnie dopiero po odbyciu.
                    current_count = offset
                    cancelled_settled = 0
                    start_date = union[start_idx]["event_date"]
                    for idx in range(start_idx, len(union)):
                        if union[idx].get("status") == "deleted":
                            continue
                        if union[idx].get("status") == "cancelled":
                            if union[idx].get("is_settled"):
                                current_count += 1
                                cancelled_settled += 1
                            continue
                        if _slot_done(union[idx]["event_date"], union[idx]["event_hour"]):
                            current_count += 1
                    for m in members:
                        mc = clients_by_id[m]
                        mc["package_current_count"] = current_count
                        mc["package_size"] = pkg.get("size") or 10
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
                    # 2.0: licznik cyklu = TYLKO odbyte + odwolane-oplacone.
                    if e["event_date"] >= start:
                        if e.get("status") == "cancelled":
                            if e.get("is_settled"):
                                current_count += 1
                                cancelled_settled += 1
                        elif _slot_done(e["event_date"], e["event_hour"]):
                            current_count += 1
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
    import httpx as _httpx
    supabase, _ = get_user_supabase(request)

    def _load():
        res = supabase.table("clients").select("*").order("name").execute()
        clients = res.data or []
        return assign_client_packages_status(clients, supabase)

    try:
        return supabase_retry(_load)
    except _httpx.TransportError:
        raise HTTPException(502, "Baza chwilowo nie odpowiada (Supabase). Spróbuj ponownie.")

@router.put("/packages/{package_id}", response_model=ClientPackageResponse)
def end_client_package(package_id: str, data: ClientPackageUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = data.model_dump(exclude_none=True, mode='json')
    payload["updated_at"] = utcnow_iso()
    
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

def _pool_peer_ids(supabase, client) -> list:
    """T5: identyfikatory potrzebne do policzenia puli jednego klienta —
    właściciel + członkowie wspólnych pakietów oraz grupa miesięczna.
    Bez nich pojedynczy odczyt (szuflada) mijał się z listą rozliczeń."""
    cid = str(client["id"])
    ids = {cid}
    try:
        own = supabase.table("client_packages").select(
            "client_id,shared_client_ids").eq("client_id", cid).execute()
        for p in (own.data or []):
            ids.add(str(p.get("client_id")))
            ids.update(_id_list(p.get("shared_client_ids")))
    except Exception:
        pass
    try:
        foreign = supabase.table("client_packages").select(
            "client_id,shared_client_ids").filter(
            "shared_client_ids", "ov", "{" + cid + "}").execute()
        for p in (foreign.data or []):
            ids.add(str(p.get("client_id")))
            ids.update(_id_list(p.get("shared_client_ids")))
    except Exception:
        pass
    try:
        ids.update(_id_list(client.get("shared_monthly_with")))
        rev = supabase.table("clients").select("id,shared_monthly_with").filter(
            "shared_monthly_with", "ov", "{" + cid + "}").execute()
        for r in (rev.data or []):
            ids.add(str(r.get("id")))
    except Exception:
        pass
    return [i for i in ids if i]


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    # T5: liczymy na pełnej puli, zwracamy tylko żądanego klienta.
    try:
        peers = _pool_peer_ids(supabase, res.data)
        rows = supabase.table("clients").select("*").in_("id", peers).execute().data or [res.data]
    except Exception:
        rows = [res.data]
    computed = assign_client_packages_status(rows, supabase)
    for c in computed:
        if str(c["id"]) == str(client_id):
            return c
    return computed[0]


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
    payload["updated_at"] = utcnow_iso()

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
    # Typ rozliczenia ustawia się SAM przy starcie (nie ma go w karcie klienta).
    try:
        supabase.table("clients").update({"billing_type": "package", "updated_at": utcnow_iso()}).eq("id", client_id).execute()
    except Exception:
        pass
    return res.data[0]


def _client_must_be_mine(supabase, user_id: str, client_id: str) -> dict:
    """Klient nalezy do wolajacego trenera (ochrona przed cudzymi pakietami)."""
    res = supabase.table("clients").select("id,billing_type").eq("id", client_id).eq("trainer_id", user_id).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(404, "Klient nie nalezy do tego trenera")
    return rows[0]


def _active_package_or_404(supabase, client_id: str):
    pkgs = supabase.table("client_packages").select("*").eq("client_id", client_id).is_("end_training_id", None).execute()
    rows = pkgs.data or []
    if not rows:
        raise HTTPException(404, "Brak aktywnego pakietu")
    if len(rows) > 1:
        raise HTTPException(400, "Wiecej niz jeden aktywny pakiet — uporzadkuj w Rozliczeniach")
    return rows[0]


def _event_must_be_bookable(supabase, user_id: str, client_id: str, event_id: str) -> dict:
    """Event do kotwicy pakietu: istnieje, moj, tego klienta, nieusuniety."""
    res = supabase.table("calendar_events").select("id,client_id,event_date,event_hour,status") \
        .eq("id", event_id).eq("trainer_id", user_id).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(404, "Trening nie znaleziony")
    ev = rows[0]
    if str(ev.get("client_id")) != str(client_id):
        raise HTTPException(400, "Trening nalezy do innego klienta")
    if ev.get("status") == "deleted":
        raise HTTPException(400, "Na usunietym treningu nie da sie zaczac ani skonczyc pakietu")
    return ev


@router.post("/{client_id}/packages/start-at", response_model=ClientPackageResponse, status_code=201)
def start_package_at(client_id: str, data: PackageStartAtRequest, request: Request):
    """2.0: start pakietu z poziomu kalendarza (szuflada). Tylko pakiety solo
    (wspoldzielone zakladamy w Rozliczeniach)."""
    supabase, user_id = get_user_supabase(request)
    _client_must_be_mine(supabase, user_id, client_id)
    existing = supabase.table("client_packages").select("id").eq("client_id", client_id).is_("end_training_id", None).execute()
    if existing.data:
        raise HTTPException(400, "Klient ma juz aktywny pakiet — najpierw go zakoncz")
    ev = _event_must_be_bookable(supabase, user_id, client_id, data.event_id)
    used = supabase.table("client_packages").select("id").eq("client_id", client_id) \
        .or_(f"start_training_id.eq.{data.event_id},end_training_id.eq.{data.event_id}").execute()
    if used.data:
        raise HTTPException(400, "Ten trening jest juz kotwica innego pakietu")
    size = int(data.size or 10)
    if size < 1 or size > 100:
        raise HTTPException(400, "Rozmiar pakietu 1-100")
    res = supabase.table("client_packages").insert({
        "client_id": client_id, "trainer_id": user_id,
        "size": size, "start_training_id": data.event_id, "offset": 0,
        "shared_client_ids": [],
    }).execute()
    try:
        supabase.table("clients").update({"billing_type": "package", "updated_at": utcnow_iso()}).eq("id", client_id).execute()
    except Exception:
        pass
    return res.data[0]


class CloseCycleRequest(BaseModel):
    end_date: str


@router.post("/{client_id}/close-cycle", response_model=ClientResponse)
def close_client_cycle(client_id: str, data: CloseCycleRequest, request: Request):
    """T9: domknięcie cyklu miesięcznego na wskazaną datę. Backend liczy
    wykorzystanie od startu DO wskazanego końca (odbyte + odwołane-opłacone),
    zamiast kopiować bieżący licznik. Pakiety zamyka przepływ end-at."""
    from datetime import datetime as _dt
    supabase, _ = get_user_supabase(request)
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    client = res.data
    if (client.get("billing_type") or "single") == "package":
        raise HTTPException(400, "Pakiet zamyka przepływ end-at, nie close-cycle")
    start = client.get("package_purchase_date")
    if not start:
        raise HTTPException(400, "Brak otwartego cyklu")
    end = data.end_date
    try:
        _dt.fromisoformat(str(end))
        _dt.fromisoformat(str(start))
    except ValueError:
        raise HTTPException(400, "Zła data")
    if str(end) < str(start):
        raise HTTPException(400, "Koniec nie może być przed startem cyklu")

    peers = _pool_peer_ids(supabase, client)
    try:
        rows = supabase.table("clients").select("*").in_("id", peers).execute().data or [client]
    except Exception:
        rows = [client]
    by_id = {str(r["id"]): r for r in rows}
    members = sorted({str(m) for m in monthly_share_group(str(client_id), by_id) if str(m) in by_id})

    try:
        ev_res = supabase.table("calendar_events") \
            .select("id,client_id,event_date,event_hour,status,is_settled") \
            .in_("client_id", members).execute()
        events = ev_res.data or []
    except Exception:
        events = []
    try:
        abs_res = supabase.table("absences").select(
            "client_id,absence_date,absence_hour").in_("client_id", members).execute()
        abs_set = {(a.get("client_id"), a.get("absence_date"), a.get("absence_hour"))
                   for a in (abs_res.data or [])}
        abs_days = {(a.get("client_id"), a.get("absence_date"))
                    for a in (abs_res.data or []) if a.get("absence_hour") is None}
    except Exception:
        abs_set, abs_days = set(), set()

    def _timely(cid, d, h):
        return (cid, d, h) in abs_set or (cid, d) in abs_days

    completed = 0
    for e in events:
        d = e.get("event_date")
        if d is None or not (str(start) <= str(d) <= str(end)):
            continue
        if e.get("status") == "deleted":
            continue
        if e.get("status") == "cancelled":
            if e.get("is_settled"):
                completed += 1
            continue
        if _timely(e.get("client_id"), d, e.get("event_hour")):
            continue
        if _slot_done(d, e.get("event_hour")):
            completed += 1

    history = list(client.get("payment_history") or [])
    history.append({
        "action": "end",
        "end_date": str(end),
        "purchase_date": str(start),
        "archived_at": _dt.now().isoformat(),
        "package_size": 0,
        "completed_count": completed,
    })
    upd = supabase.table("clients").update(
        {"payment_history": history, "package_purchase_date": None,
         "updated_at": utcnow_iso()}).eq("id", client_id).execute()
    if not upd.data:
        raise HTTPException(404, "Client not found")
    return assign_client_packages_status([upd.data[0]], supabase)[0]


@router.post("/{client_id}/packages/end-at")
def end_package_at(client_id: str, data: PackageEndAtRequest, request: Request):
    """2.0: koniec pakietu z poziomu kalendarza (szuflada)."""
    supabase, user_id = get_user_supabase(request)
    _client_must_be_mine(supabase, user_id, client_id)
    pkg = _active_package_or_404(supabase, client_id)
    ev = _event_must_be_bookable(supabase, user_id, client_id, data.event_id)
    start = supabase.table("calendar_events").select("event_date,event_hour") \
        .eq("id", pkg["start_training_id"]).execute()
    if start.data:
        s = start.data[0]
        if (ev["event_date"], ev["event_hour"]) < (s["event_date"], s["event_hour"]):
            raise HTTPException(400, "Koniec nie moze byc przed startem pakietu")
    supabase.table("client_packages").update(
        {"end_training_id": data.event_id, "updated_at": utcnow_iso()}).eq("id", pkg["id"]).execute()
    return {"status": "closed", "package_id": pkg["id"]}

