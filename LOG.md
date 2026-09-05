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
