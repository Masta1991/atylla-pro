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
