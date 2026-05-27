# Atylla Pro

Aplikacja do zarządzania treningami personalnymi — kalendarz, baza klientów, dzienniki treningowe, pomiary ciała, plany treningowe i automatyczne raporty e-mail z wykresami.

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Backend | Python 3.12 · FastAPI · Uvicorn |
| Baza danych | Supabase (PostgreSQL) |
| Frontend mobilny | Expo SDK 56 · React Native 0.85 · React 19 (New Architecture) |
| Frontend web | PWA (Expo Web + react-native-web) |
| Wykresy | matplotlib (backend) · react-native-chart-kit (frontend) |
| Deployment | Railway |

## Struktura projektu

```
atylla-pro/
├── backend/                  # API FastAPI
│   ├── main.py               # Punkt wejścia aplikacji
│   ├── config.py             # Ładowanie zmiennych środowiskowych
│   ├── database.py           # Klient Supabase (singleton)
│   ├── models.py             # Modele Pydantic
│   ├── routers/              # Moduły API
│   │   ├── auth.py           # POST /auth/login, /auth/refresh
│   │   ├── clients.py        # CRUD klientów + harmonogramy
│   │   ├── calendar.py       # Kalendarz tygodniowy, drag & drop, soft-delete
│   │   ├── workouts.py       # Dzienniki treningowe (batch save)
│   │   ├── measurements.py   # Pomiary ciała
│   │   ├── config_router.py  # Typy treningów, partie, ćwiczenia, plany
│   │   ├── email_router.py   # Raporty e-mail z wykresami matplotlib
│   │   └── debug.py          # Debug endpoints
│   ├── static/               # Aplikacja webowa PWA (pre-built)
│   ├── .env.example          # Wzór pliku .env
│   └── requirements.txt
├── frontend/                 # Aplikacja Expo (React Native)
│   ├── App.js                # Root + nawigacja
│   ├── app.json              # Konfiguracja Expo + EAS
│   ├── package.json
│   ├── src/
│   │   ├── components/       # AppLayout (współdzielony layout)
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── screens/          # 12 ekranów
│   │   ├── services/api.js   # Klient API
│   │   └── assets/theme.js   # Dark theme (GitHub-dark)
│   └── assets/               # Ikony aplikacji
├── database/
│   └── schema.sql            # Pełny schemat PostgreSQL + seed data
├── Plany.txt                 # Gotowe plany treningowe (PL)
├── Procfile                  # Railway deployment
├── requirements.txt          # Zależności Pythona (główny katalog)
└── .python-version           # Python 3.12
```

## Funkcje

- **Kalendarz tygodniowy** — widok poniedziałek–sobota, godziny 6–21, przeciągnij-i-upuść do zamiany, miękkie i twarde usuwanie
- **Zarządzanie klientami** — CRUD, harmonogramy treningowe, progresja siłowa
- **Dziennik treningowy** — zapis całych sesji (batch), historia per klient
- **Pomiary ciała** — waga, % tkanki tłuszczowej, % masy mięśniowej w czasie
- **Plany treningowe** — ćwiczenia pogrupowane według partii mięśniowych
- **Raporty e-mail** — automatyczne HTML z wykresami matplotlib (słupkowy — sesje tygodniowe, liniowy — progresja siłowa)
- **PWA** — wersja webowa jako Progressive Web App
- **Dark mode** — ciemny motyw inspirowany paletą GitHub

## Endpointy API (45 endpointów)

| Prefiks | Liczba | Opis |
|---|---|---|
| `/auth` | 2 | logowanie, odświeżanie tokena |
| `/clients` | 6 | CRUD klientów, generowanie harmonogramów |
| `/calendar` | 8 | widok tygodnia, upsert, swap, soft/hard delete |
| `/workouts` | 6 | dzienniki, batch save, historia |
| `/measurements` | 5 | CRUD pomiarów |
| `/config` | 15 | typy treningów, partie, ćwiczenia, plany |
| `/email` | 2 | wysyłka raportów i planów |

## Uruchomienie lokalne

### Backend

```bash
# Wymagany Python 3.12
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt

cd backend
cp .env.example .env       # Uzupełnij klucze Supabase i SMTP
python -m uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npx expo start              # development server
npx expo start --web        # wersja webowa
```

### Budowa web (PWA)

```bash
cd frontend
npx expo export --platform web
# Skopiuj zawartość dist/ do backend/static/
```

## Deployment (Railway)

Aplikacja jest wdrożona na Railway. Plik `Procfile` uruchamia Uvicorn:

```
web: cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

Backend serwuje zarówno API, jak i statyczną aplikację PWA z jednego procesu.

Budowa aplikacji mobilnej przez EAS Build:
```bash
cd frontend
eas build --platform android   # APK/AAB
eas build --platform ios       # IPA
```

## Zmienne środowiskowe

Plik `backend/.env`:

| Zmienna | Opis |
|---|---|
| `SUPABASE_URL` | URL projektu Supabase |
| `SUPABASE_SERVICE_KEY` | Klucz service_role |
| `SUPABASE_ANON_KEY` | Klucz anon publiczny |
| `SMTP_EMAIL` | Adres Gmail do wysyłki raportów |
| `SMTP_PASSWORD` | Hasło aplikacji Gmail |

## Baza danych

Schemat w `database/schema.sql` zawiera 10 tabel:
`workout_types`, `muscle_groups`, `exercises`, `training_plans`, `plan_exercises`, `clients`, `calendar_events`, `workout_logs`, `measurements`, `deleted_workouts`, `trainer_profiles`.

Aby zainicjalizować schemat, wklej cały plik w Supabase SQL Editor.

---

## Historia zmian (Changelog)

### v1.0.10 — 2026-05-27
- Poprawka: potwierdzenie usunięcia zapisu w kalendarzu na web (window.confirm zamiast Alert.alert)

### v1.0.7 — 2026-05-26
- Ciemne tło dolnego paska nawigacji (bottom bar)
- Ikona aplikacji 180px
- Poprawki w menadżerze (ManagerScreen)
- Harmonogram klienta — generowanie i wyświetlanie
- Poprawki kalendarza — drag & drop, statusy wydarzeń

### v1.0.6 — 2026-05-26
- Poprawka kalendarza (swap, soft-delete)
- Poprawka status bara na iOS — ciemne tło

### v1.0.5 — 2026-05-26
- Wersja webowa PWA z własną ikoną
- Dodanie wersji webowej aplikacji (Expo Web)
- Poprawka `requirements.txt`

### v1.0.4 — 2026-05-26
- `Procfile` i `requirements.txt` w głównym katalogu
- Przeniesienie `railway.json` do głównego katalogu

### v1.0.3 — 2026-05-26
- Dodanie `railway.json` i `.python-version`

### v1.0.2 — 2026-05-26
- Clean deploy: usunięcie `start.sh` i `runtime.txt`
- Poprawki konfiguracji Railway

### v1.0.1 — 2026-05-26
- Dodanie `Procfile` i konfiguracji Railway
- Pierwszy deploy na Railway

### v1.0.0 — 2026-05-26
- Pierwsza wersja aplikacji Atylla Pro
- Pełen schemat bazy danych Supabase
- API FastAPI z 45 endpointami
- Aplikacja mobilna Expo (React Native)
