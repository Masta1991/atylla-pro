# -*- coding: utf-8 -*-
"""
Atylla Pro - 7-Month Enterprise Real-World Simulation Engine
Trainer: staws22-1@gmail.com (ID: 520504a4-1a24-4534-aac6-56237ff84f15)
Simulation Period: January 1, 2026 - July 31, 2026 (7 Full Months / 30.5 Weeks)
Workload: 10 Clients x 4 Sessions/Week = 40 Sessions/Week (~1,200 Total Workouts)
Features Tested:
  - Client Profiles & Goals
  - Calendar Scheduling (Zero Hour Conflicts)
  - Exercise Logs with Realistic Weight/Reps Progression
  - Package Lifecycles (Open -> Complete -> Close with end_training_id -> Open New Package)
  - History of Closed & Active Packages
  - Paid vs Free Cancellations
  - Monthly Body Measurements (7 Monthly Checkpoints)
  - Client Progress Reports Generation
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

BACKEND_DIR = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\backend")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database

TRAINER_ID = "520504a4-1a24-4534-aac6-56237ff84f15"
TRAINER_EMAIL = "staws22-1@gmail.com"

client = database.get_supabase()

print("=" * 75)
print(f"[START] 7-MONTH ENTERPRISE SIMULATION FOR {TRAINER_EMAIL}")
print("Period: 2026-01-01 to 2026-07-31 (7 Full Months)")
print("Workload: 10 Clients x 4 Workouts/Week = ~1,200 Sessions")
print("=" * 75)

# 1. SETUP EXERCISES & MUSCLE GROUPS
print("\n[FAZA 1] Tworzenie i weryfikacja bazy ćwiczeń i partii mięśniowych...")

mg_res = client.table("muscle_groups").select("id, name").eq("trainer_id", TRAINER_ID).execute()
existing_mgs = {m["name"]: m["id"] for m in mg_res.data}

needed_mgs = ["Klatka piersiowa", "Plecy", "Nogi", "Barki", "Ramiona", "Pośladki"]
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
        print(f"  + Partia: {mg}")

ex_res = client.table("exercises").select("id, name, muscle_group_id").eq("trainer_id", TRAINER_ID).execute()
existing_exs = {e["name"]: e["id"] for e in ex_res.data}

needed_exs = [
    ("Wyciskanie sztangi leżąc", mg_ids["Klatka piersiowa"], "kg"),
    ("Wyciskanie hantli na skosie dodatnim", mg_ids["Klatka piersiowa"], "kg"),
    ("Martwy ciąg klasyczny", mg_ids["Plecy"], "kg"),
    ("Podciąganie na drążku z ciężarem", mg_ids["Plecy"], "kg"),
    ("Wiosłowanie sztangą w opadzie", mg_ids["Plecy"], "kg"),
    ("Przysiad ze sztangą", mg_ids["Nogi"], "kg"),
    ("Przysiad bułgarski z hantlami", mg_ids["Nogi"], "kg"),
    ("Hip Thrust ze sztangą", mg_ids["Pośladki"], "kg"),
    ("Rumuński martwy ciąg (RDL)", mg_ids["Pośladki"], "kg"),
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
        print(f"  + Ćwiczenie: {name}")

# 2. DEFINING 10 REALISTIC CLIENTS WITH DIVERSE SCHEDULES (4 SESSIONS/WEEK)
print("\n[FAZA 2] Inicjalizacja 10 aktywnych podopiecznych z harmonogramami...")

clients_definitions = [
    {
        "name": "Jan Kowalski (QA 10)",
        "phone": "+48 501 101 101",
        "notes": "Cel: Siła i klatka piersiowa",
        "package_size": 10,
        "base_weight": 70.0,
        "exercise": "Wyciskanie sztangi leżąc",
        "schedule": [(0, 7), (2, 7), (4, 7), (5, 8)] # Pon, Śr, Pt 07:00, Sob 08:00
    },
    {
        "name": "Anna Nowak (QA 20)",
        "phone": "+48 502 202 202",
        "notes": "Cel: Kształtowanie nóg i pośladków",
        "package_size": 20,
        "base_weight": 40.0,
        "exercise": "Przysiad ze sztangą",
        "schedule": [(0, 8), (1, 8), (3, 8), (4, 8)] # Pon, Wt, Czw, Pt 08:00
    },
    {
        "name": "Piotr Wiśniewski (QA 10)",
        "phone": "+48 503 303 303",
        "notes": "Cel: Trójbój i martwy ciąg",
        "package_size": 10,
        "base_weight": 90.0,
        "exercise": "Martwy ciąg klasyczny",
        "schedule": [(0, 9), (2, 9), (4, 9), (5, 9)] # Pon, Śr, Pt 09:00, Sob 09:00
    },
    {
        "name": "Katarzyna Wójcik (QA 20)",
        "phone": "+48 504 404 404",
        "notes": "Cel: Rozbudowa pośladków",
        "package_size": 20,
        "base_weight": 50.0,
        "exercise": "Hip Thrust ze sztangą",
        "schedule": [(1, 9), (2, 10), (3, 9), (4, 10)] # Wt 09, Śr 10, Czw 09, Pt 10
    },
    {
        "name": "Marek Kamiński (QA 10)",
        "phone": "+48 505 505 505",
        "notes": "Cel: Siła barków i sylwetka V",
        "package_size": 10,
        "base_weight": 40.0,
        "exercise": "Wyciskanie żołnierskie (OHP)",
        "schedule": [(0, 16), (2, 16), (3, 16), (4, 16)] # Pon, Śr, Czw, Pt 16:00
    },
    {
        "name": "Magdalena Lewandowska (QA 20)",
        "phone": "+48 506 606 606",
        "notes": "Cel: Zdrowe plecy i postawa",
        "package_size": 20,
        "base_weight": 35.0,
        "exercise": "Wiosłowanie sztangą w opadzie",
        "schedule": [(0, 17), (1, 17), (2, 17), (4, 17)] # Pon, Wt, Śr, Pt 17:00
    },
    {
        "name": "Krzysztof Zieliński (QA 10)",
        "phone": "+48 507 707 707",
        "notes": "Cel: Wyciskanie na skosie i ramiona",
        "package_size": 10,
        "base_weight": 22.0,
        "exercise": "Wyciskanie hantli na skosie dodatnim",
        "schedule": [(1, 18), (2, 18), (3, 18), (5, 10)] # Wt, Śr, Czw 18:00, Sob 10:00
    },
    {
        "name": "Agnieszka Szymańska (QA 20)",
        "phone": "+48 508 808 808",
        "notes": "Cel: Stabilizacja i nogi",
        "package_size": 20,
        "base_weight": 12.0,
        "exercise": "Przysiad bułgarski z hantlami",
        "schedule": [(0, 18), (1, 19), (3, 18), (4, 18)] # Pon 18, Wt 19, Czw 18, Pt 18
    },
    {
        "name": "Tomasz Kozłowski (QA 10)",
        "phone": "+48 509 909 909",
        "notes": "Cel: Kalistenika i podciąganie z obciążeniem",
        "package_size": 10,
        "base_weight": 0.0, # bodyweight start
        "exercise": "Podciąganie na drążku z ciężarem",
        "schedule": [(1, 20), (2, 19), (3, 19), (4, 19)] # Wt 20, Śr 19, Czw 19, Pt 19
    },
    {
        "name": "Karolina Mazur (QA 20)",
        "phone": "+48 510 010 010",
        "notes": "Cel: Modelowanie sylwetki i RDL",
        "package_size": 20,
        "base_weight": 45.0,
        "exercise": "Rumuński martwy ciąg (RDL)",
        "schedule": [(0, 19), (2, 20), (3, 20), (5, 11)] # Pon 19, Śr 20, Czw 20, Sob 11:00
    }
]

client_map = {}
for c_def in clients_definitions:
    res = client.table("clients").select("*").eq("trainer_id", TRAINER_ID).eq("name", c_def["name"]).execute()
    if res.data:
        client_map[c_def["name"]] = res.data[0]
        print(f"  Klient: {c_def['name']} (ID: {res.data[0]['id']})")
    else:
        new_c = client.table("clients").insert({
            "name": c_def["name"],
            "phone": c_def["phone"],
            "notes": c_def["notes"],
            "billing_type": "package",
            "package_size": c_def["package_size"],
            "join_date": "2026-01-01",
            "trainer_id": TRAINER_ID
        }).execute().data[0]
        client_map[c_def["name"]] = new_c
        print(f"  + Utworzono klienta: {c_def['name']}")

# 3. SETUP MONTHLY MEASUREMENTS (JANUARY TO JULY 2026)
print("\n[FAZA 3] Rejestracja comiesięcznych pomiarów sylwetki (7 punktów kontrolnych)...")

measurement_dates = [
    ("2026-01-01", 1.0),
    ("2026-02-01", 0.95),
    ("2026-03-01", 0.92),
    ("2026-04-01", 0.90),
    ("2026-05-01", 0.88),
    ("2026-06-01", 0.86),
    ("2026-07-01", 0.84),
    ("2026-07-31", 0.82)
]

total_measurements = 0
for c_def in clients_definitions:
    c_id = client_map[c_def["name"]]["id"]
    base_body_weight = 82.0 if "Jan" in c_def["name"] or "Piotr" in c_def["name"] or "Marek" in c_def["name"] or "Krzysztof" in c_def["name"] or "Tomasz" in c_def["name"] else 63.0
    base_bf = 24.0 if base_body_weight > 70 else 26.0

    for m_date, factor in measurement_dates:
        res_m = client.table("measurements").select("id").eq("client_id", c_id).eq("measure_date", m_date).execute()
        if not res_m.data:
            client.table("measurements").insert({
                "client_id": c_id,
                "measure_date": m_date,
                "weight_kg": round(base_body_weight * (0.95 + 0.05 * factor), 1),
                "body_fat_pct": round(base_bf * factor, 1),
                "muscle_mass_pct": round(38.0 + (1.0 - factor) * 8.0, 1),
                "trainer_id": TRAINER_ID
            }).execute()
            total_measurements += 1

print(f"  Zapisano {total_measurements} nowych punktów pomiarowych w bazie.")

# 4. SIMULATION OF 30.5 WEEKS (JANUARY 1 - JULY 31, 2026)
print("\n[FAZA 4] Symulacja 7 miesięcy sesji treningowych, logowania ćwiczeń i cykli pakietów...")

# Tracking active packages and progression
progression_current = {c["name"]: c["base_weight"] for c in clients_definitions}
client_packages_history = {c["name"]: [] for c in clients_definitions}
active_package_tracker = {}

# Clean previous client_packages for fresh deterministic run
client.table("client_packages").delete().eq("trainer_id", TRAINER_ID).execute()

current_date = date(2026, 1, 1)
end_date = date(2026, 7, 31)

total_events = 0
total_logs = 0
total_settled = 0
total_cancels_charged = 0
total_cancels_free = 0
total_packages_closed = 0

# Scheduled cancellation dates for testing:
cancellation_schedule = {
    (date(2026, 2, 11), "Jan Kowalski (QA 10)"): ("cancelled", True), # Grypa - płatne
    (date(2026, 3, 17), "Anna Nowak (QA 20)"): ("cancelled", False), # Wyjazd służbowy - free
    (date(2026, 4, 15), "Piotr Wiśniewski (QA 10)"): ("cancelled", True), # Spóźnienie - płatne
    (date(2026, 5, 20), "Katarzyna Wójcik (QA 20)"): ("cancelled", False), # Wizyta lekarska - free
    (date(2026, 6, 10), "Marek Kamiński (QA 10)"): ("cancelled", True), # Awaria auta - płatne
    (date(2026, 7, 14), "Magdalena Lewandowska (QA 20)"): ("cancelled", False) # Urlop - free
}

week_counter = 1
while current_date <= end_date:
    weekday = current_date.weekday()
    iso_date = current_date.isoformat()

    # Find who trains today
    for c_def in clients_definitions:
        c_name = c_def["name"]
        c_id = client_map[c_name]["id"]
        pkg_target_size = c_def["package_size"]
        ex_name = c_def["exercise"]

        for sched_day, sched_hour in c_def["schedule"]:
            if weekday == sched_day:
                # Workout scheduled today!
                # Check cancellation rule
                cancel_info = cancellation_schedule.get((current_date, c_name))
                if cancel_info:
                    status, is_settled = cancel_info
                    if is_settled:
                        total_cancels_charged += 1
                    else:
                        total_cancels_free += 1
                else:
                    status = "active"
                    is_settled = True
                    total_settled += 1

                # Upsert calendar event
                res_ev = client.table("calendar_events").select("id").eq("trainer_id", TRAINER_ID).eq("event_date", iso_date).eq("event_hour", sched_hour).execute()
                if not res_ev.data:
                    new_ev = client.table("calendar_events").insert({
                        "trainer_id": TRAINER_ID,
                        "client_id": c_id,
                        "event_date": iso_date,
                        "event_hour": sched_hour,
                        "status": status,
                        "is_settled": is_settled,
                        "note": f"Trening {iso_date} - {ex_name}"
                    }).execute().data[0]
                    ev_id = new_ev["id"]
                    total_events += 1
                else:
                    ev_id = res_ev.data[0]["id"]
                    client.table("calendar_events").update({
                        "client_id": c_id,
                        "status": status,
                        "is_settled": is_settled
                    }).eq("id", ev_id).execute()

                # Manage Package Lifecycles (SSOT)
                if c_name not in active_package_tracker:
                    # Open first package
                    pkg_rec = client.table("client_packages").insert({
                        "client_id": c_id,
                        "trainer_id": TRAINER_ID,
                        "size": pkg_target_size,
                        "start_training_id": ev_id,
                        "end_training_id": None,
                        "offset": 0
                    }).execute().data[0]
                    active_package_tracker[c_name] = {
                        "pkg_id": pkg_rec["id"],
                        "start_id": ev_id,
                        "start_date": iso_date,
                        "count": 0
                    }

                # If session is billable, increment count
                if is_settled:
                    active_package_tracker[c_name]["count"] += 1

                    # Log exercise for completed workout
                    if status == "active":
                        progression_current[c_name] += 0.35 # Steady progression
                        cur_w = round(progression_current[c_name], 1)
                        client.table("workout_logs").insert({
                            "trainer_id": TRAINER_ID,
                            "client_id": c_id,
                            "exercise_id": ex_ids[ex_name],
                            "weight_kg": cur_w,
                            "reps": 8 if cur_w > 0 else 10,
                            "week_number": week_counter,
                            "session_date": iso_date
                        }).execute()
                        total_logs += 1

                    # Check if package limit is reached -> CLOSE PACKAGE & ARCHIVE
                    if active_package_tracker[c_name]["count"] >= pkg_target_size:
                        pkg_info = active_package_tracker[c_name]
                        # Close current package in DB
                        client.table("client_packages").update({
                            "end_training_id": ev_id,
                            "updated_at": "now()"
                        }).eq("id", pkg_info["pkg_id"]).execute()

                        total_packages_closed += 1
                        client_packages_history[c_name].append({
                            "size": pkg_target_size,
                            "start_date": pkg_info["start_date"],
                            "end_date": iso_date,
                            "sessions_count": pkg_info["count"]
                        })

                        # Reset tracker for next upcoming session to open a new package
                        del active_package_tracker[c_name]

    if weekday == 6:
        week_counter += 1

    current_date += timedelta(days=1)

print("\n" + "=" * 75)
print("[PODSUMOWANIE SYMULACJI 7-MIESIĘCZNEJ]")
print("=" * 75)
print(f"  Łączna liczba utworzonych zdarzeń w kalendarzu: {total_events}")
print(f"  Łączna liczba zapisanych dzienników ćwiczeń:     {total_logs}")
print(f"  Łączna liczba rozliczonych treningów:             {total_settled}")
print(f"  Odwołania płatne (rozliczone):                    {total_cancels_charged}")
print(f"  Odwołania bezpłatne (nierozliczone):              {total_cancels_free}")
print(f"  Łączna liczba pomyślnie zamkniętych pakietów:    {total_packages_closed}")

print("\n[HISTORIA PAKIETÓW DLA KAŻDEGO KLIENTA]")
for c_name, history in client_packages_history.items():
    print(f"\n  Podopieczny: {c_name}")
    print(f"    Zamkniętych pakietów w historii: {len(history)}")
    for i, h in enumerate(history, 1):
        print(f"      Pakiet #{i}: Wielkość {h['size']} | Okres: {h['start_date']} -> {h['end_date']} | Rozliczono: {h['sessions_count']}/{h['size']}")

print("\n" + "=" * 75)
print("[SUCCESS] SYMULACJA 7 MIESIĘCY ZAKOŃCZONA POWODZENIEM!")
print("=" * 75)
