# Zakres testów Atylla Pro

## Aktualizacja 2026-09-15 — 2.1.6

Runner obejmuje także `test_trainer_insights.py` (9 przypadków liczników i API)
oraz `postgres_week_copy.test.cjs` (9 przypadków SQL 011). Łącznie 69 Python,
19 JS API, 5 JS historii, 36 PGlite i 35 modułów frontendowych.
Osobne testy nowych paneli i prawdziwej współbieżności opisuje
`docs/audits/TRAINER_PANELS_2.1.6_2026-09-15.md`. PostgreSQL wymaga nowego,
dedykowanego kontenera bez sieci. Nie uruchamiać na Supabase ani ponownie na
już zainicjalizowanym kontenerze. Fixture UI generuje
`backend/tests/offline/make_trainer_browser_fixture.py`, bez odczytu `.env`.

## Aktualizacja 2026-09-14 — 2.1.2

Aktualna regresja: 52 testy Python, 17 API JS, 5 historii JS i 17 PGlite.
Migracja 009 dodaje atomowe zamknięcie/reset oraz kontrolę wersji klienta.
Nowe `test_atomic_billing.py` sprawdza pojedynczy RPC, brak kasującego fallbacku,
awarie odczytu/zapisu, brak migracji, konflikt i brak automatycznego ponawiania.
SQL testuje ponad 1000 treningów, wspólną pulę, rollback resetu i izolację.

`release_readiness_probe.py` jest teraz testem akceptacyjnym API + SQL:
exit 0 potwierdza usunięcie lokalnego blockera, nie gotowość całej produkcji.
Zapisuje `docs/audits/ATOMIC_BILLING_READINESS_2026-09-14.json`; stary dowód
`RELEASE_READINESS_2026-09-14.json` pozostaje historyczną reprodukcją.

Osobny `postgres_atomic_billing_probe.py` wymaga ŚWIEŻEGO kontenera
`atylla-billing-qa-pg-20260914`, label `codex.task=atylla-billing-20260914`,
obrazu `postgres:17-alpine` i `--network none`, bez publikowanych portów.
Testuje dwa zamknięcia, dwa resety, zamknięcie vs reset oraz równoczesny
bezpośredni zapis kalendarza. Nie uruchamiać na już zainicjalizowanym kontenerze.
Dowód: `docs/audits/ATOMIC_BILLING_POSTGRES_2026-09-14.json`.

`browser_views.test.cjs` wymaga aktualnego buildu 2.1.2. Sprawdza również
role dialogu, Tab/Shift+Tab, obrys fokusu, inert tła, Escape/Enter/Space,
przywrócenie fokusu i odrzuca critical/serious w axe. API jest syntetyczne.

Poniższe opisy liczebności i starego probe dotyczą wersji 2.1.1.

Stan 2026-09-14, wersja lokalna 2.1.1: 47 testów Python, 16 przypadków modułu API,
5 historii frontendowych, 12 PGlite; 33 moduły JS parsują się poprawnie.
`test_session_policy.py` sprawdza 72 h, granicę wygaśnięcia, przedłużenie po 2 dniach,
brak przedłużenia przez refresh, podpis i właściciela sesji oraz wyłączenie timerów SDK.

Dodatkowe testy uruchamiane jawnie, poza runnerem:

- `node backend/tests/offline/browser_session.test.cjs .tmp/local-build-WERSJA-ID`:
  6 scenariuszy logowania, odnowienia, wejścia, aktywności, offline i dwóch kart;
  Chrome i rzeczywisty build, syntetyczna odpowiedź Auth.
- `.\.venv\Scripts\python.exe -B backend/tests/offline/postgres_concurrency_probe.py`:
  wymaga nowego kontenera `atylla-session-qa-pg-20260914`, etykiety
  `codex.task=atylla-session-20260914`, obrazu PostgreSQL 17 i `--network none`.
  Inicjalizuje syntetyczną bazę, sprawdza konflikt dwóch połączeń i dump/restore.
  Nie uruchamiać ponownie na już zainicjalizowanym kontenerze.
- `.\.venv\Scripts\python.exe -B backend/tests/offline/release_readiness_probe.py`:
  celowo zwraca exit 1 przy odtworzeniu błędnego zamknięcia cyklu po awarii odczytu.
  Wynik regresji PASS nie zastępuje tej bramki wydania.

Raporty 2026-09-14 są w `docs/audits/`. Żaden z powyższych testów nie potwierdza
bieżącego schematu produkcyjnego ani konfiguracji Supabase Auth/PostgREST.

Runner `harness.py` wykonuje wyłącznie testy z `backend/tests/offline/`,
testuje moduł frontendowego API przez Node oraz parsuje kod JSX lokalnym Babelem.

- `test_audit_regressions.py`: weryfikacja tożsamości, brak tras wysyłki e-mail,
  kontrakt odnowienia tokenu, serializacja flagi zamkniętego cyklu, dzień końca
  cyklu, jawne null i pominięte pola, kotwice pakietu, użycie wersjonowanego RPC,
  brak kasującego fallbacku, zgodność wersji.
- `frontend_api.test.cjs`: token w body, współdzielenie odnowienia, zachowanie
  sesji przy 503/403 i brak przywrócenia tokenu po wylogowaniu podczas odnowienia.
- `offline_support.py`: syntetyczne identyfikatory i atrapa zapytań; nie
  implementuje PostgreSQL, RLS, FK ani transakcji.

Aktualne statusy aplikacji: `active`, `cancelled`, `deleted`. Zwykły odbyty
trening jest zaliczany po zakończeniu slotu w Europe/Warsaw; `is_settled`
decyduje o naliczeniu odwołania. Nie używaj fikcyjnych statusów completed czy
cancelled_free jako dowodu zgodności z aktualną aplikacją.

`test_billing_sequences.py` sprawdza płatne/bezpłatne odwołania, oczekiwanie
pakietu, ponowne wczytanie, następną rezerwację, offset, Warszawę i 200
deterministycznych losowych historii, >1000 zdarzeń, współdzielenie i błędy danych.
`frontend_billing.test.cjs` wykonuje rzeczywistą funkcję historii, sprawdzając
granice godzinowe, odwołania, członkostwo i brak podwójnego liczenia absencji.

Lokalny PostgreSQL/PGlite (nie używa `.env`, brak danych produkcyjnych):

```powershell
npm.cmd install --prefix .tmp/billing-qa --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
.\.venv\Scripts\python.exe -B skills/atylla_test_harness/harness.py --postgres
```

`postgres_billing.test.cjs` ładuje schema.sql oraz migracje SSOT, 001, 007, 008
do pamięci silnika PostgreSQL. Testuje uprawnienia, FK, rollback logów i zapisu
łączonego, idempotencję absencji, chronione pakiety, zachowanie ID przy zamianie
i odrzucenie starej wersji zapisu. Nie modeluje równoległych połączeń, PostgREST,
produkcyjnego schematu ani rzeczywistego Supabase Auth.

Oddzielny test renderowanego lokalnego buildu:

```powershell
npm.cmd install --prefix .tmp/billing-qa --no-audit --no-fund --ignore-scripts playwright@1.58.2 @axe-core/playwright@4.11.1
node backend/tests/offline/browser_views.test.cjs .tmp/local-build-WERSJA-ID browser-billing-qa-run
```

Wymaga lokalnego Chrome; serwer tylko 127.0.0.1, osobny profil, zablokowane
zewnętrzne żądania, API wyłącznie syntetyczne z opóźnieniem 100 ms. Raporty
i screenshoty w `.tmp/`. Wyjście 0 oznacza wykonanie scenariuszy, nie brak
naruszeń dostępności: sprawdź `violations`, `errors`, `blocked`, `overflow`.
Czasy zawierają okno 250 ms ciszy sieciowej; nie są czasami Railway ani LCP.

Historyczny raport audytu i jego skrypty w `docs/audits/` dokumentują stan
sprzed poprawek. Skrypt odtwarzający defekty nie jest bieżącym testem akceptacyjnym.
