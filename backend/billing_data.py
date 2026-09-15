"""Complete ordered reads for financial projections; never fall back to partial data."""
def read_all(make_query):
    rows, page = [], 0
    while True:
        chunk = make_query().order('id').range(page*1000, (page+1)*1000-1).execute().data or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            return rows
        page += 1


def load_package_boundaries(supabase, packages, events):
    """Resolve missing anchor IDs through the same user-scoped/RLS client.

    Return a lookup source only; callers must not add these rows to a pool.
    Missing/inaccessible anchors and failed reads must still fail visibly.
    """
    by_id = {str(e['id']): e for e in events}
    missing = sorted({str(p[field]) for p in packages
                      for field in ('start_training_id', 'end_training_id')
                      if p.get(field) and str(p[field]) not in by_id})
    for start in range(0, len(missing), 100):
        ids = missing[start:start+100]
        rows = read_all(lambda: supabase.table('calendar_events')
                        .select('id,client_id,event_date,event_hour,status,is_settled')
                        .in_('id', ids))
        by_id.update({str(e['id']): e for e in rows})
    return list(by_id.values())
