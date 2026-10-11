# 2.1.26 — przywrócenie ikon, 2026-10-11

Przyczyna regresji 2.1.25: Expo budowane z dowiązanymi zależnościami zmieniło
ścieżkę zasobów na `assets/____frontend/node_modules`. Reguła Git
`**/node_modules/` wykluczyła 19 fontów i 11 PNG z commitu. Lokalny export
zawierał te pliki, więc wcześniejszy audyt lokalny przechodził. Produkcja
zwracała 404. To błąd pakowania i zakresu odbioru wydania.

Poprawka dodaje wszystkie brakujące zasoby, wąski wyjątek w Gitignore,
kontrolę kompletnego exportu względem Git i blokadę predeploy. Bundle JS
2.1.25 i 2.1.26 są identyczne poza numerem wersji. Logika absencji i SQL
pozostają z wydanej 2.1.25; to wydanie nie wymaga migracji bazy.

## Obowiązkowa kontrola paczki

1. Zbudować export z właściwym API i `--clear`; zachować manifest i ikony PWA.
2. Dodać komplet zasobów do przygotowanego commitu, nie tylko główny JS.
3. Uruchomić `python scripts/check-release-assets.py EXPORT --repo REPO --ref COMMIT
   --output REPORT --manifest-output REPO/backend/release-assets.json`.
   Kontrola porównuje obiekty Git; obecność ignorowanego pliku na dysku nie wystarcza.
4. Dodać manifest do commitu. Odtworzyć `backend/static` przez `git archive`
   i na tym katalogu wykonać testy przeglądarkowe, w tym asercje fontów.
5. Railway uruchamia `python release_preflight.py`: walidacja konfiguracji
   i hashy wszystkich 44 zasobów. Brak fontu lub zmieniony index zatrzymuje
   komendę niezerowym wynikiem. Po deployu sprawdzić wykonanie w logach.
6. Sprawdzić HTTP i hashe wszystkich plików aktywnej paczki oraz renderowane
   ikony z produkcyjnych plików. Sam `/health`, `/version` i JS nie wystarczają.

## Dowody lokalne

- `.tmp/icons-20261011/before.json`: 30 odpowiedzi 404. Różnice index/manifest
  względem surowego exportu wynikają z normalizacji końców linii w Git.
- `git-before.json`: dokładnie 30 braków; nowy test fontów FAIL na archiwum 2.1.25.
- `git-after.json`: komplet zasobów zgodny z Git (powtórzyć po ostatecznym commicie).
- `browser-after/report.json`: 14 wariantów, 84 stany absencji + kalendarz/menu.
- `broader-dark/report.json`, `broader-light/report.json`: 12 wariantów,
  szuflada, wspólny pakiet, płatne odwołanie, historia płatności, edycja
  licznika, wykres roczny i podsumowanie tygodnia. Dane i API syntetyczne.
- Regresja: 151 odkrytych Python/API (150 PASS, lokalny XLSX SKIP), 51 JS,
  parser 50 modułów, 92 SQL/PGlite PASS. XLSX osobno 3/3 PASS w kanonicznym drzewie.
- Dwa dodatkowe testy zasobów PASS, w tym prawdziwy proces predeploy:
  komplet PASS, po usunięciu syntetycznego fontu kod wyjścia niezerowy.
- Recenzja niezależna: kompletność i identyczność JS potwierdzone.
  Uwagę o `&&` usunięto przez pojedynczy wrapper Python i sprawdzono procesem.

Publiczny checkpoint statyki 2.1.25 (ZIP/CRC/SHA256):
`C:/Projects/Backups/atylla-pro/icons-2.1.26-20261011`.
Poprzednia pełna zaszyfrowana kopia kodu/bazy pozostaje bez zmian.
Nie cofać do niepełnej statyki 2.1.25; ewentualny rollback logiki powinien
zachować dodane fonty/PNG. Brak zmian produkcyjnych danych w tym wydaniu.

NOT_TESTED: fizyczny telefon, natywne aplikacje i rzeczywiste zapisy trenera.
Wyniki live dopisać po potwierdzeniu, nie utożsamiać lokalnego PASS z produkcją.
