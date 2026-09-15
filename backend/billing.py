"""Pure billing projection. Stored anchors remain facts; effective starts are derived.

A free cancellation never destroys an open package. Its original anchor is kept
as a durable lower boundary, even while no eligible future event exists.
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

WARSAW = ZoneInfo('Europe/Warsaw')


def slot_done(event_date, event_hour, now=None):
    now = now or datetime.now(WARSAW)
    end = datetime.combine(date.fromisoformat(str(event_date)), time(int(event_hour)), WARSAW) + timedelta(hours=1)
    return now >= end


def eligible(event):
    return event.get('status') == 'active' or (
        event.get('status') == 'cancelled' and event.get('is_settled') is True)


def event_key(event):
    return (str(event['event_date']), int(event['event_hour']), str(event['id']))


def project_package(package, events, done=slot_done, stop_before=None, boundary_events=None):
    by_id = {str(e['id']): e for e in events}
    # A legacy anchor can now belong to someone outside the package. It still
    # supplies the stored chronological boundary, never an extra counted row.
    boundaries = {str(e['id']): e for e in (boundary_events or [])}
    boundaries.update(by_id)
    anchor = boundaries.get(str(package['start_training_id']))
    if anchor is None:
        raise ValueError('Brak treningu kotwicy pakietu. Licznik wymaga sprawdzenia danych.')
    end_id = package.get('end_training_id')
    end = boundaries.get(str(end_id)) if end_id else None
    if end_id and end is None:
        raise ValueError('Brak końca zamkniętego pakietu.')
    lower = event_key(anchor)
    upper = event_key(end) if end else None
    offset = package.get('offset') or 0
    count, cancelled = offset, 0
    rows, closed = [], []
    for e in sorted(by_id.values(), key=event_key):
        key = event_key(e)
        if key < lower or (upper and key > upper) or (stop_before and key >= stop_before):
            continue
        if end_id:
            closed.append(e['id'])
        if not eligible(e):
            continue
        paid_absence = e.get('status') == 'cancelled'
        counted = paid_absence or done(e['event_date'], e['event_hour'])
        count += int(counted)
        cancelled += int(paid_absence)
        rows.append({'event': e, 'position': offset + len(rows) + 1,
                     'count': count, 'counted': counted})
    return {'rows': rows, 'count': count, 'cancelled': cancelled,
            'effective_start': rows[0]['event'] if rows else None,
            'pending': not end_id and not rows, 'closed_ids': closed,
            'boundary_date': anchor['event_date']}
