# Model Handoff — Atylla Pro

## FRONTEND-GIT-RECOVERY-001 — 2026-08-23

- Naprawiono nieodtwarzalną strukturę Git: `frontend/` był gitlinkiem wskazującym
  commit osobnego repozytorium, ale projekt nie miał `.gitmodules`, a repo frontendu
  nie miało żadnego remote. Świeży klon głównego repo nie mógł pobrać aplikacji.
- Przed zmianą utworzono i zweryfikowano osobne bundle repo nadrzędnego i frontendu w
  `C:\Projects\Backups\workspace\GITHUB-SYNC-2026-08-23-01\bundles\` oraz zachowano katalog
  metadanych `.git` frontendu w checkpoincie.
- Oryginalny commit frontendu `267fa53defd79065f73905eb7e6e77ff5e666658`
  zaimportowano obiektowo do repo nadrzędnego. Wszystkie pliki aplikacji poza lokalnym
  `expo-server.log` zachowują treść z tamtego commita; log został usunięty i dodany do
  `.gitignore`, ponieważ jest regenerowalnym artefaktem lokalnego Metro/Expo.
- Docelowy model: jeden Git root `atylla-pro`; `frontend/` jest zwykłym katalogiem
  wersjonowanym razem z backendem, testami i dokumentacją.
- Walidacja po migracji: `atylla_test_harness` wykonał 3 pełne cykle, łącznie
  `21/21 PASS`; raport zapisano w `skills/atylla_test_harness/latest_test_report.json`.
- Rollback: przywrócić bundle `Atylla.bundle` oraz, jeśli potrzebne, osobne repo z
  `Atylla-frontend.bundle`; nie odtwarzać gitlinka bez poprawnego remote i `.gitmodules`.

## Bieżące zadanie
- **Identyfikator**: `TASK-ATYLLA-01`
- **Zakres**: Standaryzacja architektury zarządzania projektem oraz budowa autonomicznego skilla testów QA.
- **Stan**: Zarządzanie zsynchronizowane z architekturą Jarvis; przygotowanie skilla testowego.

## Ryzyka i Uwagi
1. Obliczenia pakietowe w `calendar.py` i `clients.py` muszą ściśle respektować stany `completed`, `cancelled`, `planned`.
2. Podczas testów automatycznych należy używać dedykowanego izolowanego test-usera, aby nie modyfikować danych rzeczywistych trenerów.

## Dokładnie jeden następny krok
Zbudować i przetestować dedykowany skill `skills/atylla_test_harness/` z pełną dokumentacją ewaluacyjną.
