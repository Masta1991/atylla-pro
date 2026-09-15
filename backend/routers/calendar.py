from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from pydantic import BaseModel
from billing import slot_done as _slot_done, project_package, event_key
from billing_data import read_all, load_package_boundaries
from trainer_insights import session_rows, totals as session_totals
from database import get_user_supabase, supabase_retry, utcnow_iso, atomic_rpc
from models import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    CalendarSwapRequest, AbsenceCreate, AbsenceResponse, ReplaceWeekRequest, CalendarWorkoutSave
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _str_ids(v):
    out = []
    for x in (v or []):
        try:
            out.append(str(x))
        except Exception:
            pass
    return out


def _partner_names(supabase, events):
    """Imiona współćwiczących hurtem; puste pre-migracja (brak kolumny)."""
    pids = {str(e.get("partner_client_id")) for e in events if e.get("partner_client_id")}
    if not pids:
        return {}
    try:
        res = supabase.table("clients").select("id,name").in_("id", list(pids)).execute()
        return {str(r["id"]): r.get("name") for r in (res.data or [])}
    except Exception:
        return {}


# ── Absences ─────────────────────────────────────────────────────────────────

@router.get("/absences", response_model=List[AbsenceResponse])
def get_absences(date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), request: Request = None):
    supabase, _ = get_user_supabase(request)
    query = supabase.table("absences").select("*, clients(name)").order("absence_date", desc=True)
    if date_from:
        query = query.gte("absence_date", date_from)
    if date_to:
        query = query.lte("absence_date", date_to)
    res = query.execute()
    return res.data or []

@router.post("/absences", response_model=AbsenceResponse, status_code=201)
def create_absence(data: AbsenceCreate, request: Request):
    supabase, user_id = get_user_supabase(request)
    return atomic_rpc(supabase, 'record_absence_v3', {'p_payload': data.model_dump(mode='json')})

@router.delete("/absences/{absence_id}")
def delete_absence(absence_id: str, request: Request):
    supabase, _ = get_user_supabase(request)
    supabase.table("absences").delete().eq("id", absence_id).execute()
    return {"status": "deleted"}


# ── Calendar Events ──────────────────────────────────────────────────────────

@router.post('/save-workout')
def save_calendar_workout(data: CalendarWorkoutSave, request: Request):
    supabase, _ = get_user_supabase(request)
    return atomic_rpc(supabase, 'save_calendar_workout_v4', {'p_payload': data.model_dump(mode='json')})


def assign_chronological_numbers(events, supabase):
    client_ids = list(set([
        ev["client_id"] for ev in events
        if ev.get("client_id") and ev.get("clients")
    ]))
    
    if not client_ids:
        return events

    # RLS scopes this metadata to the authenticated trainer. A complete read
    # resolves own-wins even when only a shared member has events in this week.
    all_packages = read_all(lambda: supabase.table('client_packages').select('*'))
    related = set(client_ids)
    while True:
        before = len(related)
        for p in all_packages:
            members = {str(p['client_id'])} | set(_str_ids(p.get('shared_client_ids')))
            if related & members:
                related.update(members)
        if len(related) == before:
            break
    packages = [p for p in all_packages if str(p['client_id']) in related]
    # Miesięczne współdzielenie: {cid: [member ids]} (puste pre-migracja).
    monthly_shares = {}
    try:
        sh_res = supabase.table("clients").select("id,shared_monthly_with").in_("id", client_ids).execute()
        for r in (sh_res.data or []):
            ids = _str_ids(r.get("shared_monthly_with"))
            if ids:
                monthly_shares[str(r["id"])] = ids
        rev_res = supabase.table("clients").select("id,shared_monthly_with").filter(
            "shared_monthly_with", "ov", "{" + ",".join(client_ids) + "}").execute()
        for r in (rev_res.data or []):
            ids = _str_ids(r.get("shared_monthly_with"))
            if ids:
                monthly_shares.setdefault(str(r["id"]), ids)
    except Exception:
        pass

    # Członkowie wspólnych pul — ich pełna historia też wchodzi do unii.
    # (Przed pobraniem absencji i eventów.)
    _extra_ids = set()
    for _p in packages:
        _owner = str(_p["client_id"])
        _extra_ids.add(_owner)
        for _mid in _str_ids(_p.get("shared_client_ids")):
            if _mid != _owner:
                _extra_ids.add(_mid)
    for _cid, _mids in monthly_shares.items():
        _extra_ids.add(str(_cid))
        _extra_ids.update(_mids)
    _fetch_ids = list(set(client_ids) | _extra_ids)

    # Nieobecności: trening nierozliczony z absencją = odwołany w porę,
    # wypada z numeracji (jak usunięty). Rozliczony z absencją zostaje.
    # Zakres: klienci z zapytania + członkowie wspólnych pul.
    
    # Retrieve all client calendar events with pagination to avoid 1000-row PostgREST truncation
    all_events_data = []
    page = 0
    page_size = 1000
    while True:
        paged_res = supabase.table("calendar_events") \
            .select("id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(billing_type, package_purchase_date, payment_history)") \
            .in_("client_id", _fetch_ids) \
            .order("event_date") \
            .order("event_hour") \
            .range(page * page_size, (page + 1) * page_size - 1) \
            .execute()
        
        chunk = paged_res.data or []
        all_events_data.extend(chunk)
        if len(chunk) < page_size:
            break
        page += 1
        
    package_boundaries = load_package_boundaries(supabase, packages, all_events_data)
    all_client_events = {}
    client_info = {}
    for e in all_events_data:
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
    # Pozycja treningu w pakiecie (1-based, liczona po kolei w cyklu,
    # także dla nierozliczonych — do flag OSTATNI / POZA PAKIETEM na kafelku).
    event_positions = {}
    # Starty i końce cykli miesięcznych (do odznak START CYKLU / OSTATNI).
    single_start_ids = set()
    single_last_ids = set()
    # Treningi w DOMKNIĘTYCH zakresach (szuflada chowa na nich przyciski startu).
    closed_ids = set()
    package_start_ids = set()

    # Właściciele aktywnych pakietów + członkowie cudzych pul (own-wins:
    # członek z własnym aktywnym pakietem rozlicza się sam).
    _owner_has_active = set()
    for _p in packages:
        if _p.get("end_training_id") is None:
            _owner_has_active.add(str(_p["client_id"]))
    _pooled_cids = set()
    for _p in packages:
        _o = str(_p["client_id"])
        for _mid in _str_ids(_p.get("shared_client_ids")):
            if _mid != _o and _mid not in _owner_has_active:
                _pooled_cids.add(_mid)
    _handled_single = set()

    for cid, evs in all_client_events.items():
        cinfo = client_info.get(cid, {})
        b_type = cinfo.get("billing_type")

        if b_type == "package":
            pkgs = client_packages.get(cid, [])
            all_by_id = {str(e['id']): e for e in package_boundaries}
            if sum(p.get('end_training_id') is None for p in pkgs) > 1:
                raise HTTPException(409, 'Klient ma kilka otwartych pakietów. Sprawdź dane przed rozliczeniem.')
            try:
                pkgs.sort(key=lambda p: event_key(all_by_id[str(p['start_training_id'])]))
                for i, pkg in enumerate(pkgs):
                    # Membership belongs to this package, not the union of its history.
                    members = {str(cid)} | {m for m in _str_ids(pkg.get('shared_client_ids'))
                        if pkg.get('end_training_id') or m not in _owner_has_active}
                    union = [e for m in members for e in all_client_events.get(m, [])]
                    next_key = event_key(all_by_id[str(pkgs[i+1]['start_training_id'])]) if i+1 < len(pkgs) else None
                    projection = project_package(pkg, union, done=_slot_done, stop_before=next_key,
                                                 boundary_events=package_boundaries)
                    effective = projection['effective_start']
                    if effective:
                        package_start_ids.add(effective['id'])
                    closed_ids.update(projection['closed_ids'])
                    size = pkg.get('size') or 10
                    for row in projection['rows']:
                        eid = row['event']['id']
                        event_positions[eid] = row['position']
                        event_positions[f'{eid}_size'] = size
                        if row['counted']:
                            event_counts[eid] = row['count']
                            event_counts[f'{eid}_size'] = size
            except (KeyError, ValueError) as exc:
                raise HTTPException(409, 'Niepełne granice pakietu. Sprawdź dane przed rozliczeniem.') from exc
        else:
            # Członek wspólnej puli pakietowej rozlicza się w unii (wyżej) — tu pomijamy,
            # żeby cykl single nie nadpisał pozycji z puli.
            if str(cid) in _pooled_cids:
                continue
            # Grupa miesięczna: unia eventów + wspólna historia i starty.
            _grp = {str(cid)}
            for _m in monthly_shares.get(str(cid), []):
                _grp.add(str(_m))
            for _oid, _mids in monthly_shares.items():
                if str(cid) in [str(_x) for _x in _mids]:
                    _grp.add(str(_oid))
            _gkey = frozenset(_grp)
            if _gkey in _handled_single:
                continue
            _handled_single.add(_gkey)
            evs = []
            for _m in sorted(_grp):
                evs.extend(all_client_events.get(_m, []))
            evs.sort(key=lambda _e: (_e["event_date"], _e["event_hour"]))
            _ghistory = []
            _gpds = []
            for _m in sorted(_grp):
                _mi = client_info.get(_m, {})
                _ghistory.extend(_mi.get("payment_history") or [])
                if _mi.get("package_purchase_date"):
                    _gpds.append(_mi["package_purchase_date"])
            purchase_date = min(_gpds) if _gpds else cinfo.get("package_purchase_date")
            history = _ghistory

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
                # Usunięte wiersze (np. Nieobecność bez płatności) nie zajmują
                # numerów — inaczej duchy przesuwałyby żywe treningi (Ewa: 1,3).
                if e.get("status") == "deleted":
                    continue
                # Odwołany w porę (absencja, brak rozliczenia) wypada z numeracji.
                # FIX 2026-09-07 jak wyzej: AKTYWNY trening ignoruje absencje.
                # Bezpłatne odwołanie (także bez absencji) nie dostaje numeru.
                if e.get("status") == "cancelled" and not e.get("is_settled"):
                    continue
                cycle_key = "single"
                belongs_to_history = False
                cycle_ed = None
                for h in history:
                    if h.get("action") == "end":
                        pd = h.get("purchase_date") or "0000-00-00"
                        ed = h.get("end_date") or "9999-12-31"
                        if pd <= ev_date <= ed:
                            cycle_key = f"pkg_{pd}"
                            belongs_to_history = True
                            cycle_ed = ed
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
                    if belongs_to_history and cycle_ed and cycle_ed != "9999-12-31":
                        closed_ids.add(e["id"])
                    
            for ck, e_ids in event_order_single.items():
                current_count = 0
                by_id = {e["id"]: e for e in evs}
                for pos_idx, e_id in enumerate(e_ids):
                    # 2.0: pozycja (kafelek) rosnie zawsze; licznik rozliczen
                    # tylko za odbyte + odwolane-oplacone.
                    event_positions[e_id] = pos_idx + 1
                    _e = by_id.get(e_id) or {}
                    if _e.get("status") == "cancelled":
                        if _e.get("is_settled"):
                            current_count += 1
                            event_counts[e_id] = current_count
                    elif _e and _slot_done(_e.get("event_date", ""), _e.get("event_hour", 0)):
                        current_count += 1
                        event_counts[e_id] = current_count
                if e_ids:
                    # Pierwszy trening cyklu = START.
                    single_start_ids.add(e_ids[0])
                    # Zamknięty cykl: ostatni trening cyklu (do end_date) = OSTATNI.
                    ed = None
                    if ck != "single":
                        for h in history:
                            if h.get("action") == "end" and f"pkg_{h.get('purchase_date')}" == ck:
                                ed = h.get("end_date") or "9999-12-31"
                                break
                    if ed:
                        by_id = {e["id"]: e for e in evs}
                        cands = [x for x in e_ids
                                 if (by_id.get(x) or {}).get("event_date", "") <= ed]
                        if cands:
                            single_last_ids.add(cands[-1])

    _all_start_ids = package_start_ids
    _all_end_ids = {p.get("end_training_id") for p in packages if p.get("end_training_id")}

    for ev in events:
        cid = ev.get("client_id")
        if cid and ev.get("clients"):
            b_type = ev["clients"].get("billing_type")
            e_id = ev["id"]

            has_active_or_history = False

            if b_type == "package":
                is_start = e_id in _all_start_ids
                ev["is_start_of_package"] = is_start

                if e_id in event_counts:
                    ev["clients"]["package_current_count"] = event_counts[e_id]
                    has_active_or_history = True
                else:
                    ev["clients"]["package_current_count"] = 0
                    has_active_or_history = False
                    # Bez danych SSOT nie pokazujemy starej kolumny
                    # clients.package_size (duch ../10 na kafelku).
                    ev["clients"]["package_size"] = None

                # Numer na kafelek od razu (pozycja w pakiecie).
                if e_id in event_positions:
                    ev["tile_number"] = event_positions[e_id]
                    # FIX 2026-09-07 (pakiet laczony 14 vs 1/10): rozmiar bierzemy
                    # z SSOT pakietu (event_positions), nie ze starej kolumny
                    # clients.package_size ani z domyslnego 10. Bez tego kafelek
                    # nierozliczonego treningu pokazywal ".../10" mimo size=14.
                    ev["clients"]["package_size"] = event_positions.get(f"{e_id}_size", ev["clients"].get("package_size", 10))

                # Flagi kafelka na podstawie PAKIETU (znaczniki start/end),
                # numeracja tylko jako fallback dla otwartych pakietów i nadwyżek.
                if e_id in event_positions:
                    pos = event_positions[e_id]
                    size = event_positions.get(f"{e_id}_size")
                    if size is None:
                        size = ev["clients"].get("package_size") or None
                    is_end = e_id in _all_end_ids
                    if size and size > 0:
                        if is_end or pos == size:
                            ev["billing_flag"] = "LAST"
                        elif pos > size:
                            ev["billing_flag"] = "OVERFLOW"
            else:
                if e_id in event_counts:
                    ev["clients"]["package_current_count"] = event_counts[e_id]
                    has_active_or_history = True
                else:
                    ev["clients"]["package_current_count"] = 0
                    has_active_or_history = False
                # Odznaki cyklu miesięcznego: START na pierwszym, OSTATNI po domknięciu.
                ev["is_start_of_package"] = e_id in single_start_ids
                if e_id in single_last_ids:
                    ev["billing_flag"] = "LAST"
                # Numer na kafelek od razu (pozycja w cyklu).
                if e_id in event_positions:
                    ev["tile_number"] = event_positions[e_id]
                    
            ev["clients"]["has_active_billing_or_history"] = has_active_or_history
            # Szuflada chowa przyciski startu na domkniętych pakietach/cyklach.
            ev["in_closed_cycle"] = e_id in closed_ids

    pmap = _partner_names(supabase, events)
    for ev in events:
        pid = ev.get("partner_client_id")
        if pid and str(pid) in pmap:
            ev["partner_name"] = pmap[str(pid)]

    return events



@router.get("/", response_model=List[CalendarEventResponse])
def list_events(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    billing: bool = True,
    include_deleted: bool = False,
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

    if not include_deleted:
        query = query.neq('status', 'deleted')
    events, page = [], 0
    while True:
        rows = query.order('event_date').order('event_hour').order('id').range(page*1000, (page+1)*1000-1).execute().data or []
        events.extend(rows)
        if len(rows) < 1000:
            break
        page += 1
    return assign_chronological_numbers(events, supabase) if billing else events


@router.get("/week/{monday_date}", response_model=List[CalendarEventResponse])
def get_week_events(monday_date: str, request: Request):
    """Get events from Monday to Saturday of a given week."""
    from datetime import datetime, timedelta
    import httpx as _httpx
    monday = datetime.strptime(monday_date, "%Y-%m-%d").date()
    saturday = monday + timedelta(days=5)

    supabase, _ = get_user_supabase(request)

    def _load():
        # Jawna lista kolumn zamiast * (lżejszy transfer niż pełne wiersze).
        res = (
            supabase.table("calendar_events")
            .select("id,client_id,event_date,event_hour,status,is_settled,partner_client_id,note,main_group,added_groups,is_replacement,replaced_client_id,workout_type_id,plan_id,created_at,updated_at,clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count), workout_types(name), training_plans(name)")
            .gte("event_date", monday.isoformat())
            .lte("event_date", saturday.isoformat())
            .order("event_date,event_hour")
            .execute()
        )
        events = res.data or []
        out = assign_chronological_numbers(events, supabase)
        return out

    try:
        return supabase_retry(_load)
    except _httpx.TransportError:
        raise HTTPException(502, "Baza chwilowo nie odpowiada (Supabase). Spróbuj ponownie.")


@router.get("/week-summary/{monday_date}")
def get_week_summary(monday_date: str, request: Request):
    """2.0: podsumowanie tygodnia pon–nd dla Strefy Trenera.

    Zwraca WSZYSTKIE zapisy (takze usuniete — widac odwolania) + absencje
    z zakresu. Statusy interpretuje frontend (odbyty/planowany/odwolany).
    """
    from datetime import datetime, timedelta
    try:
        monday = datetime.strptime(monday_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Zly format daty (RRRR-MM-DD)")
    sunday = monday + timedelta(days=6)

    supabase, user_id = get_user_supabase(request)
    evs = supabase.table("calendar_events") \
        .select("id,client_id,event_date,event_hour,status,is_settled,partner_client_id,clients!calendar_events_client_id_fkey(name,billing_type,package_size,package_current_count,package_purchase_date,payment_history),workout_types(name),training_plans(name)") \
        .eq("trainer_id", user_id) \
        .gte("event_date", monday.isoformat()).lte("event_date", sunday.isoformat()) \
        .order("event_date").order("event_hour").execute()
    # Numery pozycji tym samym silnikiem co kalendarz (pule, cykle, historia).
    try:
        numbered = assign_chronological_numbers([e for e in (evs.data or [])], supabase)
        evs = type("R", (), {"data": numbered})()
    except Exception:
        pass
    abss = supabase.table("absences") \
        .select("id,client_id,absence_date,absence_hour,clients(name)") \
        .eq("trainer_id", user_id) \
        .gte("absence_date", monday.isoformat()).lte("absence_date", sunday.isoformat()) \
        .order("absence_date").execute()
    # Twarde usunięcia (Usuń): ślad w podsumowaniu jako wpis „Usunięty".
    try:
        dels = supabase.table("deleted_workouts") \
            .select("id,event_date,event_hour,client_name,workout_type") \
            .eq("trainer_id", user_id) \
            .gte("event_date", monday.isoformat()).lte("event_date", sunday.isoformat()) \
            .order("event_date").order("event_hour").execute()
        removed = [{
            "id": f"del-{d.get('id')}", "client_id": None,
            "event_date": d.get("event_date"), "event_hour": d.get("event_hour"),
            "status": "removed", "is_settled": False, "partner_client_id": None,
            "clients": {"name": d.get("client_name") or "—"},
            "workout_types": {"name": d.get("workout_type")} if d.get("workout_type") else None,
            "training_plans": None,
        } for d in (dels.data or [])]
    except Exception:
        removed = []
    names = {str(e['client_id']): (e.get('clients') or {}).get('name', 'Klient') for e in evs.data if e.get('client_id')}
    names.update({str(a['client_id']): (a.get('clients') or {}).get('name', 'Klient') for a in abss.data})
    names.update(_partner_names(supabase, evs.data))
    classified = session_rows(evs.data, abss.data, names)
    return {
        "session_rows": classified, "session_totals": session_totals(classified),
        "monday": monday.isoformat(), "sunday": sunday.isoformat(),
        "events": (evs.data or []) + removed, "absences": abss.data or [],
    }


@router.get("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def get_event(event_date: str, event_hour: int, request: Request, include_deleted: bool = False):
    supabase, _ = get_user_supabase(request)
    query = (
        supabase.table("calendar_events")
        .select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count), workout_types(name), training_plans(name)")
        .eq("event_date", event_date)
        .eq("event_hour", event_hour)
    )
    if not include_deleted:
        query = query.neq('status','deleted')
    res = query.execute()
    if not res.data:
        raise HTTPException(404, "Event not found")
    events = assign_chronological_numbers([res.data[0]], supabase)
    return events[0]


def _clear_slot_absence(supabase, client_id, event_date: str, event_hour: int):
    """Wpisanie treningu w slot kasuje absencje TEGO klienta w tym slocie.

    FIX 2026-09-07 (Ania): delete_event tworzy absencje przy kazdym usunieciu,
    wiec usuniety + wpisany ponownie trening zostawial wisząca absencje, ktora
    wykluczala trening z numeracji. Wpis = klient wraca = absencja nieaktualna.
    Tylko ten sam klient (cudze odwolania, np. zastepowane, zostaja).
    """
    if not client_id:
        return
    try:
        supabase.table("absences").delete() \
            .eq("client_id", client_id) \
            .eq("absence_date", event_date).eq("absence_hour", event_hour).execute()
    except Exception:
        pass


@router.post("/", response_model=CalendarEventResponse, status_code=201)
def create_or_update_event(data: CalendarEventCreate, request: Request):
    """Upsert: create or replace calendar event."""
    supabase, user_id = get_user_supabase(request)
    payload = data.model_dump(mode='json')
    payload["trainer_id"] = user_id

    try:
        res = supabase.table("calendar_events").upsert(
            payload, on_conflict="event_date,event_hour,trainer_id"
        ).execute()
        _clear_slot_absence(supabase, payload.get("client_id"),
                            payload.get("event_date"), payload.get("event_hour"))
        return res.data[0]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=repr(e))


@router.post("/replace-week")
def replace_week(data: ReplaceWeekRequest, request: Request):
    """Replace a week in one transaction, preserving settled slots and closed anchors."""
    supabase, _ = get_user_supabase(request)
    return atomic_rpc(supabase, "calendar_mutation_v2", {
        "p_action": "replace_week", "p_data": data.model_dump(mode="json"),
    })

@router.delete("/clear-week/{monday_date}")
def clear_week(monday_date: str, request: Request):
    supabase, _ = get_user_supabase(request)
    from datetime import date
    try:
        monday = date.fromisoformat(monday_date)
        if monday.weekday() != 0:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, "Wskaż poniedziałek w formacie RRRR-MM-DD")
    return atomic_rpc(supabase, "calendar_mutation_v2", {
        "p_action": "clear_week", "p_data": {"monday_date": monday.isoformat()},
    })

@router.put("/{event_date}/{event_hour}", response_model=CalendarEventResponse)
def update_event(event_date: str, event_hour: int, data: CalendarEventUpdate, request: Request):
    supabase, _ = get_user_supabase(request)
    payload = data.model_dump(exclude_unset=True, mode='json')
    if any(payload.get(k) is None for k in ("status", "is_settled", "is_replacement") if k in payload):
        raise HTTPException(422, "Status i pola logiczne nie mogą być puste")
    payload["updated_at"] = utcnow_iso()

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
    """Move or swap calendar rows and logs in one database transaction."""
    supabase, _ = get_user_supabase(request)
    return atomic_rpc(supabase, "calendar_mutation_v2", {
        "p_action": "swap", "p_data": data.model_dump(mode="json"),
    })

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
    """2.0: prymityw 'oplacone' — uzywany WYLACZNIE przez sciezke platnego
    odwolania (usuniecie/nieobecnosc z platnoscia). Nie sluzy do rozliczania
    odbytych treningow (te licza sie pozycyjnie)."""
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
    """Usuń = TWARDE usunięcie wiersza z bazy (przypadek/test). Licznik pakietu
    przelicza się sam (SSOT dynamiczny). Bez pytania o płatność, bez śladu
    w kalendarzu (ślad tylko w deleted_workouts + wpisie Usunięty w tygodniu).
    Kotwica aktywnego pakietu → 400 (przepływ delete-start)."""
    supabase, user_id = get_user_supabase(request)

    ev = supabase.table("calendar_events").select("*,clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count),workout_types(name),training_plans(name)").eq("event_date", event_date).eq("event_hour", event_hour).execute()

    if not (ev.data and len(ev.data) > 0):
        raise HTTPException(404, "Workout not found in calendar")
    event = ev.data[0]
    if _active_pool_package_at(supabase, event) is not None or _any_active_anchor(supabase, event):
        raise HTTPException(400, "Trening jest początkiem aktywnego pakietu — odśwież szufladę i użyj opcji początku pakietu.")
    _hard_delete(supabase, user_id, event, event_date, event_hour)
    return {"status": "deleted"}


def _event_in_closed_range(supabase, event_id):
    """Czy trening leży w DOMKNIĘTYM pakiecie/cyklu? Ten sam silnik co flaga
    w szufladzie (assign) — jeden wynik w obu miejscach."""
    try:
        res = supabase.table("calendar_events") \
            .select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count, package_purchase_date, payment_history)") \
            .eq("id", event_id).single().execute()
        if not res.data:
            return False
        out = assign_chronological_numbers([res.data], supabase)
        return bool(out and out[0].get("in_closed_cycle"))
    except Exception:
        return False


def _any_active_anchor(supabase, event):
    """Czy KTOKOLWIEK aktywny pakiet startuje w tym evencie (bez patrzenia
    na członków puli)? Siatka bezpieczeństwa przed cichym FK-500."""
    try:
        res = supabase.table("client_packages").select("id,start_training_id,end_training_id").execute()
        for p in (res.data or []):
            if p.get("end_training_id") is None and str(p.get("start_training_id")) == str(event.get("id")):
                return True
    except Exception:
        raise HTTPException(503, "Nie udało się sprawdzić powiązań pakietu. Spróbuj ponownie.")
    return False


def _hard_delete(supabase, user_id, event, event_date, event_hour):
    """The transaction checks anchors BEFORE changing any dependent data."""
    atomic_rpc(supabase, "calendar_mutation_v2", {
        "p_action": "delete", "p_data": {"event_date": event_date, "event_hour": event_hour},
    })
    return "deleted"


class DeleteStartRequest(BaseModel):
    paid: bool = False
    mode: str = "probe"  # probe | cancel | repoint
    new_event_id: Optional[str] = None


def _active_pool_package_at(supabase, event):
    """Aktywny pakiet zakotwiczony w danym evencie (owner lub członek puli)."""
    if not event or not event.get("id"):
        return None
    try:
        res = supabase.table("client_packages").select("*").is_("end_training_id", None).execute()
    except Exception:
        return None
    for p in (res.data or []):
        if str(p.get("start_training_id")) != str(event.get("id")):
            continue
        members = [str(p.get("client_id"))] + [
            str(x) for x in (p.get("shared_client_ids") or [])]
        if str(event.get("client_id")) in members:
            return p
    return None


def _package_future_trainings(supabase, pkg, event):
    """Policzalne treningi pakietu po usuwanym evencie (do repoint/cancel)."""
    members = [str(pkg.get("client_id"))] + [
        str(x) for x in (pkg.get("shared_client_ids") or [])]
    try:
        res = supabase.table("calendar_events") \
            .select("id,client_id,event_date,event_hour,status,is_settled") \
            .in_("client_id", members).execute()
    except Exception:
        return []
    old_key = (str(event.get("event_date")), int(event.get("event_hour") or 0))
    out = []
    for e in (res.data or []):
        if str(e.get("id")) == str(event.get("id")):
            continue
        if e.get("status") == "deleted":
            continue
        key = (str(e.get("event_date")), int(e.get("event_hour") or 0))
        if key <= old_key:
            continue
        if e.get("status") == "cancelled" and not e.get("is_settled"):
            continue
        out.append(e)
    out.sort(key=lambda e: (str(e.get("event_date")), int(e.get("event_hour") or 0)))
    return out


@router.post("/{event_date}/{event_hour}/delete-start")
def delete_package_start(event_date: str, event_hour: int, data: DeleteStartRequest, request: Request):
    supabase, user_id = get_user_supabase(request)
    if data.mode not in {"probe", "cancel", "repoint"}:
        raise HTTPException(422, "Nieznany tryb")
    if data.mode != "probe":
        return atomic_rpc(supabase, "calendar_mutation_v2", {
            "p_action": "delete_start",
            "p_data": {"event_date": event_date, "event_hour": event_hour,
                       "mode": data.mode, "new_event_id": data.new_event_id},
        })
    res = supabase.table("calendar_events").select("*").eq(
        "event_date", event_date).eq("event_hour", event_hour).eq("trainer_id", user_id).execute()
    if not res.data:
        raise HTTPException(404, "Workout not found in calendar")
    event = res.data[0]
    pkg = _active_pool_package_at(supabase, event)
    if pkg is None:
        return {"is_package_start": False}
    future = _package_future_trainings(supabase, pkg, event)
    nxt = future[0] if future else None
    return {
        "is_package_start": True, "package_id": pkg["id"], "package_size": pkg.get("size") or 10,
        "shared_with": pkg.get("shared_client_ids") or [], "future_count": len(future),
        "next_event": {k: nxt[k] for k in ("id", "event_date", "event_hour")} if nxt else None,
    }


@router.delete("/events/{event_date}/{event_hour}/hard")
def hard_delete_event(event_date: str, event_hour: int, request: Request):
    """Legacy alias uses the same checks and transaction as the regular delete."""
    return delete_event(event_date, event_hour, request)
