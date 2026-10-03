"""Descriptive trainer workload; manual history never changes billing facts."""
from collections import Counter
from datetime import datetime
from math import ceil
from billing import WARSAW, slot_done


def seasonality_report(events, manual, start_year, end_year, first_event_date=None, now=None):
    now = now or datetime.now(WARSAW)
    current = (now.year, now.month)
    counts, observed = Counter(), set()
    for event in {str(e['id']): e for e in events}.values():
        if event.get('status') != 'active' and not (event.get('status') == 'cancelled' and event.get('is_settled')):
            continue
        key = tuple(map(int, str(event['event_date'])[:7].split('-')))
        if key > current:
            continue
        # Planned slots alone do not establish a historical observation.
        if event.get('status') == 'active' and not slot_done(str(event['event_date']), event['event_hour'], now):
            continue
        observed.add(key)
        counts[key] += 1
    overrides = {(r['year'], r['month']): r for r in manual}
    first = tuple(map(int, str(first_event_date)[:7].split('-'))) if first_event_date else None
    cells = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            key = (year, month)
            row = overrides.get(key)
            app_count = counts[key] if key in observed else None
            value = row['training_count'] if row else app_count
            source = 'manual' if row else 'app' if app_count is not None else 'missing'
            partial = key == current or (key == first and not row)
            eligible = key < current and value is not None and not partial
            cells.append({'year': year, 'month': month, 'count': value, 'app_count': app_count,
                          'source': source, 'partial': partial, 'eligible': eligible,
                          'updated_at': row['updated_at'] if row else None})
    complete = [r for r in cells if r['eligible']]
    best = max((r['count'] for r in complete), default=None)
    worst = min((r['count'] for r in complete), default=None)
    years = []
    quiet, busy = Counter(), Counter()
    comparable_years = []
    for year in range(start_year, end_year + 1):
        rows = [r for r in cells if r['year'] == year and r['eligible']]
        total = sum(r['count'] for r in rows)
        years.append({'year': year, 'total': total, 'months': len(rows)})
        if len(rows) == 12 and total > 0 and len({r['count'] for r in rows}) > 1:
            comparable_years.append(year)
            ordered = sorted(r['count'] for r in rows)
            low, high = ordered[2], ordered[-3]
            for row in rows:
                if row['count'] <= low and row['count'] < high:
                    quiet[row['month']] += 1
                if row['count'] >= high and row['count'] > low:
                    busy[row['month']] += 1
    seasons = []
    required = max(2, ceil(len(comparable_years) * 2 / 3))
    for month in range(1, 13):
        rows = [r for r in complete if r['month'] == month]
        seasons.append({'month': month, 'average': round(sum(r['count'] for r in rows) / len(rows), 1) if rows else None,
                        'samples': len(rows), 'quiet_years': quiet[month], 'busy_years': busy[month],
                        'recurring_quiet': quiet[month] >= required, 'recurring_busy': busy[month] >= required})
    return {'start_year': start_year, 'end_year': end_year, 'cells': cells, 'years': years,
            'seasonal': seasons, 'comparable_years': comparable_years,
            'best': [r for r in complete if r['count'] == best],
            'worst': [r for r in complete if r['count'] == worst], 'updated_at': now.isoformat()}
