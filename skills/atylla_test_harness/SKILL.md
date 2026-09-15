---
name: atylla-test-harness
description: Run local Atylla Pro regression tests for FastAPI authorization, calendar, billing and frontend session handling, optionally including PGlite PostgreSQL tests. Uses synthetic data, never production.
metadata:
  version: "2.1.0"
---

# Atylla Pro — lokalne testy regresji

Uruchamiaj z katalogu projektu:

```powershell
.\.venv\Scripts\python.exe -B skills/atylla_test_harness/harness.py
```

Do odbioru zapisów finansowych użyj `--postgres`. Ten wariant wykonuje SQL
na lokalnym PGlite, z rolami anon i dwóch syntetycznych trenerów, FK, RLS
i rollbackiem. `scripts/prepare-local.ps1` wymaga tego wariantu. Przy braku zależności
nie omijaj testu: sposób przygotowania i oddzielne testy przeglądarki opisuje
`SKILL_DOCUMENTATION.md`. Pobranie zależności podlega zgodom środowiska.

Opcjonalnie `--verbose` pokazuje testy osobno, a `--cycles N` (alias
`--iterations N`) ponawia przebieg. Powtarzanie tych samych przypadków nie
zwiększa ich pokrycia.

Runner używa rzeczywistych endpointów FastAPI, funkcji rozliczeń i modułu API
frontendu z syntetycznymi danymi oraz atrapami usług. Nie ładuje produkcyjnego
`backend/.env` i nie wysyła wiadomości. Nie uruchamiaj zbiorczego discover
po całym `backend/`: historyczne skrypty wykonują operacje na zewnętrznej bazie.

Raport: `latest_test_report.json`. Kod 0 oznacza przejście zadeklarowanych
testów lokalnych, kod 1 — błąd. Raport zawiera zakres i nieweryfikowane obszary.
Bez `--postgres` PASS nie potwierdza RLS ani transakcji PostgreSQL. Z nim
nie potwierdza współbieżności wielu połączeń ani zgodności wdrożonego Supabase.
Żaden wynik tego runnera nie potwierdza przeglądarki, urządzenia ani produkcji.

Przy rozszerzaniu testów i ocenie pokrycia przeczytaj
[SKILL_DOCUMENTATION.md](SKILL_DOCUMENTATION.md). Katalog zachowuje historyczną
nazwę z podkreśleniami dla kompatybilności istniejących poleceń.
