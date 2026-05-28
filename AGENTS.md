# Atylla Pro — zasady pracy

## Rozpoczęcie pracy — sprawdzenie stanu projektu

Za każdym razem gdy zaczynamy sesję, wykonaj:

1. **Sprawdź stash** — `git stash list` w każdym repozytorium (główne + frontend). Użytkownik może pracować z różnymi modelami AI i edytorami, więc zmiany mogą czekać w stashu. Jeśli stash nie jest pusty, poinformuj użytkownika i zapytaj czy przywrócić.
2. **Sprawdź status repo** — `git status --short` aby zobaczyć niezcommitowane modyfikacje.
3. **Sprawdź wersję** — porównaj `frontend/package.json` / `frontend/app.json` z ostatnim commitem.

## Przywracanie backupu

Gdy użytkownik poprosi o przywrócenie backupu:

1. **Znajdź najnowszy backup** — przeszukaj folder `backup/` (w tym podfoldery) pod kątem plików `.bundle` i plików informacyjnych. Sortuj po dacie modyfikacji lub numerze wersji.
2. **Jeśli nie masz pewności który backup** — zapytaj użytkownika przed przywróceniem.
3. Przywróć z bundle: `git clone "sciezka/do/pliku.bundle" katalog-docelowy`

## Backup

Gdy użytkownik poprosi o backup, wykonaj:

1. `git tag -a backup-v<wersja> -m "Backup: stabilna wersja v<wersja>"`
2. `git branch backup/v<wersja>` (gałąź zapasowa)
3. `git bundle create backup\atylla-pro-backup-v<wersja>.bundle --all` (w głównym repo)
    - Jeśli frontend (submoduł) też wymaga backupu: `cd frontend; git bundle create ..\backup\atylla-pro-frontend-backup-v<wersja>.bundle --all`
4. Poinformuj użytkownika o utworzonych artefaktach (tag, branch, plik bundle)

Bundle pozwala w każdej chwili odtworzyć repozytorium poleceniem:
`git clone atylla-pro-backup-v<wersja>.bundle atylla-pro-restore`

## Wersjonowanie

Po każdej zmianie w kodzie (nawet małej) podnieś numer wersji. Wersja w formacie `X.Y.Z` (MAJOR.MINOR.PATCH):

- **PATCH** (`Z`): drobne poprawki, bugfixy, kosmetyka UI
- **MINOR** (`Y`): nowa funkcjonalność, nowy ekran, nowy endpoint
- **MAJOR** (`X`): przełomowe zmiany architektury, migracje

Miejsca do aktualizacji przy każdym bucie wersji:

| Plik | Pole |
|---|---|
| `frontend/app.json` | `expo.version` |
| `frontend/package.json` | `version` |

Po zmianie wersji utwórz commit z komunikatem `v<wersja> - <opis zmian>` i tag `v<wersja>`.
