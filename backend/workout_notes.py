"""Trainer-scoped reminders; notes stay on their original calendar event."""
import re
from billing_data import read_all


def note_text(value):
    return re.sub(r'\[BILLING:[^\]]*\]', '', value or '').strip()


def participants(event):
    return {str(event[key]) for key in ('client_id', 'partner_client_id') if event.get(key)}


def attach_note_reminders(events, supabase):
    active = [event for event in events if event.get('status') == 'active']
    if not active:
        return events
    ids = sorted(set().union(*(participants(event) for event in active)))
    until = max(str(event['event_date']) for event in active)
    sources = {}
    for start in range(0, len(ids), 100):
        batch = ids[start:start + 100]
        for column in ('client_id', 'partner_client_id'):
            rows = read_all(lambda: supabase.table('calendar_events')
                            .select('id,client_id,partner_client_id,event_date,event_hour,note')
                            .in_(column, batch).eq('status', 'active')
                            .is_('note_acknowledged_at', None).neq('note', '')
                            .lte('event_date', until))
            for row in rows:
                if note_text(row.get('note')):
                    sources[str(row['id'])] = row
    ordered = sorted(sources.values(), key=lambda e: (str(e['event_date']), e['event_hour']), reverse=True)
    for event in events:
        key = (str(event['event_date']), event['event_hour'])
        people = participants(event)
        event['pending_notes'] = [dict(source) for source in ordered
                                  if event.get('status') == 'active'
                                  and str(source['id']) != str(event['id'])
                                  and (str(source['event_date']), source['event_hour']) < key
                                  and people & participants(source)]
    return events
