# Model Handoff — Atylla Pro

## Bieżące zadanie
- **Identyfikator**: `TASK-ATYLLA-01`
- **Zakres**: Standaryzacja architektury zarządzania projektem oraz budowa autonomicznego skilla testów QA.
- **Stan**: Zarządzanie zsynchronizowane z architekturą Jarvis; przygotowanie skilla testowego.

## Ryzyka i Uwagi
1. Obliczenia pakietowe w `calendar.py` i `clients.py` muszą ściśle respektować stany `completed`, `cancelled`, `planned`.
2. Podczas testów automatycznych należy używać dedykowanego izolowanego test-usera, aby nie modyfikować danych rzeczywistych trenerów.

## Dokładnie jeden następny krok
Zbudować i przetestować dedykowany skill `skills/atylla_test_harness/` z pełną dokumentacją ewaluacyjną.
