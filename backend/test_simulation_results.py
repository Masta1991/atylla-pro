# -*- coding: utf-8 -*-
"""
Atylla Pro - Full Simulation Results Verifier & Bug Diagnostics
"""

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

print("=" * 70)
print("🔍 AUDITING SIMULATION RESULTS (JUNE - JULY 2026)")
print("=" * 70)

# 1. Audit Clients
clients = client.table("clients").select("*").eq("trainer_id", TRAINER_ID).ilike("name", "%(QA)%").execute().data
print(f"\n1. Found {len(clients)} QA Clients:")
for c in clients:
    print(f"   - {c['name']} (Billing: {c['billing_type']}, Package Size: {c['package_size']})")

# 2. Audit Calendar Events
events = client.table("calendar_events").select("*, clients!calendar_events_client_id_fkey(id, name, billing_type, package_size)").eq("trainer_id", TRAINER_ID).gte("event_date", "2026-06-01").lte("event_date", "2026-07-31").order("event_date").order("event_hour").execute().data
print(f"\n2. Total Calendar Events in Period: {len(events)}")

# Run chronological label generator
labeled = assign_chronological_numbers(events, client)

labels_summary = {}
for e in labeled:
    cid = e.get("client_id")
    if cid not in labels_summary:
        labels_summary[cid] = []
    labels_summary[cid].append({
        "date": e["event_date"],
        "hour": e["event_hour"],
        "label": e.get("package_label"),
        "status": e.get("status"),
        "is_settled": e.get("is_settled")
    })

for c in clients:
    cid = c["id"]
    ev_list = labels_summary.get(cid, [])
    print(f"\n   Client: {c['name']} ({len(ev_list)} events)")
    for ev in ev_list[:6]: # first 6
        print(f"     {ev['date']} {ev['hour']}:00 | Label: {ev['label']} | Status: {ev['status']} | Settled: {ev['is_settled']}")
    if len(ev_list) > 6:
        print(f"     ... ({len(ev_list)-6} more sessions)")
        last_ev = ev_list[-1]
        print(f"     [LAST] {last_ev['date']} {last_ev['hour']}:00 | Label: {last_ev['label']} | Status: {last_ev['status']}")

# 3. Audit Workout Logs Progression
wlogs = client.table("workout_logs").select("*, exercises(name)").eq("trainer_id", TRAINER_ID).order("session_date").execute().data
print(f"\n3. Total Workout Logs Recorded: {len(wlogs)}")
for c in clients:
    cid = c["id"]
    c_logs = [w for w in wlogs if w["client_id"] == cid]
    if c_logs:
        first_log = c_logs[0]
        last_log = c_logs[-1]
        ex_name = first_log.get("exercises", {}).get("name", "Unknown")
        print(f"   - {c['name']}: {len(c_logs)} logged sessions | Exercise: {ex_name}")
        print(f"       Start: {first_log['session_date']} ({first_log['weight_kg']} kg, {first_log['reps']} reps)")
        print(f"       End:   {last_log['session_date']} ({last_log['weight_kg']} kg, {last_log['reps']} reps)")

# 4. Audit Measurements
measures = client.table("measurements").select("*").eq("trainer_id", TRAINER_ID).order("measure_date").execute().data
print(f"\n4. Total Body Measurements Recorded: {len(measures)}")
for c in clients:
    cid = c["id"]
    c_m = [m for m in measures if m["client_id"] == cid]
    print(f"   - {c['name']}: {len(c_m)} checkpoints")
    for m in c_m:
        print(f"       {m['measure_date']}: Weight {m['weight_kg']} kg, BF {m.get('body_fat_pct')}%")

print("\n" + "=" * 70)
print("AUDIT FINISHED")
print("=" * 70)
