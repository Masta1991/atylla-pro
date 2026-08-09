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

# Check Week 1 (Jan 2 - Jan 7, 2026)
events = client.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)").eq("trainer_id", trainer_id).gte("event_date", "2026-01-02").lte("event_date", "2026-01-07").order("event_date").order("event_hour").execute().data

labeled = assign_chronological_numbers(events, client)
print("=== WIDOK KAFELKÓW KALENDARZA (1. TYDZIEŃ STYCZNIA 2026) ===")
for e in labeled[:10]:
    if e.get("client_id") and e.get("clients"):
        c = e["clients"]
        print(f"{e['event_date']} {e['event_hour']}:00 | {c['name']} | Licznik w kafelku: {c.get('package_current_count')}/{c.get('package_size')}")
