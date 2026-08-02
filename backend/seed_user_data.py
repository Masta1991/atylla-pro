import os
import sys
import uuid
from datetime import date, timedelta
from supabase import create_client

sys.path.append(os.path.dirname(__file__))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import SUPABASE_URL, SUPABASE_KEY

admin = create_client(SUPABASE_URL, SUPABASE_KEY)
USER_ID = "b48fb453-79b5-4687-bcb7-14e0ad939b4a" # aldona@gmail.com

def seed():
    print(f"Generating full rich demo dataset for trainer ID: {USER_ID}")

    # 1. Fetch existing muscle groups & workout types
    mg_res = admin.table("muscle_groups").select("*").eq("trainer_id", USER_ID).execute()
    mg_map = {m["name"]: m["id"] for m in mg_res.data}
    
    wt_res = admin.table("workout_types").select("*").eq("trainer_id", USER_ID).execute()
    wt_map = {w["name"]: w["id"] for w in wt_res.data}

    # Ensure workout types exist
    default_wts = ["Push", "Pull", "FBW"]
    for wt_name in default_wts:
        if wt_name not in wt_map:
            res = admin.table("workout_types").insert({"name": wt_name, "trainer_id": USER_ID}).execute()
            wt_map[wt_name] = res.data[0]["id"]

    # 2. Add full set of muscle groups
    new_groups = ["KLATKA PIERSIOWA", "PLECY", "NOGI", "BARKI", "BICEPS", "TRICEPS", "BRZUCH"]
    for g_name in new_groups:
        if g_name not in mg_map:
            res = admin.table("muscle_groups").insert({"name": g_name, "trainer_id": USER_ID}).execute()
            mg_map[g_name] = res.data[0]["id"]

    # 3. Add full set of exercises
    exercises_catalog = {
        "KLATKA PIERSIOWA": [
            ("Wyciskanie sztangi na ławce płaskiej", "KG"),
            ("Wyciskanie sztangielek na ławce płaskiej", "KG"),
            ("Wyciskanie sztangielek na ławce skośnej", "KG"),
            ("Rozpiętki ze sztangielkami", "KG"),
            ("Pompki na poręczach (Dipsy)", "KG")
        ],
        "PLECY": [
            ("Martwy ciąg", "KG"),
            ("Podciąganie na drążku", "POWT"),
            ("Wiosłowanie sztangą w opadzie", "KG"),
            ("Ściąganie drążka wyciągu górnego", "KG"),
            ("Wiosłowanie hantlem jednorącz", "KG")
        ],
        "NOGI": [
            ("Przysiady ze sztangą", "KG"),
            ("Prostowanie nóg na maszynie", "KG"),
            ("Uginanie nóg na maszynie", "KG"),
            ("Wykroki ze sztangielkami", "KG"),
            ("Hip Thrust (Wznosy bioder)", "KG")
        ],
        "BARKI": [
            ("Wyciskanie sztangi nad głowę (OHP)", "KG"),
            ("Wyciskanie sztangielek siedząc", "KG"),
            ("Unoszenie sztangielek bokiem", "KG"),
            ("Arnoldki", "KG")
        ],
        "BICEPS": [
            ("Uginanie przedramion ze sztangą", "KG"),
            ("Uginanie z hantlami z supinacją", "KG"),
            ("Uginanie na modlitewniku", "KG")
        ],
        "TRICEPS": [
            ("Prostowanie przedramion na wyciągu", "KG"),
            ("Wyciskanie francuskie ze sztangą", "KG"),
            ("Pompki wąskie (Triceps)", "POWT")
        ],
        "BRZUCH": [
            ("Allahy na wyciągu", "KG"),
            ("Unoszenie nóg w wiszeniu", "POWT"),
            ("Plank (Deska)", "SEK")
        ]
    }

    for g_name, ex_list in exercises_catalog.items():
        mg_id = mg_map[g_name]
        for ex_name, unit in ex_list:
            existing = admin.table("exercises").select("id").eq("trainer_id", USER_ID).eq("muscle_group_id", mg_id).eq("name", ex_name).execute()
            if not existing.data:
                admin.table("exercises").insert({
                    "muscle_group_id": mg_id,
                    "name": ex_name,
                    "unit": unit,
                    "trainer_id": USER_ID,
                    "sort_order": 0
                }).execute()

    # Fetch all exercises
    all_ex = admin.table("exercises").select("*").eq("trainer_id", USER_ID).execute()
    ex_map = {e["name"]: e["id"] for e in all_ex.data}

    print(f"Muscle Groups: {len(mg_map)}, Exercises: {len(ex_map)}")

    # 4. Upsert Demo Clients with rich metadata, schedules, payment history and notes
    clients_data = [
        {
            "name": "Katarzyna Nowak",
            "phone": "501-234-567",
            "join_date": "2026-06-01",
            "notes": "Cel główne: Redukcja tkanki tłuszczowej (-5kg w 3 miesiące) oraz wzmocnienie dolnych partii ciała. Dieta: 1800 kcal. Lubi treningi na pośladki i brzuch.",
            "billing_type": "package",
            "package_size": 10,
            "package_current_count": 6,
            "strength_progression": [
                "2026-06-05: Przysiad ze sztangą 45.0kg -> 2026-08-01: 62.5kg (+17.5kg)",
                "2026-06-05: Hip Thrust 50.0kg -> 2026-08-01: 75.0kg (+25.0kg)",
                "2026-06-05: Wyciskanie sztangielek 10.0kg -> 2026-08-01: 14.0kg (+4.0kg)"
            ],
            "training_schedule": [
                {"day": 0, "hour": 9, "workout_type_id": wt_map.get("FBW")},
                {"day": 2, "hour": 9, "workout_type_id": wt_map.get("Push")},
                {"day": 4, "hour": 9, "workout_type_id": wt_map.get("Pull")}
            ],
            "payment_history": [
                {"date": "2026-06-01", "amount": 1200, "package_size": 10, "method": "Karta płatnicza"},
                {"date": "2026-07-10", "amount": 1200, "package_size": 10, "method": "Przelew bankowy"}
            ],
            "trainer_id": USER_ID
        },
        {
            "name": "Marek Wiśniewski",
            "phone": "602-345-678",
            "join_date": "2026-05-15",
            "notes": "Cel: Budowa czystej masy mięśniowej (+4kg). Ważne: dawny uraz prawego barku - wymagana solidna rozgrzewka stożka rotatorów taśmą guma przed wyciskaniem.",
            "billing_type": "package",
            "package_size": 10,
            "package_current_count": 4,
            "strength_progression": [
                "2026-05-20: Martwy ciąg 70.0kg -> 2026-08-01: 95.0kg (+25.0kg)",
                "2026-05-20: Przysiad ze sztangą 60.0kg -> 2026-08-01: 85.0kg (+25.0kg)",
                "2026-05-20: Wyciskanie na ławce 50.0kg -> 2026-08-01: 72.5kg (+22.5kg)"
            ],
            "training_schedule": [
                {"day": 1, "hour": 17, "workout_type_id": wt_map.get("Push")},
                {"day": 3, "hour": 17, "workout_type_id": wt_map.get("Pull")}
            ],
            "payment_history": [
                {"date": "2026-05-15", "amount": 1400, "package_size": 10, "method": "Gotówka"},
                {"date": "2026-07-01", "amount": 1400, "package_size": 10, "method": "Przelew bankowy"}
            ],
            "trainer_id": USER_ID
        },
        {
            "name": "Anna Kowalska",
            "phone": "703-456-789",
            "join_date": "2026-07-01",
            "notes": "Cel: Ujędrnienie ciała, powrót do sprawności po 2-letniej przerwie. Treningi 2 razy w tygodniu (poniedziałki i piątki).",
            "billing_type": "package",
            "package_size": 5,
            "package_current_count": 3,
            "strength_progression": [
                "2026-07-02: Przysiad ze sztangą 30.0kg -> 2026-08-01: 42.5kg (+12.5kg)",
                "2026-07-02: Ściąganie drążka 25.0kg -> 2026-08-01: 35.0kg (+10.0kg)"
            ],
            "training_schedule": [
                {"day": 0, "hour": 11, "workout_type_id": wt_map.get("FBW")},
                {"day": 4, "hour": 11, "workout_type_id": wt_map.get("FBW")}
            ],
            "payment_history": [
                {"date": "2026-07-01", "amount": 700, "package_size": 5, "method": "BLIK"}
            ],
            "trainer_id": USER_ID
        }
    ]

    client_ids = {}
    for c in clients_data:
        existing = admin.table("clients").select("id").eq("trainer_id", USER_ID).eq("name", c["name"]).execute()
        if existing.data:
            cid = existing.data[0]["id"]
            admin.table("clients").update(c).eq("id", cid).execute()
            client_ids[c["name"]] = cid
        else:
            res = admin.table("clients").insert(c).execute()
            cid = res.data[0]["id"]
            client_ids[c["name"]] = cid
            print(f"Created client: {c['name']}")

    # 5. Create Detailed Training Plans with SUPERSETS and Detailed Sets Data
    # Clear existing plan exercises & plans for clean setup
    existing_plans = admin.table("training_plans").select("id").eq("trainer_id", USER_ID).execute()
    for p in (existing_plans.data or []):
        admin.table("plan_exercises").delete().eq("plan_id", p["id"]).execute()
        admin.table("training_plans").delete().eq("id", p["id"]).execute()

    superset_arm_id = str(uuid.uuid4())
    superset_chest_id = str(uuid.uuid4())
    superset_back_id = str(uuid.uuid4())

    plans_def = [
        {
            "name": "Plan FBW Zaawansowany (Superseria Ramiona)",
            "workout_type_id": wt_map.get("FBW"),
            "exercises": [
                {
                    "name": "Przysiady ze sztangą",
                    "sets": [{"reps": "12", "weight": "50"}, {"reps": "10", "weight": "55"}, {"reps": "8", "weight": "60"}, {"reps": "6", "weight": "65"}],
                    "superset_id": None
                },
                {
                    "name": "Wyciskanie sztangi na ławce płaskiej",
                    "sets": [{"reps": "10", "weight": "40"}, {"reps": "10", "weight": "45"}, {"reps": "8", "weight": "50"}, {"reps": "6", "weight": "55"}],
                    "superset_id": None
                },
                {
                    "name": "Wiosłowanie sztangą w opadzie",
                    "sets": [{"reps": "12", "weight": "35"}, {"reps": "10", "weight": "40"}, {"reps": "8", "weight": "45"}],
                    "superset_id": None
                },
                # SUPERSET: Biceps + Triceps
                {
                    "name": "Uginanie przedramion ze sztangą",
                    "sets": [{"reps": "12", "weight": "20"}, {"reps": "10", "weight": "22.5"}, {"reps": "10", "weight": "25"}],
                    "superset_id": superset_arm_id
                },
                {
                    "name": "Prostowanie przedramion na wyciągu",
                    "sets": [{"reps": "12", "weight": "25"}, {"reps": "10", "weight": "27.5"}, {"reps": "10", "weight": "30"}],
                    "superset_id": superset_arm_id
                },
                {
                    "name": "Allahy na wyciągu",
                    "sets": [{"reps": "15", "weight": "30"}, {"reps": "15", "weight": "35"}, {"reps": "12", "weight": "40"}],
                    "superset_id": None
                }
            ]
        },
        {
            "name": "Plan Push Hypertrophy (Superseria Klatka)",
            "workout_type_id": wt_map.get("Push"),
            "exercises": [
                # SUPERSET: Wyciskanie + Rozpiętki
                {
                    "name": "Wyciskanie sztangielek na ławce płaskiej",
                    "sets": [{"reps": "12", "weight": "20"}, {"reps": "10", "weight": "24"}, {"reps": "8", "weight": "28"}],
                    "superset_id": superset_chest_id
                },
                {
                    "name": "Rozpiętki ze sztangielkami",
                    "sets": [{"reps": "15", "weight": "10"}, {"reps": "12", "weight": "12"}, {"reps": "10", "weight": "14"}],
                    "superset_id": superset_chest_id
                },
                {
                    "name": "Wyciskanie sztangi nad głowę (OHP)",
                    "sets": [{"reps": "10", "weight": "30"}, {"reps": "8", "weight": "35"}, {"reps": "6", "weight": "40"}],
                    "superset_id": None
                },
                {
                    "name": "Unoszenie sztangielek bokiem",
                    "sets": [{"reps": "15", "weight": "8"}, {"reps": "15", "weight": "9"}, {"reps": "12", "weight": "10"}],
                    "superset_id": None
                },
                {
                    "name": "Wyciskanie francuskie ze sztangą",
                    "sets": [{"reps": "12", "weight": "20"}, {"reps": "10", "weight": "25"}, {"reps": "8", "weight": "27.5"}],
                    "superset_id": None
                }
            ]
        },
        {
            "name": "Plan Pull & Back Focus (Superseria Plecy + Biceps)",
            "workout_type_id": wt_map.get("Pull"),
            "exercises": [
                {
                    "name": "Martwy ciąg",
                    "sets": [{"reps": "8", "weight": "70"}, {"reps": "8", "weight": "85"}, {"reps": "6", "weight": "95"}, {"reps": "5", "weight": "105"}],
                    "superset_id": None
                },
                # SUPERSET: Ściąganie drążka + Uginanie z hantlami
                {
                    "name": "Ściąganie drążka wyciągu górnego",
                    "sets": [{"reps": "12", "weight": "40"}, {"reps": "10", "weight": "45"}, {"reps": "8", "weight": "50"}],
                    "superset_id": superset_back_id
                },
                {
                    "name": "Uginanie z hantlami z supinacją",
                    "sets": [{"reps": "12", "weight": "10"}, {"reps": "10", "weight": "12"}, {"reps": "8", "weight": "14"}],
                    "superset_id": superset_back_id
                },
                {
                    "name": "Wiosłowanie hantlem jednorącz",
                    "sets": [{"reps": "12", "weight": "20"}, {"reps": "10", "weight": "24"}, {"reps": "10", "weight": "26"}],
                    "superset_id": None
                }
            ]
        }
    ]

    created_plans = {}
    for p_def in plans_def:
        res = admin.table("training_plans").insert({
            "name": p_def["name"],
            "workout_type_id": p_def["workout_type_id"],
            "trainer_id": USER_ID
        }).execute()
        plan_id = res.data[0]["id"]
        created_plans[p_def["name"]] = plan_id

        for sort_idx, item in enumerate(p_def["exercises"]):
            ex_name = item["name"]
            if ex_name in ex_map:
                payload = {
                    "plan_id": plan_id,
                    "exercise_id": ex_map[ex_name],
                    "sort_order": sort_idx,
                    "sets_data": item["sets"],
                    "trainer_id": USER_ID
                }
                if item["superset_id"]:
                    payload["superset_id"] = item["superset_id"]
                admin.table("plan_exercises").insert(payload).execute()

    print(f"Created {len(created_plans)} plans with supersets & sets_data!")

    # Set default plans for clients
    fbw_plan_id = created_plans["Plan FBW Zaawansowany (Superseria Ramiona)"]
    push_plan_id = created_plans["Plan Push Hypertrophy (Superseria Klatka)"]
    pull_plan_id = created_plans["Plan Pull & Back Focus (Superseria Plecy + Biceps)"]

    admin.table("clients").update({"default_plan_id": fbw_plan_id}).eq("id", client_ids["Katarzyna Nowak"]).execute()
    admin.table("clients").update({"default_plan_id": push_plan_id}).eq("id", client_ids["Marek Wiśniewski"]).execute()
    admin.table("clients").update({"default_plan_id": fbw_plan_id}).eq("id", client_ids["Anna Kowalska"]).execute()

    # 6. Detailed Workout History (Workout Logs) across past weeks
    # Clear existing logs
    for cid in client_ids.values():
        admin.table("workout_logs").delete().eq("client_id", cid).execute()

    # Define historical sessions per client with exact weights, reps, and progressive overload
    sessions_history = [
        # Katarzyna Nowak
        {
            "client_name": "Katarzyna Nowak",
            "sessions": [
                ("2026-07-06", 1, [("Przysiady ze sztangą", 47.5, 10), ("Wyciskanie sztangi na ławce płaskiej", 35.0, 10), ("Wiosłowanie sztangą w opadzie", 30.0, 12), ("Hip Thrust (Wznosy bioder)", 55.0, 12), ("Allahy na wyciągu", 30.0, 15)]),
                ("2026-07-13", 2, [("Przysiady ze sztangą", 50.0, 10), ("Wyciskanie sztangi na ławce płaskiej", 37.5, 10), ("Wiosłowanie sztangą w opadzie", 32.5, 12), ("Hip Thrust (Wznosy bioder)", 60.0, 12), ("Allahy na wyciągu", 32.5, 15)]),
                ("2026-07-20", 3, [("Przysiady ze sztangą", 55.0, 10), ("Wyciskanie sztangi na ławce płaskiej", 40.0, 8),  ("Wiosłowanie sztangą w opadzie", 35.0, 10), ("Hip Thrust (Wznosy bioder)", 65.0, 10), ("Allahy na wyciągu", 35.0, 12)]),
                ("2026-07-27", 4, [("Przysiady ze sztangą", 57.5, 8),  ("Wyciskanie sztangi na ławce płaskiej", 42.5, 8),  ("Wiosłowanie sztangą w opadzie", 37.5, 10), ("Hip Thrust (Wznosy bioder)", 70.0, 10), ("Allahy na wyciągu", 37.5, 12)]),
                ("2026-08-01", 5, [("Przysiady ze sztangą", 62.5, 8),  ("Wyciskanie sztangi na ławce płaskiej", 45.0, 8),  ("Wiosłowanie sztangą w opadzie", 40.0, 8),  ("Hip Thrust (Wznosy bioder)", 75.0, 8),  ("Allahy na wyciągu", 40.0, 12)])
            ]
        },
        # Marek Wiśniewski
        {
            "client_name": "Marek Wiśniewski",
            "sessions": [
                ("2026-07-07", 1, [("Wyciskanie sztangielek na ławce płaskiej", 20.0, 12), ("Wyciskanie sztangi nad głowę (OHP)", 30.0, 10), ("Martwy ciąg", 75.0, 8), ("Wiosłowanie hantlem jednorącz", 20.0, 12), ("Prostowanie przedramion na wyciągu", 25.0, 12)]),
                ("2026-07-14", 2, [("Wyciskanie sztangielek na ławce płaskiej", 22.0, 10), ("Wyciskanie sztangi nad głowę (OHP)", 32.5, 10), ("Martwy ciąg", 80.0, 8), ("Wiosłowanie hantlem jednorącz", 22.0, 10), ("Prostowanie przedramion na wyciągu", 27.5, 10)]),
                ("2026-07-21", 3, [("Wyciskanie sztangielek na ławce płaskiej", 24.0, 10), ("Wyciskanie sztangi nad głowę (OHP)", 35.0, 8),  ("Martwy ciąg", 85.0, 6), ("Wiosłowanie hantlem jednorącz", 24.0, 10), ("Prostowanie przedramion na wyciągu", 30.0, 10)]),
                ("2026-07-28", 4, [("Wyciskanie sztangielek na ławce płaskiej", 26.0, 8),  ("Wyciskanie sztangi nad głowę (OHP)", 37.5, 8),  ("Martwy ciąg", 90.0, 6), ("Wiosłowanie hantlem jednorącz", 26.0, 8),  ("Prostowanie przedramion na wyciągu", 32.5, 8)]),
                ("2026-08-01", 5, [("Wyciskanie sztangielek na ławce płaskiej", 28.0, 8),  ("Wyciskanie sztangi nad głowę (OHP)", 40.0, 6),  ("Martwy ciąg", 95.0, 5), ("Wiosłowanie hantlem jednorącz", 28.0, 8),  ("Prostowanie przedramion na wyciągu", 35.0, 8)])
            ]
        },
        # Anna Kowalska
        {
            "client_name": "Anna Kowalska",
            "sessions": [
                ("2026-07-06", 1, [("Przysiady ze sztangą", 30.0, 12), ("Ściąganie drążka wyciągu górnego", 25.0, 12), ("Wyciskanie sztangielek siedząc", 8.0, 12),  ("Uginanie z hantlami z supinacją", 6.0, 12)]),
                ("2026-07-13", 2, [("Przysiady ze sztangą", 32.5, 10), ("Ściąganie drążka wyciągu górnego", 27.5, 10), ("Wyciskanie sztangielek siedząc", 9.0, 10),  ("Uginanie z hantlami z supinacją", 7.0, 10)]),
                ("2026-07-20", 3, [("Przysiady ze sztangą", 35.0, 10), ("Ściąganie drążka wyciągu górnego", 30.0, 10), ("Wyciskanie sztangielek siedząc", 10.0, 10), ("Uginanie z hantlami z supinacją", 8.0, 10)]),
                ("2026-07-27", 4, [("Przysiady ze sztangą", 37.5, 10), ("Ściąganie drążka wyciągu górnego", 32.5, 10), ("Wyciskanie sztangielek siedząc", 11.0, 8),  ("Uginanie z hantlami z supinacją", 9.0, 8)]),
                ("2026-08-01", 5, [("Przysiady ze sztangą", 42.5, 8),  ("Ściąganie drążka wyciągu górnego", 35.0, 8),  ("Wyciskanie sztangielek siedząc", 12.0, 8),  ("Uginanie z hantlami z supinacją", 10.0, 8)])
            ]
        }
    ]

    all_logs = []
    for item in sessions_history:
        cid = client_ids[item["client_name"]]
        for s_date, week_num, ex_list in item["sessions"]:
            for ex_name, w_kg, reps_val in ex_list:
                if ex_name in ex_map:
                    all_logs.append({
                        "client_id": cid,
                        "exercise_id": ex_map[ex_name],
                        "weight_kg": w_kg,
                        "reps": reps_val,
                        "week_number": week_num,
                        "session_date": s_date,
                        "trainer_id": USER_ID
                    })

    if all_logs:
        admin.table("workout_logs").insert(all_logs).execute()
        print(f"Inserted {len(all_logs)} detailed workout log entries!")

    # 7. Measurements History (Weight & Fat Progression)
    for cid in client_ids.values():
        admin.table("measurements").delete().eq("client_id", cid).execute()

    measurements_data = [
        # Katarzyna Nowak - reduction progress
        {"client_id": client_ids["Katarzyna Nowak"], "measure_date": "2026-06-01", "weight_kg": 68.5, "body_fat_pct": 28.5, "muscle_mass_pct": 32.0, "trainer_id": USER_ID},
        {"client_id": client_ids["Katarzyna Nowak"], "measure_date": "2026-06-15", "weight_kg": 67.4, "body_fat_pct": 27.8, "muscle_mass_pct": 32.4, "trainer_id": USER_ID},
        {"client_id": client_ids["Katarzyna Nowak"], "measure_date": "2026-07-01", "weight_kg": 66.2, "body_fat_pct": 26.9, "muscle_mass_pct": 32.9, "trainer_id": USER_ID},
        {"client_id": client_ids["Katarzyna Nowak"], "measure_date": "2026-07-15", "weight_kg": 65.5, "body_fat_pct": 26.1, "muscle_mass_pct": 33.2, "trainer_id": USER_ID},
        {"client_id": client_ids["Katarzyna Nowak"], "measure_date": "2026-08-01", "weight_kg": 64.8, "body_fat_pct": 25.3, "muscle_mass_pct": 33.8, "trainer_id": USER_ID},

        # Marek Wiśniewski - hypertrophy progress
        {"client_id": client_ids["Marek Wiśniewski"], "measure_date": "2026-05-15", "weight_kg": 77.5, "body_fat_pct": 18.2, "muscle_mass_pct": 40.1, "trainer_id": USER_ID},
        {"client_id": client_ids["Marek Wiśniewski"], "measure_date": "2026-06-15", "weight_kg": 79.0, "body_fat_pct": 17.8, "muscle_mass_pct": 41.3, "trainer_id": USER_ID},
        {"client_id": client_ids["Marek Wiśniewski"], "measure_date": "2026-07-15", "weight_kg": 80.6, "body_fat_pct": 17.4, "muscle_mass_pct": 42.4, "trainer_id": USER_ID},
        {"client_id": client_ids["Marek Wiśniewski"], "measure_date": "2026-08-01", "weight_kg": 81.8, "body_fat_pct": 17.1, "muscle_mass_pct": 43.1, "trainer_id": USER_ID},

        # Anna Kowalska - toning progress
        {"client_id": client_ids["Anna Kowalska"], "measure_date": "2026-07-01", "weight_kg": 59.0, "body_fat_pct": 24.5, "muscle_mass_pct": 31.0, "trainer_id": USER_ID},
        {"client_id": client_ids["Anna Kowalska"], "measure_date": "2026-07-15", "weight_kg": 58.4, "body_fat_pct": 23.8, "muscle_mass_pct": 31.5, "trainer_id": USER_ID},
        {"client_id": client_ids["Anna Kowalska"], "measure_date": "2026-08-01", "weight_kg": 57.9, "body_fat_pct": 23.0, "muscle_mass_pct": 32.1, "trainer_id": USER_ID}
    ]
    admin.table("measurements").insert(measurements_data).execute()
    print(f"Inserted {len(measurements_data)} measurement records!")

    # 8. Calendar Events with Detailed Notes, Main Group, Added Groups, Plan ID & Settled Flags
    for cid in client_ids.values():
        admin.table("calendar_events").delete().eq("client_id", cid).execute()

    calendar_schedule = [
        # (Client, date, hour, main_group, added_groups, note, is_settled, plan_id)
        (
            "Katarzyna Nowak", "2026-07-27", 9,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["BRZUCH", "NOGI"],
            "Znakomity trening. Kasia pobiła rekord w przysiadzie (57.5kg). Superseria biceps+triceps wykonana bez przerw.",
            True, fbw_plan_id
        ),
        (
            "Katarzyna Nowak", "2026-07-29", 9,
            "KLATKA PIERSIOWA", ["BARKI", "TRICEPS"],
            "Skupienie na technice wyciskania na ławce skośnej. Klientka zgłasza odczuwanie mięśni klatki, brak bólów w stawach.",
            True, push_plan_id
        ),
        (
            "Katarzyna Nowak", "2026-08-01", 9,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["BRZUCH"],
            "Przełamanie barier! Przysiad 62.5kg x 8 powtórzeń. Waga spadła poniżej 65kg. Świetne samopoczucie.",
            True, fbw_plan_id
        ),
        (
            "Katarzyna Nowak", "2026-08-03", 9,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["BRZUCH"],
            "Zaplanowany trening - kontrola obciążeń i test maksymalny w Hip Thrust.",
            False, fbw_plan_id
        ),
        (
            "Katarzyna Nowak", "2026-08-05", 9,
            "Plan Push Hypertrophy (Superseria Klatka)", ["BARKI"],
            "Zaplanowany trening - akcent na ramiona i górne partie klatki.",
            False, push_plan_id
        ),
        # Marek Wiśniewski
        (
            "Marek Wiśniewski", "2026-07-28", 17,
            "Plan: Plan Push Hypertrophy (Superseria Klatka)", ["TRICEPS"],
            "Solidne rozgrzanie stożków rotatorów gumą. Wyciskanie hantli 26kg płynnie. Bark reakcja prawidłowa, brak bólu.",
            True, push_plan_id
        ),
        (
            "Marek Wiśniewski", "2026-07-30", 17,
            "Plan: Plan Pull & Back Focus (Superseria Plecy + Biceps)", ["BICEPS"],
            "Martwy ciąg 90kg poszedł stabilnie z pasem. Superset plecy+biceps wykonany na mocnej pompie mięśniowej.",
            True, pull_plan_id
        ),
        (
            "Marek Wiśniewski", "2026-08-01", 17,
            "Plan: Plan Pull & Back Focus (Superseria Plecy + Biceps)", ["BICEPS"],
            "Nowy rekord w martwym ciągu: 95kg x 5 powtórzeń! Świetna kontrola tłoczni brzusznej.",
            True, pull_plan_id
        ),
        (
            "Marek Wiśniewski", "2026-08-04", 17,
            "Plan: Plan Push Hypertrophy (Superseria Klatka)", ["BARKI", "TRICEPS"],
            "Zaplanowany trening - proba podjscia pod wyciskanie hantli 28kg.",
            False, push_plan_id
        ),
        # Anna Kowalska
        (
            "Anna Kowalska", "2026-07-27", 11,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["NOGI"],
            "Ania wykonała pełną serię przysiadów 37.5kg. Widać wyraźną poprawę mobilności w stawach skokowych.",
            True, fbw_plan_id
        ),
        (
            "Anna Kowalska", "2026-08-01", 11,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["PLECY"],
            "Osiągnięty cel 42.5kg w przysiadzie! Pomiary wykazały ubytek 1.1kg tłuszczu i wzrost masy mięśniowej.",
            True, fbw_plan_id
        ),
        (
            "Anna Kowalska", "2026-08-03", 11,
            "Plan: Plan FBW Zaawansowany (Superseria Ramiona)", ["BARKI"],
            "Zaplanowany trening - szlifowanie techniki wyciskania sztangielek.",
            False, fbw_plan_id
        )
    ]

    events_to_insert = []
    for cname, ev_date, hr, m_group, add_groups, note_txt, settled, pid in calendar_schedule:
        events_to_insert.append({
            "client_id": client_ids[cname],
            "event_date": ev_date,
            "event_hour": hr,
            "status": "active",
            "is_settled": settled,
            "main_group": m_group,
            "added_groups": add_groups,
            "note": note_txt,
            "plan_id": pid,
            "workout_type_id": wt_map.get("FBW"),
            "trainer_id": USER_ID
        })

    admin.table("calendar_events").insert(events_to_insert).execute()
    print(f"Inserted {len(events_to_insert)} rich calendar events with notes & superset plans!")

    print("All rich demo seeding finished successfully!")

if __name__ == "__main__":
    seed()
