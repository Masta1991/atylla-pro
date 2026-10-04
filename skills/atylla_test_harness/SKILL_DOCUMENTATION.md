# Zakres testów Atylla Pro

## Ciekawostki dnia — 2026-10-04, lokalne 2.1.23

Runner obejmuje `test_daily_facts_import.py` i `frontend_daily_facts.test.cjs`:
zgodność 313 wpisów z Excelem, odrzucanie niepoprawnych danych, dokładne daty,
niedziele, powtarzanie cykli, lata przestępne, Europe/Warsaw i północ przy DST.
Dodatkowy test: jednorazowy podgląd 4.10.2026 wygasa o polskiej północy.
Porównanie z XLSX wymaga źródła lokalnego; w klonie bez niego jest SKIP.
Aktualny zakres: 131 Python/API, 51 JS i parser 50 modułów; bez PGlite.

`python scripts/import-daily-facts.py --check` porównuje JSON z Excelem bez zmian.
Uruchomienie bez `--check` aktualizuje lokalny JSON; aplikacja nie czyta XLSX w runtime.

Odbiór UI: `node backend/tests/offline/browser_daily_facts.test.cjs <lokalny-build>`.
Najpierw zachowaj bazowy odczyt wersji przed zmianą, uruchamiając ten sam test
z `--baseline` i ścieżką bazowego buildu. Wyniki w `.tmp/daily-facts-2.1.23`.
Test blokuje zewnętrzne połączenia i przechwytuje API; baza i prawdziwe konta są
nieużywane. Zakres i ograniczenia: `docs/audits/DAILY_FACTS_2.1.23_2026-10-04.md`.

## Aktualizacja 2026-10-02 — lokalna 2.1.18

Runner `harness.py --postgres`: 200 kontroli (100 Python/API, 44 JS, 56 SQL/PGlite)
oraz parser 43 modułów JS. Nowe `test_seasonality.py` i `postgres_seasonality.test.cjs`
sprawdzają liczenie sesji, brak/zero, zastąpienie miesiąca, kompletność i powtarzalność,
izolację trenerów, CAS zapisu/usunięcia, uprawnienia i błędy. SQL 013 jest uruchamiany
wyłącznie w PGlite. Nie jest stosowany w Supabase przez runner.

Przeglądarkowy odbiór aktualnego lokalnego buildu:

```powershell
node backend/tests/offline/browser_workout_notes.test.cjs .tmp/LOKALNY-BUILD
node backend/tests/offline/browser_requested_changes.test.cjs .tmp/LOKALNY-BUILD
node backend/tests/offline/browser_seasonality.test.cjs .tmp/LOKALNY-BUILD
```

Dowody z bieżącej sesji: `.tmp/changes-20261002/`. API musi wskazywać
`http://127.0.0.1:8000`; przechwyty są syntetyczne, ruch zewnętrzny blokowany.
Build przygotuj z `--clear`, aby cache Metro nie zachował wcześniejszego celu API.
Szczegóły i ograniczenia odbioru: `docs/audits/CHANGES_2.1.18_2026-10-02.md`.

## Aktualizacja 2026-09-26 — 2.1.16

Runner `harness.py --postgres` obejmuje 177 przypadków/kontroli: 88 Python/API,
19 JS API, 5 historii, 6 katalogu, 9 kolejki, 5 notatek oraz 45 SQL/PGlite
(17 rozliczeń, 10 sesji, 9 kopiowania tygodnia, 9 notatek). Parsuje 42 moduły JS.

`test_workout_notes.py` sprawdza przenoszenie przypomnień między dniami,
obu uczestników, paginację ponad 1000 rekordów, izolację, błędy odczytu i API.
`frontend_workout_notes.test.cjs` obejmuje zachowanie notatki źródłowej,
pomijanie metadanych oraz ochronę nowej treści przed spóźnionym potwierdzeniem.
`postgres_workout_notes.test.cjs` uruchamia migrację 012 dwukrotnie, testuje
trwały odczyt, zmianę tekstu, konflikt, RLS, anon, zamknięty pakiet oraz brak
konfliktu z równoczesną edycją treningu na tej samej wersji `updated_at`.
Testy PGlite są sekwencyjne; nie dowodzą zachowania wielu połączeń.

Osobny odbiór renderowanego buildu, syntetyczne API i blokada ruchu zewnętrznego:

```powershell
node backend/tests/offline/browser_workout_notes.test.cjs .tmp/local-build-WERSJA-ID
node backend/tests/offline/browser_training_slow_initial_read.test.cjs .tmp/local-build-WERSJA-ID
node backend/tests/offline/browser_training_failed_plan_read.test.cjs .tmp/local-build-WERSJA-ID
node backend/tests/offline/browser_training_remove_group.test.cjs .tmp/local-build-WERSJA-ID
```

Notatki: sześć szerokości 320–1440 px, jedna ikona kartki bez licznika,
krótki podgląd, bezpośredni odczyt w szufladzie, długi tekst przewijany
klawiaturą, 503, konflikt 409 i ponowne otwarcie aktualnej treści
bez przeładowania strony, zachowanie po przeładowaniu, ponowne przypomnienie
po edycji. `ATYLLA_QA_ZOOM=2` włącza osobny przebieg 720×500 CSS px / skala 2
(reflow odpowiadający 200%, nie natywny zoom). `ATYLLA_QA_WIDTH` ogranicza
przebieg diagnostyczny do wskazanej szerokości; usuń te zmienne po teście.
Trzy regresje treningu sprawdzają na 390/1440 px odpowiednio pełną inicjalizację
przed edycją, brak zapisu błędnie wczytanego planu i pojedyncze usunięcie partii.
Dowody: `.tmp/notes-20260926/`; wersja 2.1.16 wymaga migracji 012 przed
uruchomieniem nowego backendu. Lokalny test nie stosuje migracji w Supabase.
Odbiór: `docs/audits/NOTES_AND_REAUDIT_FIXES_2.1.16_2026-09-26.md`.

## Aktualizacja 2026-09-26 — 2.1.15

Runner `harness.py --postgres` obejmuje 154 przypadki/kontrole: 79 Python/API,
19 JS API, 5 JS historii, 6 katalogu ćwiczeń, 9 kolejki zapisów oraz 36
SQL/PGlite (17 rozliczeń, 10 sesji, 9 kopiowania tygodnia). Dodatkowo parsuje
40 modułów frontendowych. Są to testy lokalne na danych syntetycznych.

`frontend_workout_save_queue.test.cjs` sprawdza nowszą edycję podczas wolnego
zapisu, zatrzymanie automatycznych ponowień po awarii, niepewny commit,
powrót do bazowej wartości, szybką pierwszą edycję, anulowane potwierdzenie,
niezmienność snapshotu, ochronę zmiany sesji i zatrzymanie kolejki po wyjściu.
`frontend_workout_catalog.test.cjs` sprawdza także superserie w udostępnianiu,
członków nieprzylegających do siebie i osierocone identyfikatory superserii.

Osobne testy renderowanego lokalnego buildu (uruchamiać z katalogu projektu):

```powershell
node backend/tests/offline/browser_audit_autosave.test.cjs .tmp/local-build-WERSJA-ID
node backend/tests/offline/browser_audit_forms.test.cjs .tmp/local-build-WERSJA-ID
node backend/tests/offline/browser_audit_absences.test.cjs .tmp/local-build-WERSJA-ID
```

Wymagają lokalnego Chrome i zależności Playwright/axe w `.tmp/billing-qa`
(instalacja opisana niżej). API jest syntetyczne, serwer tylko 127.0.0.1,
zewnętrzne żądania są blokowane, udostępnienie przechwytywane lokalnie.
Autozapis testowany na 390/1440 px, pozostałe scenariusze na sześciu
szerokościach 320–1440 px. Raporty: `.tmp/audit-fixes-20260926/`.
Opcjonalne `ATYLLA_QA_ZOOM=2` dla formularzy i Absencji używa viewport
720×500 CSS px ze skalą 2, czyli reflow odpowiadającego 200% w 1440×1000;
nie wykonuje natywnego zoom przeglądarki. Raporty mają osobne katalogi `-zoom`.
Po takim uruchomieniu usunąć zmienną z sesji terminala.

Wyniki i ograniczenia odbioru: `docs/audits/AUDIT_FIXES_2.1.15_2026-09-26.md`.
Starsze liczebności poniżej są historyczne.

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
