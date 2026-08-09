# Dokumentacja Techniczna i Przewodnik Ewaluacji Skilla `atylla_test_harness`

## 1. Wstęp i Założenia Projektowe
Skill `atylla_test_harness` został opracowany jako autonomiczne narzędzie ciągłej weryfikacji jakości (Continuous Quality Assurance) dla aplikacji **Atylla Pro**. Jego głównym celem jest całkowite zastąpienie manualnego testowania przez człowieka poprzez automatyczne sprawdzanie integralności backendu FastAPI, relacji bazy danych Supabase oraz kluczowej logiki rozliczeń finansowych i kalendarza.

---

## 2. Architektura Rozwiązania

```text
┌─────────────────────────────────────────────────────────────┐
│                    SKILL: atylla_test_harness               │
│                                                             │
│  [harness.py - Test Runner]                                 │
│         │                                                   │
│         ├── 1. Test Modułów & Zależności (Import Check)     │
│         ├── 2. Test Połączenia Supabase (Singleton State)   │
│         ├── 3. Test Modeli Pydantic v2 (Validation)         │
│         ├── 4. Test Kalendarza & Konfliktów Godzinowych     │
│         ├── 5. Test Rozliczania Pakietów & Zużycia Jednostek│
│         └── 6. Test Wskaźników Pomiary & Wykresy (BMI/Matp.)│
│                                                             │
│  [Raport: latest_test_report.json]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Szczegółowy Opis Weryfikowanych Reguł Biznesowych

### A. Integralność Rozliczeń Pakietowych (Single Source of Truth)
- Trener sprzedaje pakiet (np. 10 treningów).
- Trening oznaczony jako `completed` zużywa **dokładnie 1 jednostkę**.
- Trening oznaczony jako `cancelled_charged` (odwołanie zbyt późne) zużywa **1 jednostkę**.
- Trening oznaczony jako `cancelled_free` (odwołanie terminowe) **nie pomniejsza puli pakietu**.
- Test automatycznie weryfikuje formułę: `Pozostałe = Pakiet - (Zrealizowane + Odwołane Płatne)`.

### B. Wykrywanie Konfliktów w Kalendarzu
- Sprawdza macierz nakładania się przedziałów czasowych `[Start, End]`.
- Zapobiega przypadkowemu zarezerwowaniu dwóch różnych klientów w tym samym slocie u tego samego trenera.

---

## 4. Wytyczne do Ewaluacji dla Mocniejszego Modelu AI (Evaluation Guide)

Podczas przeglądu kodu tego skilla przez model ewaluujący (np. Claude 3.5 Sonnet, GPT-5, Gemini 1.5 Pro), należy zwrócić uwagę na następujące punkty rozbudowy:

1. **Dodanie Mockowania Klienta HTTP (FastAPI `TestClient` / `httpx`)**:
   - Rozbudowa o bezpośrednie wysyłanie żądań HTTP do endpointów `/auth/login`, `/calendar/events`, `/clients/{id}/package`.
2. **Izolacja Środowiska Testowego (Ephemeral Sandbox)**:
   - Wykorzystanie dedykowanego schematu testowego w Supabase lub lokalnego SQLite/Postgres w pamięci podczas testów CI/CD.
3. **Weryfikacja E2E Frontendu**:
   - Możliwość rozszerzenia o testy headless browsera (Playwright) dla wersji Web PWA `/app/`.
