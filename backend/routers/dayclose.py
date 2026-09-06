# Atylla Pro — domknięcie dnia (lokalnie, bez deploya).
# Reguła auto-rozliczenia: trening minął, gdy minęła pełna godzina slotu
# (8:00 -> po 9:01) w strefie Europe/Warsaw. Zatwierdzenie dnia jest
# obowiązkowe: salda w Rozliczeniach spina day-approve (i akcje ręczne),
# a nie samo minięcie czasu. Audyt w istniejącej tabeli day_approvals.

from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from database import get_user_supabase

router = APIRouter(prefix="/day", tags=["day-close"])

WARSAW = ZoneInfo("Europe/Warsaw")


def slot_passed(event_date: str, event_hour: int, now: Optional[datetime] = None) -> bool:
    """Czy minęła pełna godzina slotu (trening 8:00 -> rozliczalny po 9:00,
    zgodnie z decyzją: 9:01 rozliczony). Strefa Europe/Warsaw (serwer chodzi na UTC)."""
    now = now or datetime.now(WARSAW)
    if not isinstance(now, datetime):
        return False
    if now.tzinfo is None:
        now = now.replace(tzinfo=WARSAW)
    y, m, d = (int(x) for x in event_date.split("-"))
    slot_end = datetime(y, m, d, int(event_hour) + 1, 0, 0, tzinfo=WARSAW)
    if int(event_hour) + 1 >= 24:  # slot 23:00 nie występuje (6–21), awaryjnie
        return now.date().isoformat() > event_date
    return now > slot_end


def _day_events(supabase, user_id: str, day: str):
    res = (
        supabase.table("calendar_events")
        .select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)")
        .eq("trainer_id", user_id)
        .eq("event_date", day)
        .neq("status", "deleted")
        .order("event_hour")
        .execute()
    )
    return res.data or []


@router.get("/summary/{day}")
def day_summary(day: str, request: Request):
    """Propozycja domknięcia dnia: settle (czas minął) / leave (reszta)."""
    supabase, user_id = get_user_supabase(request)
    items = []
    counts = {"settle": 0, "leave": 0}
    day_evs = _day_events(supabase, user_id, day)
    pids = {str(ev.get("partner_client_id")) for ev in day_evs if ev.get("partner_client_id")}
    pmap = {}
    if pids:
        try:
            pres = supabase.table("clients").select("id,name").in_("id", list(pids)).execute()
            pmap = {str(r["id"]): r.get("name") for r in (pres.data or [])}
        except Exception:
            pmap = {}
    for ev in day_evs:
        if ev.get("is_settled") or ev.get("status") == "cancelled":
            proposal, reason = "leave", "już rozliczony"
        elif slot_passed(ev["event_date"], ev["event_hour"]):
            proposal, reason = "settle", "czas minął — do rozliczenia"
        else:
            proposal, reason = "leave", "zaplanowany"
        counts[proposal] += 1
        items.append({
            "event_date": ev["event_date"],
            "event_hour": ev["event_hour"],
            "client_id": ev.get("client_id"),
            "client_name": (ev.get("clients") or {}).get("name"),
            "partner_client_id": ev.get("partner_client_id"),
            "partner_name": pmap.get(str(ev.get("partner_client_id"))) if ev.get("partner_client_id") else None,
            "is_settled": bool(ev.get("is_settled")),
            "proposal": proposal,
            "reason": reason,
        })
    # Dzień zatwierdzony wcześniej?
    approved = supabase.table("day_approvals").select("id").eq("trainer_id", user_id).eq("day", day).execute()
    return {"day": day, "items": items, "counts": counts, "approved": bool(approved.data)}


class DayDecision(BaseModel):
    event_date: str
    event_hour: int
    action: str  # settle | return


class DayApproveRequest(BaseModel):
    day: str
    decisions: List[DayDecision]


@router.post("/approve")
def day_approve(payload: DayApproveRequest, request: Request):
    """Zatwierdzenie dnia: settle rozlicza, return usuwa bez rozliczenia + absencja. Zapis audytu."""
    supabase, user_id = get_user_supabase(request)
    applied = []
    for d in payload.decisions:
        if d.action not in ("settle", "return"):
            raise HTTPException(400, f"Nieznana akcja: {d.action}")
        ev = supabase.table("calendar_events").select("id,client_id,is_settled").eq("trainer_id", user_id).eq("event_date", d.event_date).eq("event_hour", d.event_hour).execute()
        rows = ev.data or []
        if not rows:
            continue
        row = rows[0]
        if d.action == "settle":
            if not row.get("is_settled"):
                supabase.table("calendar_events").update({"is_settled": True}).eq("id", row["id"]).execute()
            applied.append({"event_date": d.event_date, "event_hour": d.event_hour, "action": "settle"})
        else:
            supabase.table("calendar_events").update({"status": "deleted"}).eq("id", row["id"]).execute()
            if row.get("client_id"):
                supabase.table("absences").upsert({
                    "client_id": row["client_id"],
                    "absence_date": d.event_date,
                    "absence_hour": d.event_hour,
                    "trainer_id": user_id,
                }, on_conflict="client_id,absence_date,absence_hour").execute()
            applied.append({"event_date": d.event_date, "event_hour": d.event_hour, "action": "return"})
    supabase.table("day_approvals").upsert({
        "trainer_id": user_id,
        "day": payload.day,
        "decisions": [x.model_dump() for x in payload.decisions],
    }, on_conflict="trainer_id,day").execute()
    return {"day": payload.day, "applied": applied, "audited": True}
