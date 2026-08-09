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

client = database.get_supabase()
trainer_id = "520504a4-1a24-4534-aac6-56237ff84f15"

clients = client.table("clients").select("id, name, billing_type, package_size").eq("trainer_id", trainer_id).ilike("name", "%(QA %").order("name").execute().data

print("=" * 75)
print(f"📊 KOMPLEKSOWY AUDYT RAPORTÓW TRENINGOWYCH DLA 10 KLIENTÓW (7 MIESIĘCY)")
print("=" * 75)

for c in clients:
    cid = c["id"]
    wlogs = client.table("workout_logs").select("*, exercises(name)").eq("client_id", cid).order("session_date").limit(500).execute().data
    measures = client.table("measurements").select("*").eq("client_id", cid).order("measure_date").limit(500).execute().data
    pkgs = client.table("client_packages").select("*").eq("client_id", cid).order("created_at").limit(500).execute().data
    closed_pkgs = [p for p in pkgs if p.get("end_training_id") is not None]
    
    print(f"\n👤 Podopieczny: {c['name']}")
    print(f"   • Liczba odbytych sesji (styczeń–lipiec): {len(wlogs)}")
    print(f"   • Cykle pakietowe: łącznie {len(pkgs)} ({len(closed_pkgs)} pomyślnie zamkniętych w historii)")
    if wlogs:
        ex_name = wlogs[0].get("exercises", {}).get("name", "Główne ćwiczenie")
        print(f"   • Główne ćwiczenie: {ex_name}")
        print(f"   • Progresja siłowa: start {wlogs[0]['session_date']} ({wlogs[0]['weight_kg']} kg) ──► koniec {wlogs[-1]['session_date']} ({wlogs[-1]['weight_kg']} kg) [+{round(float(wlogs[-1]['weight_kg']) - float(wlogs[0]['weight_kg']), 1)} kg!]")
    if measures:
        print(f"   • Pomiary sylwetki (8 punktów):")
        print(f"       - Start ({measures[0]['measure_date']}): Waga {measures[0]['weight_kg']} kg, Fat {measures[0]['body_fat_pct']}%, Mięśnie {measures[0]['muscle_mass_pct']}%")
        print(f"       - Finał ({measures[-1]['measure_date']}): Waga {measures[-1]['weight_kg']} kg, Fat {measures[-1]['body_fat_pct']}%, Mięśnie {measures[-1]['muscle_mass_pct']}%")
