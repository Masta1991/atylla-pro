from datetime import date, datetime, timedelta
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from database import get_user_supabase, atomic_rpc
from billing_data import read_all
from billing import WARSAW
from trainer_insights import overview

router = APIRouter(prefix='/trainer', tags=['trainer'])


def read_facts(db, actor, start, end):
    events = read_all(lambda: db.table('calendar_events').select('id,client_id,partner_client_id,event_date,event_hour,status,is_settled,updated_at,workout_type_id,plan_id,main_group,added_groups,is_replacement,replaced_client_id')
                      .eq('trainer_id', actor).gte('event_date', str(start)).lte('event_date', str(end)))
    absences = read_all(lambda: db.table('absences').select('id,client_id,absence_date,absence_hour')
                        .eq('trainer_id', actor).gte('absence_date', str(start)).lte('absence_date', str(end)))
    return events, absences


@router.get('/overview')
def get_overview(request: Request, year: int = Query(..., ge=2000, le=2100), month: int = Query(..., ge=1, le=12), client_id: Optional[UUID] = None):
    db, actor = get_user_supabase(request)
    clients = read_all(lambda: db.table('clients').select('id,name').eq('trainer_id', actor))
    if client_id and str(client_id) not in {str(c['id']) for c in clients}:
        raise HTTPException(404, 'Nie znaleziono klienta.')
    # Previous December is needed for January's like-for-like comparison.
    events, absences = read_facts(db, actor, date(year-1, 12, 1), date(year, 12, 31))
    return overview(events, absences, clients, year, month, client_id)


def monday_date(value):
    if value.weekday() != 0:
        raise HTTPException(422, 'Wskaż poniedziałek tygodnia.')
    return value


@router.get('/manager')
def manager_data(request: Request, source: date):
    monday_date(source)
    db, actor = get_user_supabase(request)
    clients = read_all(lambda: db.table('clients').select('id,name,training_schedule').eq('trainer_id', actor))
    events, _ = read_facts(db, actor, source, source+timedelta(days=6))
    by_id = {str(c['id']): c for c in clients}
    candidates, scheduled = [], set()
    fields = ('workout_type_id', 'plan_id', 'partner_client_id', 'main_group', 'added_groups')
    for client in clients:
        for entry in client.get('training_schedule') or []:
            try:
                day, hour = int(entry['day']), int(entry['hour'])
            except (KeyError, TypeError, ValueError):
                continue
            if not (0 <= day <= 5 and 6 <= hour <= 21):
                continue
            d = (source+timedelta(days=day)).isoformat()
            key = (str(client['id']), d, hour)
            if key in scheduled:
                continue
            scheduled.add(key)
            # A recurring participant of a pair is represented by the joint session.
            if any(str(e.get('partner_client_id')) == str(client['id']) and e['event_date'] == d
                   and e['event_hour'] == hour and e['status'] != 'deleted' for e in events):
                continue
            ev = next((e for e in events if (str(e.get('client_id')), e['event_date'], e['event_hour']) == key), {})
            candidates.append({'key': 'schedule-' + '|'.join(map(str, key)), 'kind': 'schedule', 'client_id': client['id'],
                               'name': client['name'], 'source_date': d, 'event_hour': hour, **{f: ev.get(f) for f in fields}})
    for ev in events:
        if date.fromisoformat(ev['event_date']).weekday() == 6:
            continue # Main scheduling calendar supports Monday through Saturday.
        if ev['status'] == 'deleted' or (str(ev.get('client_id')), ev['event_date'], ev['event_hour']) in scheduled or not ev.get('client_id'):
            continue
        candidates.append({'key': 'event-' + str(ev['id']), 'kind': 'other', 'client_id': ev['client_id'],
                           'name': by_id.get(str(ev['client_id']), {}).get('name', 'Klient'), 'source_date': ev['event_date'],
                           'event_hour': ev['event_hour'], 'original_client_id': ev.get('replaced_client_id') if ev.get('is_replacement') else None,
                           **{f: ev.get(f) for f in fields}})
    return {'source': source.isoformat(), 'items': sorted(candidates, key=lambda c: (c['source_date'], c['event_hour'], c['name'])),
            'clients': [{'id': c['id'], 'name': c['name']} for c in clients]}


class CopyItem(BaseModel):
    key: str = Field(max_length=200)
    event_date: date
    event_hour: int = Field(ge=6, le=21)
    client_id: UUID
    partner_client_id: Optional[UUID] = None
    workout_type_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    main_group: Optional[str] = Field(default=None, max_length=200)
    added_groups: Optional[List[str]] = Field(default_factory=list, max_length=50)
    replace: bool = False
    fingerprint: Optional[str] = None


class CopyRequest(BaseModel):
    target: date
    items: List[CopyItem] = Field(min_length=1, max_length=96)


def copy_call(request, data, commit):
    monday_date(data.target)
    db, actor = get_user_supabase(request)
    return atomic_rpc(db, 'copy_week_safe_v1', {'p_monday': data.target.isoformat(),
        'p_items': [i.model_dump(mode='json') for i in data.items], 'p_commit': commit})


@router.post('/copy-preview')
def copy_preview(data: CopyRequest, request: Request):
    return copy_call(request, data, False)


@router.post('/copy')
def copy_week(data: CopyRequest, request: Request):
    return copy_call(request, data, True)
