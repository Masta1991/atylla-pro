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
