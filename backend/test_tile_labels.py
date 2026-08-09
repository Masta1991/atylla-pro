# -*- coding: utf-8 -*-
import sys
from pathlib import Path

# Force UTF-8 on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\backend")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database
from routers.calendar import assign_chronological_numbers

TRAINER_ID = "520504a4-1a24-4534-aac6-56237ff84f15"
client = database.get_supabase()

# Week 1
events_w1 = client.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)").eq("trainer_id", TRAINER_ID).gte("event_date", "2026-06-01").lte("event_date", "2026-06-07").order("event_date").order("event_hour").execute().data

labeled_w1 = assign_chronological_numbers(events_w1, client)
print("=== WEEK 1 CALENDAR TILE LABELS (JUNE 1 - 7, 2026) ===")
for e in labeled_w1:
    if e.get("client_id") and e.get("clients"):
        c = e["clients"]
        print(f"{e['event_date']} {e['event_hour']}:00 | Client: {c['name']} | Package: [{c.get('package_current_count')}/{c.get('package_size')}] | Settled: {e.get('is_settled')}")

# Week 4
events_w4 = client.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)").eq("trainer_id", TRAINER_ID).gte("event_date", "2026-06-22").lte("event_date", "2026-06-28").order("event_date").order("event_hour").execute().data

labeled_w4 = assign_chronological_numbers(events_w4, client)
print("\n=== WEEK 4 CALENDAR TILE LABELS (JUNE 22 - 28, 2026) ===")
for e in labeled_w4:
    if e.get("client_id") and e.get("clients"):
        c = e["clients"]
        print(f"{e['event_date']} {e['event_hour']}:00 | Client: {c['name']} | Package: [{c.get('package_current_count')}/{c.get('package_size')}] | Settled: {e.get('is_settled')}")
