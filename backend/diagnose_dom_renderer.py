# -*- coding: utf-8 -*-
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\backend")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database
from routers.calendar import assign_chronological_numbers

client = database.get_supabase()
trainer_id = "520504a4-1a24-4534-aac6-56237ff84f15"
events_july = client.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)").eq("trainer_id", trainer_id).gte("event_date", "2026-07-20").lte("event_date", "2026-07-26").order("event_date").order("event_hour").execute().data
labeled = assign_chronological_numbers(events_july, client)

for e in labeled:
    c = e.get("clients")
    if c and c.get("billing_type") == "package" and e.get("is_settled"):
        has_active = c.get("has_active_billing_or_history")
        cnt = c.get("package_current_count") or 0
        sz = c.get("package_size") or 10
        tile_label = f"{c['name']} [{cnt}/{sz}]" if has_active else c["name"]
        print(f"{e['event_date']} {e['event_hour']}:00 | {c['name']} | settled: {e.get('is_settled')} | has_active: {has_active} | label: {tile_label}")
