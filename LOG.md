# Dziennik Zmian i Testów — Atylla Pro

## 2026-08-09 — Wdrożenie Standardu Zarządzania i Skilla QA
- **Zakres**: Wdrożenie pełnego pakietu governance wzorowanego na projekcie Jarvis (`AGENTS.md`, `PROJECT.md`, `implementation_plan.md`, `MODEL_HANDOFF.md`, `ATYLLA_INSTRUKCJA.md`, `memory/decisions.md`, `BACKUP_POLICY.md`).
- **Wynik**: Struktura zarządzania projektem zsynchronizowana ze standardem korporacyjnym.

## 2026-09-04 — v1.4.0: caly tydzien na tablecie (web)
- Kalendarz: telefon bez zmian (3 dni ze scrollem), tablet pokazuje caly tydzien Pon-Sob (6 dni naraz). Detekcja rontend/src/ui/device.js (mniejszy bok >= 600dp lub iPad; na web liczona z okna, wiec szeroki desktop tez widzi 6 dni). Auto-scroll do biezacego dnia tylko na telefonie.
- Deploy: ./deploy.ps1 -Version 1.4.0 (bundle index-ced30531, push master + tagi v1.4.0/backup-v1.4.0, Railway przebudowuje).

## 2026-09-04 — v1.5.0: szuflada + licznik pakietu z 2.0 (web)
- Backup przed zmiana: tag backup-v1.4.0 + backup/atylla-pro-backup-v1.4.0.bundle (zweryfikowany).
- Kalendarz: tap na kratke otwiera szuflade zarzadzania (Trening/Dodaj, Przenies, Nieobecnosc pobierz-zwroc, Rozlicz, Historia, Usun z blokada startu pakietu; pusta nieobecnosc: Zastepstwo + Cofnij). Wyglad siatki bez zmian.
- Klienci: chip pakietu pod nazwiskiem (cur/size, miesieczny: N, doptata +N przy nadwyzce).
- Deploy: ./deploy.ps1 -Version 1.5.0 (bundle index-5f437116, push master + tagi, Railway przebudowuje).

## 2026-09-04 — v1.5.1: fix szuflady (web)
- Przyczyna: w porcie 1.x siatka nie dostawala propa onSelectSlot, tap spadat na stara nawigacje. Fix: wpiecie onSelectSlot w render siatki. Deploy ./deploy.ps1 -Version 1.5.1 (bundle index-e4f6a71a, Railway przebudowuje).

## 2026-09-05 — E2E paczki auto-rozliczen 32/32 (konto testowe)
- Harness service_role, 3 iteracje x 3 cykle (pakiet+settle+approve, timely-cancel, close-early), cleanup zweryfikowany (0 sladow). Cykle: tiles 1-2-3+LAST, balance 1-2-3, late-keep, shift po timely, free-count, end-marker LAST. Raport: C:/Users/MACIEJ~1/AppData/Local/Temp/opencode/e2e-report.txt. HTTP-auth i klikanie UI = user.

## 2026-09-05 — UI E2E na 3001 (kółko testowe, zero zapisow)
- Haslo testowe w C:/Projects/temp/.env (POZA repo). Playwright: login OK, kalendarz z danymi, szuflada rozliczonego (bez Nieobecnosc/Rozlicz - OK), szuflada nierozliczonego (Nieobecnosc -> Z/Bez/Powrot -> Powrot OK), ekran DZIEN (wiersze + akcje + Zatwierdz OK). Screenshoty w Temp/opencode/ui-e2e. Menu hamburger nieotwieralne headless (nie zweryfikowano wizualnie historii/end-modala/klientow - bundle OK, logika API OK). Zero bledow konsoli.

## 2026-09-06 — v1.6.0: deploy (Railway przebudowuje)
- Paczka: DayClose/zamykanie dnia, tryb PAKIET zamiast EDYCJI (bottom bar + AppLayout + deep-link), pakiety laczone (wspolna pula + partner treningu, migracja 001 wykonana na Supabase przed deployem), fix twardego resetu (PGRST204 active_package_id + unlink puli), fix 401-silent (wylogowanie na Login), historia przyszlosci, chip licznika, raporty (serie/odznaki/widgety/gify/kalendarz miesiaca/eksport WhatsApp), menu.
- Migracja 001_shared_packages.sql MUSIALA byc wykonana recznie w dashboardzie (brak DDL lokalnie) — wykonana 06.09 przed deployem, zweryfikowana (3 kolumny).
- Dane testowe: Agnieszka (144 logi, 36 sesji) na koncie testowym; reszta testow posprzatana.
- Deploy: ./deploy.ps1 -Version 1.6.0 (commit d448ac9, tagi v1.6.0/backup-v1.6.0, push master, bundle backup/atylla-pro-backup-v1.6.0.bundle zweryfikowany ~99 MB).

## 2026-09-06 — v1.6.1: deploy (Railway przebudowuje)
- Kalendarz: odznaki cykli miesiecznych (START CYKLU na pierwszym treningu cyklu, OSTATNI po domknieciu; pakiety bez zmian START PAKIETU), fix szerokosci kolumn week (-8px, brak overflow).
- Klienci: chip "brak pakietu" bez daty, "pakiet: X/Y" / "miesieczny: N", przycisk Pomiary jako editBtn.
- Rozliczenia: karta biezacego (otwartego) cyklu na gorze historii + "Cykl otwarty", ukrycie kosza dla karty otwartej.
- Raporty: frekwencja liczy DNI treningowe (unikalne daty), nie logi; eksport PNG czeka na img.decode + 800ms (fix ucietych gifow na telefonie).
- Deploy: ./deploy.ps1 -Version 1.6.1 (commit 66873b6, bundle index-be2445ce2c7d49388ec7965e25364468.js 1.6MB, tagi v1.6.1/backup-v1.6.1, push master, bundle backup/atylla-pro-backup-v1.6.1.bundle zweryfikowany).

## 2026-09-06 — v1.6.2: fix gifow (Railway przebudowuje)
- Przyczyna: bundle web odwoluje sie do /assets/assets/exercise-gifs/*.gif, a deploy.ps1 kopiowal tylko frontend/dist/_expo -> backend/static/_expo. Gify z frontend/dist/assets nigdy nie trafialy na produkcje (404). Lokalnie przez Metro dzialaly.
- Fix: deploy.ps1 kopiuje teraz frontend/dist/assets -> backend/static/assets (merge). Zweryfikowano: backend/static/assets/assets/exercise-gifs/5x gif istnieje, bundle index-b718c0b0171c2728813b50717698892d.js odwoluje sie do tych sciezek, backend montuje /assets.
- Deploy: ./deploy.ps1 -Version 1.6.2 (commit 8dc061b, bundle index-b718c0b0171c2728813b50717698892d.js, tagi v1.6.2/backup-v1.6.2, push master, bundle backup/atylla-pro-backup-v1.6.2.bundle zweryfikowany).

## 2026-09-07 — v1.6.3: fix przenoszenia startu pakietu + kafelek pakietu laczonego (Railway przebudowuje)
- Tylko ten fix (bez lokalnego 1.7.x portal-klienta; 1.7.x zostaje w stashu "1.7.0-portal-klienta-lokalnie-zostawione-na-pozniej").
- Przyczyna 1 (Agata 04/09/2026 12:00 -> 11:00, pakiet 1/10): POST /calendar/swap robil UPSERT (nowy UUID) + DELETE, kopiujac tylko client_id/workout_type_id/status/is_settled. Gubil plan_id (nowy trening "bez planu") i sierocil client_packages.start_training_id (rozliczenia nie przesuwaly daty startu). Miesieczne (Ewa Dabrowska) liczone po dacie, wiec ich to nie dotyczylo.
- Fix 1 (backend/routers/calendar.py swap_events): przenoszenie przez UPDATE po id — id wiersza zostaje, pakiet i rozliczenia podazaja automatycznie; logi workout_logs ida za treningiem; zamiana dwoch zajetych slotow przez bufor 1970-01-01 (unique); selecty scoped po trainer_id.
- Przyczyna 2 (Sylwia+Marcin pakiet laczony 14, kafelek 1/10): backend ustawial clients.package_size tylko dla rozliczonych (event_counts), nierozliczone braly stara kolumne clients.package_size albo default 10.
- Fix 2 (assign_chronological_numbers): package_size zawsze z SSOT pakietu (event_positions), fallback do kolumny; flaga LAST/OVERFLOW na tym samym rozmiarze.
- Weryfikacja: py_compile OK, symulacja kafelka 1/14 OK, status czysty (tylko backend/routers/calendar.py).
- Deploy: ./deploy.ps1 -Version 1.6.3 (bundle index-709dd7edc96077a16a75c16220483473.js 1.6MB, tagi v1.6.3/backup-v1.6.3, push master, bundle backup/atylla-pro-backup-v1.6.3.bundle zweryfikowany; backup pre: backup/atylla-pro-backup-pre-1.6.3.bundle).
- Po deploynie do sprawdzenia w apce: przenies start pakietu Agaty 12->11 (ma zniknac 12:00, plan zachowany, rozliczenia z nowa data startu) oraz kafelek Sylwii/Marcina x/14.

## 2026-09-07 — v1.6.4: kafelek Cofnij rozliczenie w szufladzie (Railway przebudowuje)
- Potrzeba: rozliczony trening bez pakietu (zapomniane zalozenie pakietu) — brakowalo drogi powrotnej.
- Fix: backend POST /calendar/{date}/{hour}/unsettle (is_settled -> False; id wiersza zostaje, pakiet przelicza sie sam) + api.unsettleWorkout + kafelek "Cofnij rozliczenie" w szufladzie TYLKO dla rozliczonych (potwierdzenie przed cofnieciem; dla nierozliczonych kafelek niewidoczny).
- Weryfikacja: py_compile OK, node --check api.js OK, status czysty (calendar.py, CalendarScreen.js, api.js).
- Deploy: ./deploy.ps1 -Version 1.6.4 (bundle index-08fced6777103a7174992f4f109cf418.js 1.6MB, tagi v1.6.4/backup-v1.6.4, push master, bundle backup/atylla-pro-backup-v1.6.4.bundle zweryfikowany; backup pre: backup/atylla-pro-backup-pre-1.6.4.bundle).
- 1.7.x (portal klienta + hardening) dalej lokalnie w stashu, nie wdrozony.

## 2026-09-07 — v1.6.5: dolar za rozliczone zastepstwo po odwołaniu (Railway przebudowuje)
- Problem: trening odwolany (nieobecnosc w slocie), w jego miejsce inny trening, po rozliczeniu brak $ na kafelku.
- Przyczyna: CalendarSlot liczyl isAbsent po samym slocie (data+godzina, bez klienta) — stara nieobecnosc gasila podswietlenie i $ (warunek showEv && is_settled && !isAbsent). Backend liczy absencje per klient eventu, frontend byl niespojny.
- Fix (tylko frontend/CalendarScreen.js): nieobecnosc dotyczy slotu gdy ten sam klient (lub pusty slot) i nie starsza niz sam zapis (porownanie created_at — swiezy zapis po odwołaniu ignoruje stara nieobecnosc).
- Weryfikacja: symulacja logiki 5/5 (zastepstwo obcy klient false, ten sam klient nowy zapis false, oryginalny odwolany true, pusty slot true, brak nieobecnosci false).
- Deploy: ./deploy.ps1 -Version 1.6.5 (bundle index-2ab5b27369fd3fc7feca04fe41897cae.js 1.6MB, tagi v1.6.5/backup-v1.6.5, push master, bundle backup/atylla-pro-backup-v1.6.5.bundle zweryfikowany; backup pre: backup/atylla-pro-backup-pre-1.6.5.bundle).
- 1.7.x dalej lokalnie w stashu, nie wdrozony.

## 2026-09-07 — v1.6.6: start cyklu po usunieciu + ponownym wpisie (Ania) (Railway przebudowuje)
- Problem (prod, read-only): Ania miesieczny od 02.09; trener usunal trening 02.09 i wpisal ponownie; START CYKLU wyladowal na 04.09, licznik wolnych 1, karta "BEZ PAKIETU".
- Przyczyna: delete_event tworzy absencje przy KAZDYM usunieciu; ponowny wpis (upsert) wisi na starej absencji; numeracja wykluczala aktywny trening z absencja (frontend i backend), free-count ja liczyl.
- Fix: (1) numeracja ignoruje absencje dla AKTYWNYCH eventow (pakiet + single; kazdy przeplyw absencji przestawia event na deleted/cancelled, wiec active+absencja to zawsze zastepstwo/ponowny wpis); (2) wpis/replace/swap kasuje absencje TEGO klienta w slocie (cudze zostaja); (3) free-count pomija sloty z aktywnym treningiem klienta; (4) kafelek: zajety slot = brak absencji (statusowa regula zamiast timestampow z 1.6.5); (5) badge MIESIECZNY dla single z data startu (zamiast mylacego BEZ PAKIETU).
- Weryfikacja na danych Ani: 02.09 START+1, 04.09 tile 2, karta 0/Od 02.09/free 0 (bylo: 02.09 puste, 04.09 START+1, free 1). py_compile OK.
- Deploy: ./deploy.ps1 -Version 1.6.6 (bundle index-d667adc76279b96d4af7a45ab3f36fc0.js 1.6MB, tagi v1.6.6/backup-v1.6.6, push master, bundle backup/atylla-pro-backup-v1.6.6.bundle zweryfikowany; backup pre: backup/atylla-pro-backup-pre-1.6.6.bundle).
- 1.7.x dalej lokalnie w stashu, nie wdrozony.
