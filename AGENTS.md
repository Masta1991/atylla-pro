# Atylla Pro — zasady pracy

## Backup

Gdy użytkownik poprosi o backup, wykonaj:

1. `git tag -a backup-v<wersja> -m "Backup: stabilna wersja v<wersja>"`
2. `git branch backup/v<wersja>` (gałąź zapasowa)
3. `git bundle create ..\atylla-pro-backup-v<wersja>.bundle --all`
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
