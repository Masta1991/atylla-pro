# Atylla Pro — Podręcznik Projektu

## Cel produktu

Atylla Pro to kompleksowy system SaaS dla trenerów personalnych, umożliwiający zarządzanie kalendarzem treningowym, bazą podopiecznych, pakietami i rozliczeniami finansowymi, dziennikami treningowymi, pomiarami sylwetki oraz generowaniem profesjonalnych raportów PDF / e-mail z wykresami progresji.

## Architektura i Stack Technologiczny

```text
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND (Expo SDK 56 / PWA)                │
│  - React Native 0.85 / React 19 (New Architecture)          │
│  - Expo Router / React Navigation                           │
│  - Ekrany: Kalendarz, Klienci, Pomiary, Treningi, Rozliczenia│
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

## Stan wdrożony

- **Backend**: API FastAPI z pełnym CRUD dla klientów, zaawansowanym kalendarzem tygodniowym (godziny 6–21, obsługa drag & drop, soft-delete), modułem pomiarów z wykresem progresu, dziennikami treningowymi oraz generatorami raportów.
- **Frontend**: Aplikacja mobilna Expo (iOS / Android) oraz pre-built PWA serwowana przez FastAPI pod `/app/` lub w osobnym hoscie.
- **Baza Danych**: Supabase PostgreSQL z pełnymi relacjami kluczy obcych i strukturą multi-tenant (`trainer_id`).

## Niezmienne Granice

1. Pojedynczym źródłem prawdy dla obliczeń finansowych i liczby pozostałych treningów w pakiecie jest FastAPI backend.
2. Zdarzenia w kalendarzu nie mogą być twardo usuwane bez sprawdzenia powiązanych wpisów rozliczeniowych.
3. Wszystkie sekrety (Supabase API Key, JWT Secret, SMTP credentials) żyją w `.env` i nie trafiają do kodu.
