# Atylla Pro

Aplikacja dla trenerów: klienci, kalendarz, treningi, pakiety i rozliczenia.

## Jak korzystać

- [Obsługa aplikacji](docs/USAGE.md)
- [Aktualny stan i następny krok](docs/project/MODEL_HANDOFF.md)
- [Zakres i architektura](docs/project/PROJECT.md)
- [Plan rozwoju](docs/project/BACKLOG.md)
- [Kopie i odzyskiwanie](docs/project/BACKUP_POLICY.md)

Agent zaczyna od AGENTS.md i CONTEXT_MAP.md. Podaj cel i scenariusz odbioru.
Nie trzeba wskazywać wszystkich dokumentów.

## Co znajduje się w folderze

| Miejsce | Przeznaczenie |
|---|---|
| backend, frontend, database | Kod, zasoby i migracje aplikacji. |
| scripts | Używane narzędzia: przygotowanie lokalnego buildu i kontrola składni frontendu. |
| skills | Tester regresji; najnowszy raport zastępuje poprzedni. |
| docs | Obsługa, bieżący stan, wymagania i nadal potrzebne dowody odbioru. |
| backup | Jedna najnowsza zaszyfrowana kopia lokalna wraz z manifestem. |
| .git, .venv, .tmp, .agents | Historia i stash, biblioteki, używane buildy/testy oraz zasady agentów. |

W root pozostają trzy dokumenty wejściowe: README.md, AGENTS.md, CONTEXT_MAP.md.
Procfile, requirements.txt i .python-version określają start i środowisko aplikacji;
.gitattributes i .gitignore są ustawieniami Git.

## Lokalne narzędzia

Przygotowanie: scripts/prepare-local.ps1. Wykonuje testy i tworzy lokalny build.
Dawny deploy.ps1 usunięto — był dodatkowym wywołaniem tego samego narzędzia.

Backend uruchamiaj z backend przez ../.venv/Scripts/python.exe:
-m uvicorn main:app --host 127.0.0.1 --port 8000.
Frontend developerski: npx expo start w frontend.
Lokalny backend może używać zdalnej bazy. Testy zapisów wymagają potwierdzonego
środowiska QA. Status wydania i aktualne adresy sprawdź w handoffie.

## Porządek po pracy

Nie twórz w root logów sesji, checklist napraw ani raportów jednorazowych.
Utrzymuj bieżący stan w docs/project/MODEL_HANDOFF.md, a wynik zadania w jego
własnym katalogu. Po odbiorze usuń zbędne outputy, zachowując potrzebny dowód.
Nowy backup zastępuje poprzedni dopiero po kontroli sum i odtworzenia.

Pełne stare logi i raporty wycofano poza projekt do
C:/Projects/Backups/atylla-pro/root-cleanup-20260915.
