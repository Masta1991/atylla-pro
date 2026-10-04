"""Deterministic, read-only planning. History is evidence, never client consent."""
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from datetime import date as CalendarDate
from statistics import median
from itertools import combinations
from typing import Annotated, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator
from billing import WARSAW


class ProtectedWindow(BaseModel):
    model_config = ConfigDict(extra='forbid')
    weekday: Optional[int] = Field(default=None, ge=0, le=6, strict=True)
    date: Optional[CalendarDate] = None
    start_hour: int = Field(ge=6, le=21, strict=True)
    end_hour: int = Field(ge=7, le=22, strict=True)

    @model_validator(mode='after')
    def valid_window(self):
        if (self.weekday is None) == (self.date is None) or self.end_hour <= self.start_hour:
            raise ValueError('Okno wymaga dnia tygodnia albo daty oraz poprawnych godzin.')
        return self


class PlanningPreferences(BaseModel):
    model_config = ConfigDict(extra='forbid')
    start_hour: int = Field(default=6, ge=6, le=21, strict=True)
    session_minutes: Literal[60] = 60
    start_on_hour: StrictBool = True
    goal: Literal['balance', 'time', 'income'] = 'balance'
    max_consecutive: Optional[int] = Field(default=None, ge=1, le=16, strict=True)
    end_hour: Optional[int] = Field(default=None, ge=7, le=22, strict=True)
    allowed_weekdays: Optional[list[Annotated[int, Field(strict=True)]]] = Field(default=None, max_length=7)
    protected_windows: list[ProtectedWindow] = Field(default_factory=list, max_length=100)
    locked_client_ids: list[UUID] = Field(default_factory=list, max_length=1000)
    session_price: Optional[float] = Field(default=None, ge=0, le=10000, allow_inf_nan=False)

    @field_validator('session_minutes', 'session_price', mode='before')
    @classmethod
    def strict_numbers(cls, value):
        if value is not None and (type(value) not in (int, float)):
            raise ValueError('Wpisz liczbę.')
        return value

    @model_validator(mode='after')
    def valid_preferences(self):
        if not self.start_on_hour or (self.end_hour is not None and self.end_hour <= self.start_hour):
            raise ValueError('Kalendarz obsługuje pełne godziny; koniec musi być później niż początek.')
        if self.allowed_weekdays is not None and (any(type(d) is not int or d not in range(7) for d in self.allowed_weekdays)
                                                   or len(set(self.allowed_weekdays)) != len(self.allowed_weekdays)):
            raise ValueError('Dni tygodnia muszą być różnymi liczbami od 0 do 6.')
        if len(set(self.locked_client_ids)) != len(self.locked_client_ids):
            raise ValueError('Powtórzony klient.')
        return self


def default_preferences():
    return PlanningPreferences().model_dump(mode='json')


def periods(months, now=None):
    if months not in (3, 6):
        raise ValueError('Wybierz 3 albo 6 miesięcy.')
    now = now or datetime.now(WARSAW)
    current = now.date().replace(day=1)
    index = current.year * 12 + current.month - 1 - months
    start = date(index // 12, index % 12 + 1, 1)
    return start, current - timedelta(days=1), now.date(), now.date() + timedelta(days=27)


def members(event):
    return sorted({str(v) for v in (event.get('client_id'), event.get('partner_client_id')) if v})


def normalized_events(events):
    by_id = {}
    for item in events:
        event = dict(item)
        event['id'] = str(event['id'])
        event['event_date'] = date.fromisoformat(str(event['event_date'])).isoformat()
        hour = event['event_hour']
        if type(hour) is not int or not 6 <= hour <= 21:
            raise ValueError('Nieprawidłowa godzina wpisu kalendarza.')
        previous = by_id.get(event['id'])
        if previous is not None and previous != event:
            raise ValueError('Niespójna historia kalendarza. Odśwież analizę.')
        by_id[event['id']] = event
    return list(by_id.values())


def occupied(event):
    return event.get('status') not in ('cancelled', 'deleted')


def is_session(event):
    return event.get('status') == 'active' and bool(members(event))


def internal_windows(rows):
    sessions = sorted({e['event_hour'] for e in rows if is_session(e)})
    taken = {e['event_hour'] for e in rows if occupied(e)}
    windows = []
    if len(sessions) < 2:
        return windows
    start = None
    for hour in range(sessions[0] + 1, sessions[-1] + 1):
        if hour not in taken and start is None:
            start = hour
        if hour in taken and start is not None:
            windows.append((start, hour))
            start = None
    return windows


def history_context(events, months, now=None, excluded_months=None, pattern_limit=24):
    now = now or datetime.now(WARSAW)
    start, end, _, _ = periods(months, now)
    grouped = defaultdict(list)
    for event in normalized_events(events):
        if start.isoformat() <= event['event_date'] <= end.isoformat():
            grouped[event['event_date']].append(event)
    counts, observed, month_days = Counter(), Counter(), defaultdict(set)
    month_sessions = Counter()
    sessions, gap_hours, ambiguous = 0, 0, 0
    for day, rows in grouped.items():
        active = [r for r in rows if is_session(r)]
        if not active:
            continue
        sessions += len({r['event_hour'] for r in active})
        month_sessions[day[:7]] += len({r['event_hour'] for r in active})
        weekday = date.fromisoformat(day).weekday()
        observed[weekday] += 1
        month_days[day[:7]].add(day)
        hours = [r['event_hour'] for r in rows if occupied(r)]
        if len(hours) != len(set(hours)):
            ambiguous += 1
            continue
        for begin, finish in internal_windows(rows):
            if day[:7] not in (excluded_months or []):
                counts[(weekday, begin, finish)] += 1
            gap_hours += finish - begin
    pattern_observed = Counter(date.fromisoformat(day).weekday() for day, rows in grouped.items()
                               if day[:7] not in (excluded_months or []) and any(is_session(e) for e in rows))
    patterns = [{'id': f'gap:{d}:{s}:{e}', 'weekday': d, 'start_hour': s, 'end_hour': e,
                 'hits': n, 'observed_days': pattern_observed[d]}
                for (d, s, e), n in sorted(counts.items(), key=lambda item: (-item[1], item[0])) if n >= 2]
    # Bounded questions: the most recurrent patterns, all missing/sparse months.
    patterns = patterns[:pattern_limit]
    labels = ['poniedziałki', 'wtorki', 'środy', 'czwartki', 'piątki', 'soboty', 'niedziele']
    questions = [{'id': p['id'], 'text': f"W {labels[p['weekday']]} powtarza się okno {p['start_hour']:02}:00–{p['end_hour']:02}:00. Czy chcesz je zachować?",
                  'options': [{'value': 'preserve', 'label': 'Zachowaj przerwę'}, {'value': 'optimize', 'label': 'Można wykorzystać'},
                              {'value': 'unknown', 'label': 'Jeszcze nie wiem'}]} for p in patterns]
    cursor = start
    typical_sessions = median(month_sessions.values()) if month_sessions else 0
    while cursor <= end:
        key = cursor.strftime('%Y-%m')
        count = len(month_days[key])
        if count < 4 or month_sessions[key] < typical_sessions * .5:
            questions.append({'id': 'month:' + key,
                              'text': f'{key}: {count} dni i {month_sessions[key]} zapisanych treningów. Czy ten miesiąc jest typowy?',
                              'options': [{'value': 'vacation', 'label': 'Urlop / celowo mniej pracy'}, {'value': 'incomplete', 'label': 'Niepełna historia'},
                                          {'value': 'typical', 'label': 'Tak wyglądał ten miesiąc'}, {'value': 'unknown', 'label': 'Nie wiem'}]})
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    warnings = ['Historia pokazuje zapisane godzinne sloty, nie potwierdza dostępności ani zgody klientów. Brak wpisów nie oznacza wolnego terminu.']
    if any(q['id'].startswith('month:') for q in questions):
        warnings.append('Część miesięcy ma mało zapisów. Wzorce mogą nie przedstawiać typowego grafiku.')
    if grouped:
        warnings.append('Pierwszy miesiąc w wybranym zakresie może zawierać tylko część historii; liczba wpisów nie potwierdza kompletności.')
    if ambiguous:
        warnings.append(f'Pominięto okienka z {ambiguous} dni z nakładającymi się zapisami.')
    return {'range': {'from': start.isoformat(), 'to': end.isoformat()},
            'stats': {'sessions': sessions, 'days': sum(observed.values()), 'internal_gap_hours': gap_hours},
            'patterns': patterns, 'questions': questions, 'warnings': warnings}


def validated_answers(answers, questions):
    allowed = {q['id']: {o['value'] for o in q['options']} for q in questions}
    if any(k not in allowed or value not in allowed[k] for k, value in answers.items()):
        raise ValueError('Pytania zmieniły się. Odśwież kontekst i odpowiedz ponownie.')
    return {q['id']: answers.get(q['id'], 'unknown') for q in questions}


def analyze(events, clients, months, preferences, answers, now=None):
    now = now or datetime.now(WARSAW)
    prefs = PlanningPreferences.model_validate(preferences).model_dump(mode='json')
    events = normalized_events(events)
    context = history_context(events, months, now)
    answers = validated_answers(answers, context['questions'])
    original_questions = context['questions']
    original_patterns = history_context(events, months, now, pattern_limit=None)['patterns']
    excluded_months = sorted(k.removeprefix('month:') for k, v in answers.items() if k.startswith('month:') and v in ('vacation', 'incomplete'))
    if excluded_months:
        filtered = history_context(events, months, now, excluded_months)
        context['patterns'] = filtered['patterns']
        context['warnings'].append('Ze wzorców typowego grafiku wyłączono wskazane miesiące: ' + ', '.join(excluded_months) + '. Statystyki obejmują cały zakres.')
    _, _, target_start, target_end = periods(months, now)
    names = {str(c['id']): c['name'] for c in clients}
    locked = set(prefs['locked_client_ids'])
    if not locked.issubset(names):
        raise ValueError('Nie znaleziono wskazanego klienta.')
    windows = list(prefs['protected_windows'])
    for pattern in original_patterns:
        if answers.get(pattern['id'], 'unknown') == 'preserve':
            window = {k: pattern[k] for k in ('weekday', 'start_hour', 'end_hour')}
            window['date'] = None
            if window not in prefs['protected_windows']:
                prefs['protected_windows'].append(window)
        if answers.get(pattern['id'], 'unknown') != 'optimize':
            windows.append({k: pattern[k] for k in ('weekday', 'start_hour', 'end_hour')})
    # Existing explicit protection is never removed by an "optimize" response.
    if len(prefs['protected_windows']) > 100:
        raise ValueError('Za dużo chronionych okien. Uporządkuj preferencje przed zapisaniem.')
    grouped = defaultdict(list)
    for event in events:
        if target_start.isoformat() <= event['event_date'] <= target_end.isoformat():
            grouped[event['event_date']].append(event)

    def future(day, hour):
        return datetime.combine(date.fromisoformat(day), time(hour), WARSAW) > now

    def protected(day, hour):
        weekday = date.fromisoformat(day).weekday()
        return any((w.get('date') == day or (w.get('date') is None and w.get('weekday') == weekday))
                   and w['start_hour'] <= hour < w['end_hour'] for w in windows)

    def allowed_day(day, hours, session_hours):
        weekday = date.fromisoformat(day).weekday()
        if weekday == 6 or (prefs['allowed_weekdays'] is not None and weekday not in prefs['allowed_weekdays']):
            return False
        if any(h < prefs['start_hour'] or h + 1 > (prefs['end_hour'] or 22) for h in hours):
            return False
        if any(protected(day, h) for h in session_hours):
            return False
        run, previous = 0, None
        for hour in sorted(session_hours):
            run = run + 1 if previous == hour - 1 else 1
            previous = hour
            if prefs['max_consecutive'] is not None and run > prefs['max_consecutive']:
                return False
        return True

    proposals, skipped = [], 0
    for day, rows in sorted(grouped.items()):
        taken = [r for r in rows if occupied(r)]
        hours = [r['event_hour'] for r in taken]
        sessions = [r for r in taken if is_session(r) and all(c in names for c in members(r))]
        if len(hours) != len(set(hours)):
            skipped += 1
            continue
        if len(sessions) < 2:
            continue
        before_end = max(hours) + 1
        holes = [h for begin, end in internal_windows(rows) for h in range(begin, end)
                 if future(day, h) and not protected(day, h)]
        evidence_patterns = [p for p in context['patterns'] if p['weekday'] == date.fromisoformat(day).weekday()]
        evidence = ('Historia: ' + ', '.join(f"{p['start_hour']:02}:00–{p['end_hour']:02}:00: {p['hits']}/{p['observed_days']} dni" for p in evidence_patterns)) if evidence_patterns else 'Wariant wynika z konkretnych przyszłych wpisów; historia nie potwierdza powtarzalnego wzorca.'
        if prefs['goal'] != 'income':
            best = None
            ordered_sessions = sorted(sessions, key=lambda e: e['event_hour'])
            # A bounded two-session chain is useful only if it beats the best single move.
            # Keep relative session order; history is not a source of client availability.
            for count in (1, 2):
                moving = ordered_sessions[-count:]
                if len(moving) < count or any(not future(day, e['event_hour']) or protected(day, e['event_hour'])
                                               or locked.intersection(members(e)) for e in moving):
                    continue
                source_hours = {e['event_hour'] for e in moving}
                for targets in combinations(holes, count):
                    if any(target >= e['event_hour'] for e, target in zip(moving, targets)):
                        continue
                    after_hours = [h for h in hours if h not in source_hours] + list(targets)
                    after_sessions = [e['event_hour'] for e in sessions if e['event_hour'] not in source_hours] + list(targets)
                    if not allowed_day(day, after_hours, after_sessions):
                        continue
                    after_end = max(after_hours) + 1
                    saved = (before_end-after_end)*60
                    if saved <= 0 or (best is not None and saved <= best['saved_minutes']):
                        continue
                    participant_ids = sorted({c for e in moving for c in members(e)})
                    moves = [{'event_id': e['id'], 'client_ids': members(e), 'names': [names[c] for c in members(e)],
                              'from_date': day, 'from_hour': e['event_hour'], 'to_date': day, 'to_hour': hour}
                             for e, hour in zip(moving, targets)]
                    best = {'id': 'move:' + ':'.join(f"{m['event_id']}@{m['to_hour']}" for m in moves), 'kind': 'move', 'date': day,
                            'clients': [{'id': c, 'name': names[c]} for c in participant_ids], 'moves': moves,
                            'before_end': before_end, 'after_end': after_end, 'saved_minutes': saved,
                            'additional_sessions': 0, 'additional_revenue': None,
                            'reason': ('Przeniesienie ostatniej sesji' if count == 1 else 'Wspólne przeniesienie dwóch końcowych sesji')
                                      + ' do wewnętrznych okien skraca dzień. Uzgodnij cały wariant ze wszystkimi uczestnikami.',
                            'evidence': evidence, 'status': 'do_uzgodnienia'}
            if best:
                proposals.append(best)
        if prefs['goal'] != 'time':
            for hour in holes:
                if not allowed_day(day, hours + [hour], [e['event_hour'] for e in sessions] + [hour]):
                    continue
                proposals.append({'id': f'income:{day}:{hour}', 'kind': 'income', 'date': day,
                                  'clients': [], 'moves': [], 'slot': {'date': day, 'hour': hour},
                                  'before_end': before_end, 'after_end': before_end, 'saved_minutes': 0,
                                  'additional_sessions': 1, 'additional_revenue': prefs['session_price'],
                                  'reason': 'Miejsce na jedną dodatkową godzinną sesję, jeśli znajdzie się dostępny klient. Przychód przed kosztami, nie prognoza.',
                                  'evidence': evidence, 'status': 'do_uzgodnienia'})
                break
    warnings = list(context['warnings'])
    warnings.append('Propozycje są oddzielnymi wariantami, nie łącz ich automatycznie. Przed zmianą sprawdź aktualny kalendarz i zgodę uczestników.')
    warnings.append('Propozycje respektują obecny kalendarz: poniedziałek–sobota, starty 06:00–21:00 i sesje godzinne. Nie oznacza to ustalonych godzin pracy trenera.')
    if any(answers.get(p['id'], 'unknown') == 'unknown' for p in original_patterns):
        warnings.append('Nierozstrzygnięte powtarzalne okna pozostają chronione do czasu odpowiedzi.')
    if skipped:
        warnings.append(f'Pominięto {skipped} przyszłych dni z nakładającymi się wpisami.')
    if not proposals:
        warnings.append('Brak propozycji spełniających obecne ograniczenia. To nie oznacza braku możliwych zmian po rozmowie z klientami.')
    return {**context, 'questions': original_questions,
            'target_range': {'from': target_start.isoformat(), 'to': target_end.isoformat()},
            'excluded_months': excluded_months, 'effective_preferences': prefs,
            'proposals': proposals[:56], 'warnings': warnings, 'engine_version': 1}, answers
