"""Read-only session facts. No package counters, exercise rows or schedule templates."""
from datetime import date, datetime, timedelta
from billing import WARSAW, slot_done

STATES = ('done', 'planned', 'paid', 'free', 'unknown')


def participants(event):
    return {str(x) for x in (event.get('client_id'), event.get('partner_client_id')) if x}


def session_rows(events, absences, names, now=None):
    now = now or datetime.now(WARSAW)
    events = list({str(e['id']): e for e in events}.values())
    absences = list({(str(a['client_id']), str(a['absence_date']), a.get('absence_hour')): a for a in absences}.values())
    rows, matched = [], set()
    for ev in events:
        day, hour = str(ev['event_date']), int(ev['event_hour'])
        members = participants(ev)
        links = [a for a in absences if str(a['client_id']) in members and str(a['absence_date']) == day
                 and (a.get('absence_hour') is None or a['absence_hour'] == hour)]
        status = ev.get('status')
        if status == 'active':
            state = 'done' if slot_done(day, hour, now) else 'planned'
        elif status == 'cancelled':
            state = 'paid' if ev.get('is_settled') else 'free'
        elif status == 'deleted':
            state = 'free' if links else 'removed'
        else:
            state = 'unknown'
        if state in ('paid', 'free'):
            matched.update(str(a['id']) for a in links)
        if state == 'removed':
            continue
        rows.append({'id': str(ev['id']), 'event_id': str(ev['id']), 'date': day, 'hour': hour,
                     'client_ids': sorted(members), 'name': ' + '.join(names.get(c, 'Usunięty klient') for c in sorted(members)),
                     'state': state, 'is_session': True,
                     'ended': slot_done(day, hour, now), 'detail': ''})
    # An unmatched declaration has no durable payment decision. Never infer free/one session.
    for ab in absences:
        if str(ab['id']) in matched:
            continue
        cid, hour = str(ab['client_id']), ab.get('absence_hour')
        rows.append({'id': 'absence-' + str(ab['id']), 'event_id': None,
                     'date': str(ab['absence_date']), 'hour': hour, 'client_ids': [cid],
                     'name': names.get(cid, 'Usunięty klient'), 'state': 'unknown', 'is_session': False,
                     'ended': False, 'detail': 'Zgłoszenie całodniowe' if hour is None else 'Brak powiązanego odwołanego treningu'})
    return sorted(rows, key=lambda r: (r['date'], r['hour'] if r['hour'] is not None else -1, r['id']), reverse=True)


def totals(rows):
    out = {state: sum(r['state'] == state for r in rows) for state in STATES}
    out['total'] = sum(out[s] for s in STATES if s != 'unknown')
    out['clients_done'] = len({c for r in rows if r['state'] == 'done' for c in r['client_ids']})
    out['clients_planned'] = len({c for r in rows if r['state'] == 'planned' for c in r['client_ids']})
    past = [r for r in rows if r['is_session'] and r['ended'] and r['state'] in ('done', 'paid', 'free')]
    out['cancellation_rate'] = round(100 * sum(r['state'] != 'done' for r in past) / len(past), 1) if past else None
    return out


def overview(events, absences, clients, year, month, client_id=None, now=None):
    now = now or datetime.now(WARSAW)
    rows = session_rows(events, absences, {str(c['id']): c['name'] for c in clients}, now)
    if client_id:
        rows = [r for r in rows if str(client_id) in r['client_ids']]
    prefix = f'{year:04}-{month:02}'
    current = [r for r in rows if r['date'].startswith(prefix)]
    start = date(year, month, 1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    monday = start - timedelta(days=start.weekday())
    weeks = []
    while monday < next_month:
        end = monday + timedelta(days=6)
        subset = [r for r in current if monday.isoformat() <= r['date'] <= end.isoformat()]
        weeks.append({'from': max(monday, start).isoformat(), 'to': min(end, next_month-timedelta(days=1)).isoformat(), **totals(subset)})
        monday += timedelta(days=7)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end.replace(day=1)
    cutoff = now.day if (year, month) == (now.year, now.month) else 31
    previous_cutoff = min(cutoff, previous_end.day)
    previous = [r for r in rows if previous_start.isoformat() <= r['date'] <= previous_end.replace(day=previous_cutoff).isoformat()
                and (int(r['date'][-2:]) < previous_cutoff or cutoff > previous_end.day
                     or (year, month) != (now.year, now.month) or r['hour'] is None or r['hour'] + 1 <= now.hour)]
    return {'year': year, 'month': month, 'updated_at': now.isoformat(), 'totals': totals(current),
            'previous_done': totals(previous)['done'], 'previous_label': f'{previous_start.isoformat()} – {previous_end.replace(day=previous_cutoff).isoformat()}',
            'months': [{'month': m, **totals([r for r in rows if r['date'].startswith(f'{year:04}-{m:02}')])} for m in range(1,13)],
            'weeks': weeks, 'rows': current,
            'clients': [{'id': str(c['id']), 'name': c['name']} for c in clients]}
