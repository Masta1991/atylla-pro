# -*- coding: utf-8 -*-
"""
Atylla Pro - Generate Visual 7-Month Progress Chart & Summary Report
"""

import sys
import io
import base64
from pathlib import Path

# Force UTF-8 on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\backend")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

client = database.get_supabase()
TRAINER_ID = "520504a4-1a24-4534-aac6-56237ff84f15"

# Fetch Jan Kowalski
c_res = client.table("clients").select("*").eq("trainer_id", TRAINER_ID).eq("name", "Jan Kowalski (QA 10)").single().execute()
jan = c_res.data
cid = jan["id"]

# Fetch all workout logs across 7 months
logs = client.table("workout_logs").select("*, exercises(name)").eq("client_id", cid).order("session_date").limit(500).execute().data
measures = client.table("measurements").select("*").eq("client_id", cid).order("measure_date").limit(500).execute().data
pkgs = client.table("client_packages").select("*").eq("client_id", cid).order("created_at").limit(500).execute().data

# Create 7-Month Multi-panel Progress Chart
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), dpi=100)
fig.patch.set_facecolor('#0d1117')
ax1.set_facecolor('#161b22')
ax2.set_facecolor('#161b22')

# Panel 1: Strength Progression (Bench Press)
weeks = [f"T{l['week_number']}" for l in logs]
weights = [float(l['weight_kg']) for l in logs]
ax1.plot(range(len(logs)), weights, color='#31d5f2', linewidth=2.5, marker='o', markersize=4, label='Wyciskanie sztangi leżąc (kg)')
ax1.set_title("Progresja Siłowa (Styczeń - Lipiec 2026)", fontsize=12, color='#e6edf3', pad=10, fontweight='bold')
ax1.set_ylabel("Ciężar roboczy [kg]", fontsize=10, color='#8b949e')
ax1.tick_params(colors='#8b949e')
ax1.grid(True, linestyle='--', alpha=0.2, color='#8b949e')
ax1.legend(loc='upper left', facecolor='#0d1117', edgecolor='#30363d', labelcolor='#e6edf3')

# Panel 2: Body Fat & Muscle Mass Evolution
m_dates = [m['measure_date'][5:] for m in measures] # MM-DD
m_fat = [float(m['body_fat_pct']) for m in measures]
m_muscle = [float(m['muscle_mass_pct']) for m in measures]

ax2.plot(range(len(measures)), m_fat, color='#ff6b6b', linewidth=2, marker='s', markersize=5, label='Poziom tkanki tłuszczowej (%)')
ax2.plot(range(len(measures)), m_muscle, color='#1dd1a1', linewidth=2, marker='^', markersize=5, label='Masa mięśniowa (%)')
ax2.set_title("Ewolucja Składu Ciała (7 Miesięcy)", fontsize=12, color='#e6edf3', pad=10, fontweight='bold')
ax2.set_xticks(range(len(measures)))
ax2.set_xticklabels(m_dates, color='#8b949e')
ax2.set_ylabel("Wartość [%]", fontsize=10, color='#8b949e')
ax2.tick_params(colors='#8b949e')
ax2.grid(True, linestyle='--', alpha=0.2, color='#8b949e')
ax2.legend(loc='upper right', facecolor='#0d1117', edgecolor='#30363d', labelcolor='#e6edf3')

plt.tight_layout()

reports_dir = Path(r"C:\Projects\Aktualne projekty w trakcie\atylla-pro\docs\reports")
reports_dir.mkdir(parents=True, exist_ok=True)
out_png = reports_dir / "jan_kowalski_7months_progress.png"
fig.savefig(str(out_png), facecolor='#0d1117', edgecolor='none')
plt.close(fig)

print("=" * 70)
print(f"[RAPORT] Wygenerowano wykres 7-miesięczny dla: {jan['name']}")
print(f"Lokalizacja pliku: {out_png}")
print(f"Liczba zamkniętych pakietów w historii: {len([p for p in pkgs if p.get('end_training_id')])}")
print(f"Aktualny pakiet w toku: {len([p for p in pkgs if not p.get('end_training_id')])}")
print("=" * 70)
