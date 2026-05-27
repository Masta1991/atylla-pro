# Backup v1.0.14 — Atylla Pro

## Data utworzenia
2026-05-27

## Opis aplikacji

Aplikacja do zarządzania treningami personalnymi. Pozwala na prowadzenie kalendarza tygodniowego, bazę klientów, dzienniki treningowe, pomiary ciała, plany treningowe oraz automatyczne raporty e-mail z wykresami.

### Stack technologiczny
- **Backend**: Python 3.12 · FastAPI · Uvicorn · Supabase (PostgreSQL)
- **Frontend mobilny**: Expo SDK 56 · React Native 0.85 · React 19
- **Frontend web**: PWA (Expo Web + react-native-web)
- **Deployment**: Railway

### Struktura
- `backend/` — API FastAPI (routery: auth, clients, calendar, workouts, measurements, config, email, debug)
- `frontend/` — Aplikacja Expo (React Native) z 12 ekranami
- `database/` — Schemat PostgreSQL (10 tabel)
- `backend/static/` — Aplikacja webowa PWA (pre-built)

### Główne funkcje
- **Kalendarz tygodniowy** — widok pon–sob, 6:00–21:00, drag & drop przez long press, miękkie usuwanie z koszykiem
- **Zarządzanie klientami** — CRUD, harmonogramy treningowe, ćwiczenia do progresji siłowej
- **Dziennik treningowy** — zapis sesji (batch), historia per klient, stepper obciążenia
- **Pomiary ciała** — waga, % tkanki tłuszczowej, % masy mięśniowej w czasie
- **Plany treningowe** — ćwiczenia pogrupowane według partii mięśniowych, wysyłka e-mail
- **Raporty e-mail** — HTML z wykresami matplotlib (słupkowy — sesje tygodniowe, liniowy — progresja siłowa)
- **PWA** — wersja webowa jako Progressive Web App
- **Tryb edycji** — przełącznik HOME/EDYCJA, przycisk X do usuwania, long press do przenoszenia

### Wygląd (UI)
- Ciemny motyw (GitHub-dark palette: #0d1117, #161b22, #21262d)
- Akcent: kolor pomarańczowy `C.accent` (~#f0883e)
- Dolny pasek nawigacji z HOME i EDYCJA
- Wersja webowa jako PWA z własną ikoną

### API (45 endpointów)
| Prefiks | Liczba | Opis |
|---|---|---|
| `/auth` | 2 | logowanie, odświeżanie tokena |
| `/clients` | 6 | CRUD klientów, generowanie harmonogramów |
| `/calendar` | 8 | widok tygodnia, upsert, swap, soft/hard delete |
| `/workouts` | 6 | dzienniki, batch save, historia |
| `/measurements` | 5 | CRUD pomiarów |
| `/config` | 15 | typy treningów, partie, ćwiczenia, plany |
| `/email` | 2 | wysyłka raportów i planów |

### Baza danych (Supabase PostgreSQL)
Tabele: `workout_types`, `muscle_groups`, `exercises`, `training_plans`, `plan_exercises`, `clients`, `calendar_events`, `workout_logs`, `measurements`, `deleted_workouts`, `trainer_profiles`

---

## Ostatnie 10 zmian (Changelog)

### v1.0.15 (nieoficjalna) — usunięte podświetlanie docelowych slotów podczas przenoszenia
### v1.0.14 — przycisk usuwania X na slocie, optimistic updates (UI natychmiast + API w tle), long press skrócony do 300ms
### v1.0.12 — fix: kliknięcie na docelowy slot przenosi zapis (isMoveTarget zamiast isMoving)
### v1.0.11 — long press drag & drop: przenoszenie zapisów po przytrzymaniu, banner informacyjny
### v1.0.10 — fix: potwierdzenie usuwania zapisu na web (window.confirm zamiast Alert.alert)
### v1.0.9 — fix: PanResponder blokował Alert.alert na web
### v1.0.8 — potwierdzenie usuwania w trybie edycji kalendarza
### v1.0.7 — ciemne tło bottom bar, ikona 180px, poprawka menadżera, harmonogram klienta
### v1.0.6 — poprawka kalendarza (swap, soft-delete), status bar iOS
### v1.0.5 — wersja webowa PWA z własną ikoną, Expo Web

---

## Instrukcja przywracania

```bash
# Przywrócenie głównego repozytorium z bundle'a
git clone backup/atylla-pro-backup-v1.0.14.bundle atylla-pro-restore

# Frontend jest niezależnym repozytorium (submoduł bez .gitmodules)
# Przejdź do katalogu frontend i przywróć z osobnego bundle'a:
cd atylla-pro-restore/frontend
git init
git remote add origin ../../backup/atylla-pro-frontend-backup-v1.0.14.bundle
git fetch origin
git checkout master
```

Lub rozpakowanie bundle'a bezpośrednio:
```bash
git clone backup/atylla-pro-backup-v1.0.14.bundle atylla-pro
cd atylla-pro/frontend
git clone ../../backup/atylla-pro-frontend-backup-v1.0.14.bundle .
git checkout master
```
