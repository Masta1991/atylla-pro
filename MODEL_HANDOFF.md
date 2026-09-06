# Model Handoff — Atylla Pro

## SESJA 2026-09-06 — pakiety łączone (NIEWDROŻONE, testy lokalnie OK)

### Stan produkcji vs stan lokalny — UWAGA
- Produkcja (Railway): **v1.5.1**.
- Katalog roboczy zawiera **NIEWDROŻONE paczki** (auto-rozliczenia z 04-05.09 + pakiety łączone z 06.09).
  NIE deployować bez: (1) revert `api.js` na Railway URL, (2) zgody użytkownika.

### Pakiety łączone — zakres (decyzje użytkownika 2026-09-06)
1. Wspólna pula: przy starcie pakietu/miesięcznego checkbox „Pakiet wspólny" + wybór osób (PaymentsScreen modal startu). Trening każdego członka schodzi ze wspólnej puli.
2. Wspólny trening: tylko info „z kim" (bez zniżek). Ustawiane w TrainingScreen (picker „Współćwiczący"), widoczne na kafelku, w szufladzie, w widoku dnia i w historii rozliczeń.
3. Reguły: członek z własnym aktywnym pakietem rozlicza się sam (own-wins); eventy sprzed startu puli nie liczą się (jak solo).

### Pliki paczki łączonej (niecommitowane)
- Migracja (WYKONANA na Supabase przez użytkownika 06.09): `database/migrations/001_shared_packages.sql` — `client_packages.shared_client_ids`, `clients.shared_monthly_with`, `calendar_events.partner_client_id`.
- Backend: `models.py` (nowe pola), `routers/clients.py` (unia puli + `shared_with`), `routers/calendar.py` (unia pozycji/kafelków + `partner_name`), `routers/dayclose.py` (`partner_name` w summary).
- Frontend: `PaymentsScreen.js` (shared-picker w starcie, unia eventów, chip licznika, „· z: X" w historii), `TrainingScreen.js` + `api.js` (partner), `ClientsScreen.js` (👥 + „Wspólny z:"), `CalendarScreen.js` („z:" na kafelku i w szufladzie), `DayCloseScreen.js` („(z: X)"), `AppLayout.js` (bottom bar DZIEŃ/GŁÓWNA/PAKIET).
- Wcześniejsze niecommitowane: sesja api.js (401→wylogowanie), PAKIET zamiast EDYCJI, fix historii przyszłości, chip licznika w historii.

### Zweryfikowane lokalnie 2026-09-06 (konto testowe, posprzątane)
- Shared pakiet Paweł+Ania: start z eventu Pawła, oboje 0/10 + shared_with; rozliczenie treningu ANI → oboje 1/10; kafelki z unii (2,3,4,5,6); event sprzed startu i deleted poza numeracją. Pakiet testowy usunięty, settle cofnięte.
- Partner: PUT partnera → week i day/summary zwracają `partner_name: Ania`; potem wyczyszczone.
- Regresja: week 8/8, klienci 47/47, day-summary zgodne ze stanem bazy.

### Znane ograniczenia (MVP)
- Współdzielenie ustawia się TYLKO przy starcie pakietu/rozliczania (brak edycji członków w trakcie).
- Start pakietu wspólnego = własny trening (nie trening członka).
- Wyczyszczenie partnera tylko przez usunięcie i ponowny zapis treningu (PUT z null nie czyści — upsert pomija nulle).

### Fix twardego resetu 2026-09-06 (przetestowany lokalnie)
- Przyczyna: update ustawiał nieistniejącą kolumnę `clients.active_package_id` (PGRST204, 500) — reset wywalał się zawsze, nie tylko przy pulach. Kolumna nie istnieje w schemacie; `active_package_id` jest liczone dynamicznie w `assign_client_packages_status`.
- Przy okazji: reset unlinkuje z cudzych pul (`shared_client_ids`, `shared_monthly_with`) i czyści własne — inaczej licznik wracałby z puli.
- Test: shared Paweł+Ania → reset członka (odklejenie, zera) → reset właściciela (pakiet usunięty, zera). Dane testowe posprzątane.

### Dokładnie jeden następny krok
Czekać na werdykt użytkownika z klikania 3001 (pakiety łączone); jeśli OK: (1) revert `api.js` na Railway URL, (2) `./deploy.ps1 -Version "1.6.0"` (MINOR), (3) bundle-backup v1.6.0, (4) dopisać LOG.

## SESJA 2026-09-04 — paczka lokalna „auto-rozliczenia” (NIEWDROŻONA, testy lokalnie OK)

### Stan produkcji vs stan lokalny — UWAGA
- Produkcja (Railway): **v1.5.1** (szuflada z fixem onSelectSlot + chipy pakietu + tablet 6 dni).
- Katalog roboczy zawiera **NIEWDROŻONĄ paczkę** (8 plików zmienionych + 2 nowe, zero commitów).
  NIE deployować bez: (1) revert `api.js` na Railway URL, (2) zgody użytkownika.

### Pliki paczki (git status, commit bazowy 7939265 v1.5.1)
- M `backend/models.py` — `CalendarEventResponse` + `is_start_of_package`, `billing_flag` (LAST|OVERFLOW), `tile_number`.
- M `backend/routers/calendar.py` — pozycje w cyklu (`event_positions`, ordinalne, bez deleted i bez timely-absences), flagi: LAST = `end_training_id` LUB pozycja==rozmiar (fallback otwarte pakiety), OVERFLOW = pozycja>rozmiar; single: pozycje + tile_number.
- M `backend/main.py` — rejestr `dayclose.router`.
- M `frontend/App.js` — route `DayClose`.
- M `frontend/src/screens/CalendarScreen.js` — szuflada z wyborem rozliczenia (Z/Bez/Powrót, reszta przycisków chowa się), kafelki 68px + font 12 (mniejsze 10 przy imieniu >18 znaków), odznaki START/OSTATNI/POZA, numer z `tile_number`, pasek HISTORIA→DZIEŃ.
- M `frontend/src/services/api.js` — **TYMCZASOWO `API_BASE = 127.0.0.1:8000`, REVERT PRZED DEPLOYEM** + `getDaySummary/approveDay`.
- M `LOG.md` — dopiski sesji (niecommitowane).
- ?? `backend/routers/dayclose.py` — `GET /day/summary/{day}`, `POST /day/approve`, reguła `slot_passed` (Europe/Warsaw, koniec slotu; 8:00→po 9:00).
- ?? `frontend/src/screens/DayCloseScreen.js` — nawigacja dni, odhaczanie „Nie rozliczaj", akcje wiersza Otwórz/Rozlicz/Odwołaj→(Z/Bez/Powrót), Zatwierdź + audyt `day_approvals` (tabela już istnieje w Supabase z migracji 2.0).

### Uzgodnione reguły rozliczeń (decyzje użytkownika 2026-09-04)
1. Numer na kafelku = POZYCJA w pakiecie/cyklu od momentu zapisu (także nierozliczone).
2. Auto-rozliczenie po końcu slotu (8:00 → po 9:00, Europe/Warsaw; serwer jest na UTC).
3. Zatwierdzenie DNIA obowiązkowe (na razie): salda spinają akcje trenera (settle/approve/absence), nie samo minięcie czasu.
4. No-show = ręczne odwołanie + rozliczenie przez trenera (brak osobnego stanu).
5. Odwołanie rozliczone zostaje z numerem i wlicza się w pakiet; odwołanie w porę (absencja, brak rozliczenia) WYPADA z numeracji, reszta przesuwa się w dół.
6. Flagi z pakietu: START = `start_training_id`, LAST = `end_training_id` (wcześniejsze zamknięcie!) lub pozycja==rozmiar (pakiet otwarty), OVERFLOW = pozycja>rozmiar.
7. Historia z paska przeniesiona: kalendarz ma DZIEŃ; tryb historii dostępny z paska innych ekranów (AppLayout → Calendar+activateHistory) i z szuflady.

### Zweryfikowane lokalnie 2026-09-04 (dane prod, tylko odczyt + konto testowe)
- Magdalena Lewandowska (6 zamkniętych pakietów 20): tydzień 27–31.07 → 18,19,20+LAST,21+LAST(end). Bez dziur.
- Agata (pakiet 10, start 4.09, koniec na 5.09): 4.09→1+START, 5.09→2+LAST (end_training_id). Tydzień 14–20.09: 2,3,4,5 ciągiem (odwołanie w porę pominięte).
- `slot_passed`: 9:01✓ 9:00✗ 8:30✗ wczoraj✓ jutro✗. Endpointy `/day/*` w openapi. Export web bundla czysty.
- Znane: tokeny wygasają → apka cicho wylogowuje (pusty kalendarz zamiast komunikatu). Propozycja na później: komunikat „Sesja wygasła".

### Pętla lokalna (serwery mogą nie przetrwać restartu komputera)
- Backend 1.x: `C:\Projects\Development\atylla-pro\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000` z `backend/` (logi `backend/uvicorn-8000-local*.log`). `.env` lokalny, klucze działają, gitignore.
- Frontend 1.x: `npx expo start --web --port 3001` z `frontend/` → http://localhost:3001 (Metro hot-reload; BROWSER=none).
- Porty: 3000 = Expo 2.0, 8001 = backend 2.0 (osobny projekt, NIE ruszać przy pracy nad 1.x).
- Testy TYLKO konto testowe `staws22-1@gmail.com` (47 klientów). Prod `treneratylla@gmail.com` (35 klientów) — nie tykać zapisami. W bazie leżą seedy `[SEED-LOCAL-DEMO]` z sesji 2.0 (konto testowe, 8 treningów 31.08–05.09) — do usunięcia po podglądzie.
- Backupy: `backup/atylla-pro-backup-v1.4.0.bundle` (96.5 MB), `backup/atylla-pro-backup-v1.5.1.bundle` (95.7 MB), oba zweryfikowane + tagi.

### Dokładnie jeden następny krok
Czekać na werdykt użytkownika z klikania 3001; jeśli OK: (1) revert `api.js` na Railway URL, (2) `./deploy.ps1 -Version "1.6.0"` (MINOR — nowa funkcjonalność), (3) bundle-backup v1.6.0, (4) dopisać LOG. NIE deployować paczki bez kroku 1.

---

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
