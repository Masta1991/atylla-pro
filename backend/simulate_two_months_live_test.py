# -*- coding: utf-8 -*-
"""
Atylla Pro - Full 2-Month Live Simulation & Comprehensive Diagnostic Engine
Trainer: staws22-1@gmail.com (ID: 520504a4-1a24-4534-aac6-56237ff84f15)
Simulation Scope: June 1, 2026 - July 31, 2026 (Full 9 Weeks)
"""

import sys
import uuid
import json
import time
from datetime import datetime, date, timedelta
from pathlib import Path

# Force UTF-8 on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend directory
BACKEND_DIR = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\backend")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database

TRAINER_ID = "520504a4-1a24-4534-aac6-56237ff84f15"
TRAINER_EMAIL = "staws22-1@gmail.com"

client = database.get_supabase()

print("=" * 70)
print(f"[START] STARTING 2-MONTH FULL WORKFLOW SIMULATION FOR {TRAINER_EMAIL}")
print("=" * 70)

# 1. SETUP MUSCLE GROUPS AND EXERCISES
print("\n[STEP 1] Setting up Muscle Groups and Exercises...")

mg_res = client.table("muscle_groups").select("id, name").eq("trainer_id", TRAINER_ID).execute()
existing_mgs = {m["name"]: m["id"] for m in mg_res.data}

needed_mgs = ["Klatka piersiowa", "Plecy", "Nogi", "Barki", "Ramiona"]
mg_ids = {}
for mg in needed_mgs:
    if mg in existing_mgs:
        mg_ids[mg] = existing_mgs[mg]
    else:
        new_mg = client.table("muscle_groups").insert({
            "name": mg,
            "trainer_id": TRAINER_ID
        }).execute().data[0]
        mg_ids[mg] = new_mg["id"]
        print(f"  + Created Muscle Group: {mg}")

ex_res = client.table("exercises").select("id, name, muscle_group_id").eq("trainer_id", TRAINER_ID).execute()
existing_exs = {e["name"]: e["id"] for e in ex_res.data}

needed_exs = [
    ("Wyciskanie sztangi leżąc", mg_ids["Klatka piersiowa"], "kg"),
    ("Wyciskanie hantli na skosie", mg_ids["Klatka piersiowa"], "kg"),
    ("Martwy ciąg klasyczny", mg_ids["Plecy"], "kg"),
    ("Podciąganie na drążku", mg_ids["Plecy"], "reps"),
    ("Przysiad ze sztangą", mg_ids["Nogi"], "kg"),
    ("Wyciskanie żołnierskie (OHP)", mg_ids["Barki"], "kg"),
    ("Uginanie przedramion ze sztangą", mg_ids["Ramiona"], "kg")
]

ex_ids = {}
for name, mg_id, unit in needed_exs:
    if name in existing_exs:
        ex_ids[name] = existing_exs[name]
    else:
        new_ex = client.table("exercises").insert({
            "name": name,
            "muscle_group_id": mg_id,
            "unit": unit,
            "trainer_id": TRAINER_ID,
            "sort_order": 1
        }).execute().data[0]
        ex_ids[name] = new_ex["id"]
        print(f"  + Created Exercise: {name}")

# 2. SETUP 4 TEST CLIENTS
print("\n[STEP 2] Creating / Verifying 4 Test Clients...")

clients_data = [
    {
        "name": "Michał Wiśniewski (QA)",
        "phone": "+48 501 111 222",
        "notes": "Cel: Redukcja i siła, pakiet 10 treningów",
        "billing_type": "package",
        "package_size": 10,
        "join_date": "2026-06-01"
    },
    {
        "name": "Karolina Mazur (QA)",
        "phone": "+48 502 333 444",
        "notes": "Cel: Hipertrofia i pośladki, pakiet 20 treningów",
        "billing_type": "package",
        "package_size": 20,
        "join_date": "2026-06-01"
    },
    {
        "name": "Tomasz Adamski (QA)",
        "phone": "+48 503 555 666",
        "notes": "Cel: Przygotowanie motoryczne, pakiet 10 treningów",
        "billing_type": "package",
        "package_size": 10,
        "join_date": "2026-06-01"
    },
    {
        "name": "Ewa Dąbrowska (QA)",
        "phone": "+48 504 777 888",
        "notes": "Pojedyncze treningi sobotnie",
        "billing_type": "single",
        "package_size": 0,
        "join_date": "2026-06-06"
    }
]

client_objs = {}
for c in clients_data:
    res = client.table("clients").select("*").eq("trainer_id", TRAINER_ID).eq("name", c["name"]).execute()
    if res.data:
        client_objs[c["name"]] = res.data[0]
        print(f"  Existing Client: {c['name']} (ID: {res.data[0]['id']})")
    else:
        new_c = client.table("clients").insert({
            "name": c["name"],
            "phone": c["phone"],
            "notes": c["notes"],
            "billing_type": c["billing_type"],
            "package_size": c["package_size"],
            "join_date": c["join_date"],
            "trainer_id": TRAINER_ID
        }).execute().data[0]
        client_objs[c["name"]] = new_c
        print(f"  + Created Client: {c['name']} (ID: {new_c['id']})")

# 3. INITIAL MEASUREMENTS
print("\n[STEP 3] Logging Initial Measurements (June 1, 2026)...")
for c_name, c_obj in client_objs.items():
    res = client.table("measurements").select("id").eq("client_id", c_obj["id"]).eq("measure_date", "2026-06-01").execute()
    if not res.data:
        client.table("measurements").insert({
            "client_id": c_obj["id"],
            "measure_date": "2026-06-01",
            "weight_kg": 85.5 if "Michał" in c_name else (62.0 if "Karolina" in c_name else (92.0 if "Tomasz" in c_name else 68.0)),
            "body_fat_pct": 21.5 if "Michał" in c_name else 24.0,
            "muscle_mass_pct": 42.0 if "Michał" in c_name else 33.0,
            "trainer_id": TRAINER_ID
        }).execute()
        print(f"  + Logged baseline measurement for {c_name}")

# 4. TWO MONTHS SIMULATION (JUNE 1 - JULY 31, 2026)
print("\n[STEP 4] Simulating 9 Weeks of Workouts, Exercise Logging, and Settlements...")

current_date = date(2026, 6, 1)
end_date = date(2026, 7, 31)

total_events_created = 0
total_workouts_logged = 0
total_settled = 0
total_cancelled_charged = 0
total_cancelled_free = 0

progression_weight = {
    "Michał Wiśniewski (QA)": 80.0,
    "Karolina Mazur (QA)": 45.0,
    "Tomasz Adamski (QA)": 90.0,
    "Ewa Dąbrowska (QA)": 35.0
}

# Track start event IDs for packages
package_starts = {}

week_num = 1
while current_date <= end_date:
    weekday = current_date.weekday() # 0 = Monday, 6 = Sunday
    iso_date = current_date.isoformat()

    # Schedule:
    # Michał: Mon (0), Wed (2), Fri (4) at 09:00
    # Karolina: Tue (1), Thu (3) at 17:00
    # Tomasz: Mon (0), Wed (2), Fri (4) at 18:00
    # Ewa: Sat (5) at 10:00

    daily_sessions = []
    if weekday in [0, 2, 4]:
        daily_sessions.append(("Michał Wiśniewski (QA)", 9, "Wyciskanie sztangi leżąc"))
        daily_sessions.append(("Tomasz Adamski (QA)", 18, "Martwy ciąg klasyczny"))
    elif weekday in [1, 3]:
        daily_sessions.append(("Karolina Mazur (QA)", 17, "Przysiad ze sztangą"))
    elif weekday == 5:
        daily_sessions.append(("Ewa Dąbrowska (QA)", 10, "Wyciskanie żołnierskie (OHP)"))

    for c_name, hour, ex_name in daily_sessions:
        c_id = client_objs[c_name]["id"]

        # Check existing event by unique constraint: (trainer_id, event_date, event_hour)
        res_ev = client.table("calendar_events").select("*").eq("trainer_id", TRAINER_ID).eq("event_date", iso_date).eq("event_hour", hour).execute()

        # Simulate cancellation scenarios:
        # 1. On 2026-06-17 (Wed), Tomasz had a late cancellation with charge
        # 2. On 2026-07-07 (Tue), Karolina had a timely cancellation (free)
        is_late_cancel = (iso_date == "2026-06-17" and "Tomasz" in c_name)
        is_free_cancel = (iso_date == "2026-07-07" and "Karolina" in c_name)

        status = "active"
        is_settled = True
        if is_late_cancel:
            status = "cancelled"
            is_settled = True
            total_cancelled_charged += 1
        elif is_free_cancel:
            status = "cancelled"
            is_settled = False
            total_cancelled_free += 1
        else:
            total_settled += 1

        if not res_ev.data:
            new_ev = client.table("calendar_events").insert({
                "trainer_id": TRAINER_ID,
                "client_id": c_id,
                "event_date": iso_date,
                "event_hour": hour,
                "status": status,
                "is_settled": is_settled,
                "note": f"Trening {iso_date} - {ex_name}"
            }).execute().data[0]
            ev_id = new_ev["id"]
            total_events_created += 1
        else:
            ev_id = res_ev.data[0]["id"]
            # Ensure client_id and status is updated
            client.table("calendar_events").update({
                "client_id": c_id,
                "status": status,
                "is_settled": is_settled
            }).eq("id", ev_id).execute()

        if c_name not in package_starts:
            package_starts[c_name] = ev_id

        # Log exercises for completed workouts
        if status == "active":
            # Progression: increase weight every week
            cur_w = progression_weight[c_name]
            progression_weight[c_name] += 0.5 # linear increase

            # Check existing workout log
            res_w = client.table("workout_logs").select("id").eq("client_id", c_id).eq("session_date", iso_date).execute()
            if not res_w.data:
                client.table("workout_logs").insert({
                    "trainer_id": TRAINER_ID,
                    "client_id": c_id,
                    "exercise_id": ex_ids[ex_name],
                    "weight_kg": round(cur_w, 1),
                    "reps": 8,
                    "week_number": week_num,
                    "session_date": iso_date
                }).execute()
                total_workouts_logged += 1

    if weekday == 6:
        week_num += 1

    current_date += timedelta(days=1)

print(f"  Summary of Sessions Generated:")
print(f"    - Total Calendar Events: {total_events_created}")
print(f"    - Total Workout Logs: {total_workouts_logged}")
print(f"    - Settled Workouts: {total_settled}")
print(f"    - Cancelled (Charged): {total_cancelled_charged}")
print(f"    - Cancelled (Free): {total_cancelled_free}")

# 5. MID-TERM & FINAL MEASUREMENTS
print("\n[STEP 5] Logging Mid-term (July 1) and Final (July 31) Body Measurements...")

for c_name, c_obj in client_objs.items():
    # July 1
    res_m1 = client.table("measurements").select("id").eq("client_id", c_obj["id"]).eq("measure_date", "2026-07-01").execute()
    if not res_m1.data:
        client.table("measurements").insert({
            "client_id": c_obj["id"],
            "measure_date": "2026-07-01",
            "weight_kg": 83.8 if "Michał" in c_name else (61.2 if "Karolina" in c_name else (90.5 if "Tomasz" in c_name else 67.5)),
            "body_fat_pct": 19.8 if "Michał" in c_name else 22.8,
            "muscle_mass_pct": 43.1 if "Michał" in c_name else 34.0,
            "trainer_id": TRAINER_ID
        }).execute()

    # July 31
    res_m2 = client.table("measurements").select("id").eq("client_id", c_obj["id"]).eq("measure_date", "2026-07-31").execute()
    if not res_m2.data:
        client.table("measurements").insert({
            "client_id": c_obj["id"],
            "measure_date": "2026-07-31",
            "weight_kg": 82.1 if "Michał" in c_name else (60.5 if "Karolina" in c_name else (89.0 if "Tomasz" in c_name else 67.0)),
            "body_fat_pct": 18.2 if "Michał" in c_name else 21.5,
            "muscle_mass_pct": 44.2 if "Michał" in c_name else 35.2,
            "trainer_id": TRAINER_ID
        }).execute()
        print(f"  + Logged progress measurements for {c_name} (Total 3 checkpoints)")

# 6. PACKAGE LIFECYCLE & SETTLEMENTS VERIFICATION
print("\n[STEP 6] Verifying SSOT Package Settlements...")

for c_name, c_obj in client_objs.items():
    if c_obj["billing_type"] == "package":
        # Get all completed or charged cancelled events
        evs = client.table("calendar_events").select("id, event_date, status, is_settled").eq("trainer_id", TRAINER_ID).eq("client_id", c_obj["id"]).order("event_date").execute().data

        counted_units = sum(1 for e in evs if (e["status"] == "active" and e["is_settled"]) or (e["status"] == "cancelled" and e["is_settled"]))
        free_cancelled = sum(1 for e in evs if e["status"] == "cancelled" and not e["is_settled"])

        print(f"\n  Client: {c_name}")
        print(f"    - Total Events on Calendar: {len(evs)}")
        print(f"    - Counted Billable Units: {counted_units}")
        print(f"    - Free Cancelled (No charge): {free_cancelled}")

        # Check / create client_packages entry
        pkg_res = client.table("client_packages").select("*").eq("trainer_id", TRAINER_ID).eq("client_id", c_obj["id"]).execute().data

        if not pkg_res:
            new_pkg = client.table("client_packages").insert({
                "client_id": c_obj["id"],
                "trainer_id": TRAINER_ID,
                "size": c_obj["package_size"],
                "start_training_id": evs[0]["id"] if evs else None,
                "offset": 0
            }).execute().data[0]
            print(f"    + Created Active Package: Size {c_obj['package_size']}, Start Training: {evs[0]['event_date']}")
        else:
            print(f"    - Active Package in DB: Size {pkg_res[0]['size']}, Offset {pkg_res[0]['offset']}")

print("\n" + "=" * 70)
print("[SUCCESS] FULL 2-MONTH WORKFLOW SIMULATION COMPLETED SUCCESSFULLY!")
print("=" * 70)
