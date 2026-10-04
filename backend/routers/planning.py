"""Owner-scoped planning facts and durable, idempotent analysis snapshots."""
from datetime import datetime
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from database import get_user_supabase, get_supabase, atomic_rpc
from billing import WARSAW
from billing_data import read_all
from trainer_planning import PlanningPreferences, analyze, default_preferences, history_context, periods

router = APIRouter(prefix='/trainer/planning', tags=['trainer-planning'])


class PreferencesWrite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    preferences: PlanningPreferences
    expected_revision: int = Field(ge=0, strict=True)


class AnalysisWrite(PreferencesWrite):
    request_id: UUID
    months: Literal[3, 6]
    answers: dict[str, str] = Field(default_factory=dict, max_length=40)
    save_preferences: StrictBool = False


def read_preferences(db, actor):
    try:
        rows = db.table('trainer_planning_preferences').select('preferences,revision').eq('trainer_id', actor).limit(1).execute().data or []
        if rows:
            return {'preferences': PlanningPreferences.model_validate(rows[0]['preferences']).model_dump(mode='json'), 'revision': rows[0]['revision']}
        return {'preferences': default_preferences(), 'revision': 0}
    except Exception as exc:
        raise HTTPException(503, 'Preferencje planowania są niedostępne. Spróbuj ponownie.') from exc


def owned_clients(db, actor):
    return read_all(lambda: db.table('clients').select('id,name').eq('trainer_id', actor))


def check_clients(preferences, clients):
    if not set(preferences['locked_client_ids']).issubset({str(c['id']) for c in clients}):
        raise HTTPException(404, 'Nie znaleziono wskazanego klienta.')


def facts(db, actor, months, now):
    start, _, _, end = periods(months, now)
    return read_all(lambda: db.table('calendar_events').select('id,event_date,event_hour,status,client_id,partner_client_id,is_settled')
                    .eq('trainer_id', actor).gte('event_date', start.isoformat()).lte('event_date', end.isoformat()))


def snapshot(row):
    return {key: row[key] for key in ('id', 'created_at', 'months', 'preferences', 'answers', 'questions', 'result') if key in row}


def saved_request(db, actor, request_id):
    rows = db.table('trainer_planning_analyses').select('*').eq('trainer_id', actor).eq('id', str(request_id)).limit(1).execute().data or []
    return rows[0] if rows else None


@router.get('/preferences')
def get_preferences(request: Request):
    db, actor = get_user_supabase(request)
    return read_preferences(db, actor)


@router.put('/preferences')
def put_preferences(data: PreferencesWrite, request: Request):
    db, actor = get_user_supabase(request)
    prefs = data.preferences.model_dump(mode='json')
    try:
        check_clients(prefs, owned_clients(db, actor))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, 'Nie udało się zweryfikować klientów.') from exc
    return atomic_rpc(db, 'save_trainer_planning_preferences_v1', {'p_preferences': prefs, 'p_expected_revision': data.expected_revision})


@router.get('/context')
def get_context(request: Request, months: int = Query(3)):
    if months not in (3, 6):
        raise HTTPException(422, 'Wybierz 3 albo 6 miesięcy.')
    db, actor = get_user_supabase(request)
    now = datetime.now(WARSAW)
    try:
        preferences = read_preferences(db, actor)
        clients = owned_clients(db, actor)
        report = history_context(facts(db, actor, months, now), months, now)
        last = db.table('trainer_planning_analyses').select('answers').eq('trainer_id', actor).order('created_at', desc=True).limit(1).execute().data or []
        valid_ids = {q['id'] for q in report['questions']}
        return {**report, **preferences, 'clients': clients,
                'last_answers': {k: v for k, v in (last[0]['answers'] if last else {}).items() if k in valid_ids}}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, 'Nie udało się odczytać pełnych danych planowania. Spróbuj ponownie.') from exc


@router.post('/analyses')
def create_analysis(data: AnalysisWrite, request: Request):
    db, actor = get_user_supabase(request)
    payload = data.model_dump(mode='json')
    try:
        existing = saved_request(db, actor, data.request_id)
        if existing:
            if existing['request_payload'] != payload:
                raise HTTPException(409, 'Ten identyfikator analizy został już użyty z innymi odpowiedziami.')
            return snapshot(existing)
        current = read_preferences(db, actor)
        if current['revision'] != data.expected_revision:
            raise HTTPException(409, 'Preferencje zmieniły się. Odśwież je przed analizą.')
        clients = owned_clients(db, actor)
        preferences = payload['preferences']
        check_clients(preferences, clients)
        now = datetime.now(WARSAW)
        result, answers = analyze(facts(db, actor, data.months, now), clients, data.months, preferences, data.answers, now)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, 'Nie udało się odczytać pełnych danych. Analiza nie została zapisana.') from exc
    value = {'months': data.months, 'preferences': result.pop('effective_preferences'), 'answers': answers,
             'questions': result.pop('questions'), 'result': result}
    # Only this server-side transaction uses service authority. Identity, all facts and
    # replay reads above are still authenticated and RLS-scoped; no client-supplied result.
    row = atomic_rpc(get_supabase(), 'save_trainer_planning_analysis_v1', {'p_actor': actor, 'p_request': payload, 'p_snapshot': value})
    return snapshot(row)


@router.get('/analyses')
def get_analyses(request: Request):
    db, actor = get_user_supabase(request)
    try:
        rows = db.table('trainer_planning_analyses').select('id,created_at,months,goal').eq('trainer_id', actor).order('created_at', desc=True).limit(50).execute().data or []
        return {'items': rows}
    except Exception as exc:
        raise HTTPException(503, 'Historia analiz jest niedostępna.') from exc


@router.get('/analyses/{analysis_id}')
def get_analysis(analysis_id: UUID, request: Request):
    db, actor = get_user_supabase(request)
    try:
        row = saved_request(db, actor, analysis_id)
    except Exception as exc:
        raise HTTPException(503, 'Nie udało się odczytać analizy.') from exc
    if row is None:
        raise HTTPException(404, 'Nie znaleziono analizy.')
    return snapshot(row)
