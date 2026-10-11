"""Absence candidates from actual sessions and regular hours, in Warsaw time."""
from datetime import datetime, timedelta
from billing import WARSAW


def build_absence_options(client, events, absences, now=None):
    now = now or datetime.now(WARSAW)
    today = now.date()
    slots = {}
    for offset in range(60):
        day = today + timedelta(days=offset)
        for entry in client.get('training_schedule') or []:
            if not isinstance(entry, dict):
                continue
            try:
                weekday, hour = int(entry['day']), int(entry['hour'])
            except (KeyError, TypeError, ValueError):
                continue
            if weekday == day.weekday() and 6 <= hour <= 21:
                slots[(day.isoformat(), hour)] = None
    by_slot = {(e['event_date'], e['event_hour']): e for e in events}
    cid = str(client['id'])
    for ev in events:
        if cid in (str(ev.get('client_id')), str(ev.get('partner_client_id'))):
            slots[(ev['event_date'], ev['event_hour'])] = ev
    result = []
    for (day, hour) in sorted(slots):
        if day < today.isoformat() or day >= (today + timedelta(days=60)).isoformat():
            continue
        if day == today.isoformat() and hour <= now.hour:
            continue
        ev = by_slot.get((day, hour))
        kind = 'scheduled'
        if ev:
            if cid not in (str(ev.get('client_id')), str(ev.get('partner_client_id'))):
                # A regular hour may have been moved or assigned to somebody else.
                continue
            if ev.get('status') != 'active':
                continue
            kind = 'event'
        elif any(str(a['client_id']) == cid and a['absence_date'] == day
                 and a.get('absence_hour') in (None, hour) for a in absences):
            continue
        result.append({'date': day, 'hour': hour, 'kind': kind,
                       'event_id': ev['id'] if ev else None,
                       'updated_at': ev.get('updated_at') if ev else None,
                       'paired': bool(ev and ev.get('partner_client_id'))})
    return result
