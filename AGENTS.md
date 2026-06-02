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

## Wersjonowanie i Wdrożenie (Deployment)

Po każdej zmianie w kodzie (nawet małej) podnieś numer wersji w formacie `X.Y.Z` (MAJOR.MINOR.PATCH):
- **PATCH** (`Z`): drobne poprawki, bugfixy, kosmetyka UI
- **MINOR** (`Y`): nowa funkcjonalność, nowy ekran, nowy endpoint
- **MAJOR** (`X`): przełomowe zmiany architektury, migracje

Miejsca do aktualizacji przy każdym bucie wersji:
- Zmień `export const APP_VERSION = 'X.Y.Z';` w [version.js](file:///c:/Projects/atylla-pro/frontend/src/version.js). Pozostałe ekrany i layouty automatycznie zaimportują tę wersję z tego pliku.
- Zmień pole `version` w `frontend/package.json` oraz `expo.version` w `frontend/app.json` (lub pozwól skryptowi wdrożeniowemu zrobić to automatycznie).

### Automatyczne Wdrażanie (Build & Deploy)

Do wdrożenia nowej wersji aplikacji służy zautomatyzowany skrypt PowerShell [deploy.ps1](file:///c:/Projects/atylla-pro/deploy.ps1):
```powershell
# Z automatycznym podbiciem wersji (zmienia version.js, package.json, app.json, buduje PWA, kopiuje pliki, aktualizuje sw.js/index.html i pushuje na GitHub)
./deploy.ps1 -Version "1.0.26"

# Bez zmiany wersji (używa obecnej z version.js, buduje, kopiuje i deployuje)
./deploy.ps1
```

## Architektura Cache (Optymalizacja Wydajności)

Aby zapobiec niepotrzebnym zapytaniom sieciowym i opóźnieniom (loading spinners):
1. **Współdzielony Cache**: Używaj globalnych obiektów cache `global.cachedClients`, `global.cachedWorkoutTypes` oraz `global.cachedExercisesByGroup`.
2. **Synchronizacja Ekrany**: Jeśli jeden ekran pobierze listę klientów lub typy treningów, zapisuje je do globalnego cache. Inne ekrany (np. `TrainingScreen`, `PaymentsScreen`) powinny najpierw sprawdzić, czy dane są w cache, a jeśli tak — załadować je natychmiastowo i asynchronicznie odświeżyć w tle.

