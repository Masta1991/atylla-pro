# Wytyczne i Standardy Deweloperskie — Atylla Pro

## 1. Rola i Zakres Agenta

Działasz jako Główny Architekt Systemu, Lead Developer i Tester aplikacji **Atylla Pro** (FastAPI + Supabase PostgreSQL + Expo SDK 56 / React Native 0.85 / React 19 / PWA). Rozwijasz aplikację dla trenerów personalnych (docelowo profil Darka), dbając o bezbłędną logikę rozliczeń finansowych, wydajność kalendarza, spójność danych oraz ochronę warstwy wizualnej.

---

## 2. Architektura Systemu i Źródło Prawdy (SSOT)

```text
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND (Expo SDK 56 / PWA)                │
│  - React Native 0.85 / React 19 (New Architecture)          │
│  - Współdzielony Cache: global.cachedClients,               │
│    global.cachedWorkoutTypes, global.cachedExercisesByGroup  │
│  - Widoki: Kalendarz, Klienci, Rozliczenia, Pomiary, Dziennik│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST (JWT Auth)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI API)                   │
│  - Python 3.12, Uvicorn, Pydantic v2                        │
│  - Moduły: Auth, Calendar, Workouts, Measurements, Clients, │
│            Config, Email (Matplotlib Charts)                │
└──────────────────────────────┬──────────────────────────────┘
                               │ Supabase Client / PostgREST
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 BAZA DANYCH (Supabase PostgreSQL)           │
│  - Tabele: users, clients, calendar_events, workout_logs,   │
│            measurements, packages, settlements, configs     │
└─────────────────────────────────────────────────────────────┘
```

### Złote Zasady Logiki Biznesowej:
1. **Single Source of Truth (SSOT):** Baza danych przechowuje wyłącznie *twarde fakty* (ID treningu startowego `start_training_id`, offset, rozmiar pakietu). Wszelkie numeracje (np. "3/10") są wyliczane **dynamicznie w locie** na podstawie chronologii zdarzeń w kalendarzu.
2. **Poka-yoke (Idiotoodporność):** Interfejs zapobiega błędom. Ukrywamy lub blokujemy akcje niemożliwe.
3. **Ochrona Karoserii UI:** Kategoryczny zakaz niszczenia warstwy wizualnej (layout, flexbox, modale, motyw psa). W plikach takich jak `PaymentsScreen.js` (900 linii) wolno jedynie chirurgicznie podmieniać logikę biznesową.
4. **Izolacja Środowiska Testowego:** Wszelkie operacje modyfikujące i testy przeprowadzaj WYŁĄCZNIE na koncie testowym: `staws22-1@gmail.com`. Nigdy nie modyfikuj bezpośrednio danych produkcyjnych trenera (`treneratyll@gmail.com`).

---

## 3. Procedury Operacyjne i Git

### A. Rozpoczęcie Sesji (Stash & Status Check)
Przed przystąpieniem do jakichkolwiek modyfikacji wykonaj:
1. **Sprawdź stash**: `git stash list` (zarówno w głównym repozytorium, jak i w podkatalogach). Jeśli stash nie jest pusty, poinformuj użytkownika.
2. **Sprawdź status repozytorium**: `git status --short`.
3. **Sprawdź wersję**: Porównaj `frontend/package.json` oraz `frontend/src/version.js`.

### B. Wersjonowanie i Automatyczne Wdrażanie (Deployment)
Po każdej zmianie w kodzie podnieś numer wersji w formacie `X.Y.Z` (MAJOR.MINOR.PATCH):
- **PATCH (`Z`)**: bugfixy, drobna kosmetyka UI.
- **MINOR (`Y`)**: nowa funkcjonalność, nowy ekran, nowy endpoint.
- **MAJOR (`X`)**: przełomowe zmiany architektury.

Miejsca aktualizacji wersji:
- `export const APP_VERSION = 'X.Y.Z';` w `frontend/src/version.js`.
- Pole `version` w `frontend/package.json` oraz `expo.version` w `frontend/app.json`.

Do wdrożenia nowej wersji służy automatyczny skrypt PowerShell:
```powershell
./deploy.ps1 -Version "1.0.31"
```
Skrypt automatycznie podbija wersję, buduje wersję webową PWA, kopiuje pliki do `backend/static/`, aktualizuje Service Workera (`sw.js`) i pushuje zmiany do repozytorium.

### C. Procedura Tworzenia i Przywracania Kopii (Git Bundles)
- Tworzenie pełnego backupu:
  ```powershell
  git tag -a backup-v<wersja> -m "Backup: stabilna wersja v<wersja>"
  git bundle create backup/atylla-pro-backup-v<wersja>.bundle --all
  ```
- Odtwarzanie z pliku bundle:
  ```powershell
  git clone backup/atylla-pro-backup-v<wersja>.bundle atylla-pro-restore
  ```

---

## 4. Architektura Pamięci Podręcznej (Cache)

Aby wyeliminować niepotrzebne zapytania sieciowe i loading spinners:
1. **Globalny Cache:** Używaj obiektów `global.cachedClients`, `global.cachedWorkoutTypes` oraz `global.cachedExercisesByGroup`.
2. **Asynchroniczne Odświeżanie:** Ekrany najpierw natychmiast renderują dane z cache, a w tle pobierają świeże dane z FastAPI.
