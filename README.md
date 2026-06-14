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

### v1.3.0 — 2026-06-13
- Absencje jako adnotacje — nie modyfikują już calendar_events
- Kalendarz sprawdza tabelę absences bezpośrednio
- Uproszczenie logiki anulowania zajęć

### v1.2.6 — 2026-06-13
- Poprawka: lista absencji nie aktualizowała się po utworzeniu nowej
- Ładowanie absencji z serwera po utworzeniu (zamiast broken optimistic update)

### v1.2.5 — 2026-06-13
- Kalendarz: ulepszony badge anulowanego slotu
- Informacja o przyczynie anulowania po tapnięciu na slot

### v1.2.4 — 2026-06-12
- Manager: wyświetlanie powodu absencji na anulowanych slotach
- Wyświetlanie nazwiska klienta zastępczego w badge'u

### v1.2.3 — 2026-06-12
- Reorganizacja menu bocznego
- Zmiana nazwy „Wyniki" na „Strefa Trenera"
- Nowy web bundle

### v1.2.2 — 2026-06-12
- Przebudowa ManagerScreen: harmonogram z klientów, pozostałe z kalendarza
- Wyświetlanie bieżącego dnia w nagłówku
- Nowy web bundle

### v1.2.1 — 2026-06-12
- Bezpieczniejsze parsowanie dat w isEventInSchedule
- parseInt dla dnia/godziny
- Nowy web bundle

### v1.2.0 — 2026-06-12
- Podział Managera na „Treningi z Harmonogramu" i „Pozostałe"
- Niezależne zaznaczanie i kopiowanie w obu sekcjach
- Nowy web bundle

### v1.1.0 — 2026-06-11
- Śledzenie godzin absencji (model, schema)
- Anulowanie konkretnej godziny zamiast całego dnia
- Optymistyczna aktualizacja UI
- Nowy web bundle

### v1.0.64 — 2026-06-10
- Priorytetyzacja części planu nad grupami mięśniowymi przy przywracaniu ciężarów ćwiczeń
- Nowy web bundle

### v1.0.63 — 2026-06-10
- Auto-ładowanie ćwiczeń z planu przy ponownym wejściu do treningu
- Nowy web bundle

### v1.0.62 — 2026-06-09
- Poprawka usuwania: użycie .execute() zamiast .single()
- Wymuszenie ponownego pobrania danych po usunięciu
- Nowy web bundle

### v1.0.61 — 2026-06-09
- Usuwanie starego eventu przy zmianie daty/godziny
- Odświeżanie po usunięciu
- Poprawki cache invalidation dla osiedlania klienta
- Nowy web bundle

### v1.0.59 — 2026-06-09
- Invalidacja cache klientów po osiedleniu
- Ikona absencji w menu hamburger
- Nowy web bundle

### v1.0.58 — 2026-06-08
- Poprawka separacji plan_id/workout_type_id
- Autosave w treningu
- Obsługa absencji w harmonogramie
- Nowy web bundle

### v1.0.57 — 2026-06-08
- Poprawka liczenia anulowanych w statystykach
- Aktualizacja schematu bazy danych (migracja v1.0.57)
- Invalidacja cache klientów po osiedleniu
- Nowy web bundle

### v1.0.56 — 2026-06-07
- Absences UI — harmonogramowanie nieobecności
- Wersjonowanie bump

### v1.0.53 — 2026-06-06
- Interfejs absencji i ogólne poprawki UI
- Level 2 migration + wipe history

### v1.0.52 — 2026-06-06
- Poprawki UI, calendar replacement payload
- Bump wersji

### v1.0.50 — 2026-06-05
- Deploy wersji webowej
- Wyłączenie zoomowania na web (PWA)

### v1.0.49 — 2026-06-05
- Podział ustawień na osobne ekrany zarządzania
- Implementacja edytora planów treningowych z seriami
- Release v1.0.49

### v1.0.48 — 2026-06-04
- Deployment wersji 1.0.48

### v1.0.47 — 2026-06-04
- Natywny wykres trenera (zastąpienie react-native-chart-kit)

### v1.0.46 — 2026-06-04
- Poprawki kafelków (UI)

### v1.0.45 — 2026-06-04
- Wersja 1.0.45

### v1.0.44 — 2026-06-03
- Hotfix logowania

### v1.0.43 — 2026-06-03
- Wersja 1.0.43

### v1.0.42 — 2026-06-03
- Wersja 1.0.42

### v1.0.41 — 2026-06-03
- Wersja 1.0.41

### v1.0.40 — 2026-06-03
- Wersja 1.0.40

### v1.0.39 — 2026-06-03
- Wersja 1.0.39

### v1.0.38 — 2026-06-02
- Wersja 1.0.38
- Poprawka raportów

### v1.0.36 — 2026-06-02
- Wymuszenie czyszczenia cache w PWA dla v1.0.36
- Wysyłanie przez WhatsApp
- Auto-scroll kalendarza

### v1.0.35 — 2026-06-01
- Wersja stabilna (backup-v1.0.35-stable)

### v1.0.33 — 2026-06-01
- Przywrócenie manifestów PWA
- Optymalizacja wydajności TrainingScreen

### v1.0.32 — 2026-06-01
- Dostosowanie paczek (package adjustments)
- Nowy build frontend

### v1.0.30 — 2026-05-31
- Deployment wersji 1.0.30
- Nowy widok filtrowania historii z auto-save

### v1.0.29 — 2026-05-31
- Deployment wersji 1.0.29

### v1.0.28 — 2026-05-31
- Deployment wersji 1.0.28

### v1.0.27 — 2026-05-31
- Deployment wersji 1.0.27

### v1.0.26 — 2026-05-31
- Deployment wersji 1.0.26

### v1.0.25 — 2026-05-30
- Globalna optymalizacja cache: TrainingScreen, PaymentsScreen, ResultsScreen
- Nowy build PWA

### v1.0.24 — 2026-05-30
- Optymalizacja cache dla ClientsScreen i ClientFormScreen
- Skrócenie czasów ładowania

### v1.0.23 — 2026-05-29
- Poprawki frontend: ekran płatności, ekran treningu, kopiowanie w managerze
- Cache API
- Nowe ikony aplikacji
- Zaktualizowane pliki statyczne PWA

### v1.0.22 — 2026-05-29
- PWA install button (przycisk instalacji poza React)
- Service Worker dla instalacji PWA na Android
- Nowe ikony (głowa psa), zaokrąglony górny pasek, ciepły tryb jasny
- Zastąpienie SMTP/Brevo → Resend API dla e-mail
- Poprawka SMTP: port 465→587 (STARTTLS), solidniejsza obsługa danych
- Poprawka minifikacji: zmienna C → Accent
- Debug: onerror handler dla JS bundle + wskaźnik ładowania JS w HTML
- Stała instrukcja instalacji dla Android Chrome
- Poprawka MIME types dla Service Worker i manifestu
- Statyczne pliki PWA z favicon.ico
- AGENTS.md: zasady sesji, sprawdzanie stash, procedury backup/restore

### v1.0.20 — 2026-05-28
- Pełny backup z bundle frontend

### v1.0.16 — 2026-05-28
- Aktualizacja build PWA
- Demo login
- Bump wersji frontend

### v1.0.15 — 2026-05-27
- Przeprojektowanie dolnego paska nawigacyjnego (Bottom Bar)
- 3 przyciski: KLIENCI (lewo), GŁÓWNA z okrągłą ikoną pieska wystającą ponad pasek (środek), EDYCJA (prawo)
- Pasek przypięty na stałe do dolnej krawędzi ekranu

### v1.0.14 — 2026-05-27
- Bump submodułu frontend

### v1.0.12 — 2026-05-27
- Poprawka: kliknięcie na docelowy slot teraz przenosi zapis (isMoveTarget zamiast isMoving)

### v1.0.11 — 2026-05-27
- Drag & drop: long press na zapisie → przenoszenie na dowolny slot (swap API)
- Banner informacyjny z przyciskiem anulowania podczas przenoszenia

### v1.0.10 — 2026-05-27
- Poprawka: potwierdzenie usunięcia zapisu w kalendarzu na web (window.confirm zamiast Alert.alert)

### v1.0.9 — 2026-05-27
- Fix: PanResponder blokował Alert.alert na web

### v1.0.8 — 2026-05-27
- Potwierdzenie usuwania w trybie edycji kalendarza

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
