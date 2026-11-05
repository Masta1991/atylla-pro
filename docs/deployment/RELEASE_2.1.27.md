# 2.1.27 — nawigacja dnia, 2026-10-17

Użytkownik jawnie zlecił publikację po implementacji. Commit kandydata:
`d269761f96581662bcde0debb4ba8982517ef92c`, oparty na wydanym
`f18309b74fd7c4c0058a4e9341557285bf40f7c4` (2.1.26).
Wdrożono przez `origin/master`. Railway deployment
`bbb7ec97-b4ab-4eb9-b8a6-43f26da5382f`: **success**.
Produkcja `/version` **2.1.27**, `/health` **healthy**;
HTTP/hash wszystkich **44/44** aktywnych zasobów PASS.
Dowody: `.tmp/day-release-20261017/status.json` i `live-assets.json`.
Renderowanie produkcyjnych plików: 16 wariantów PASS, fonty loaded, klawiatura,
daty graniczne i nawigacja bez regresji; API w całości przechwycone syntetycznie.
Raport: `.tmp/day-release-20261017/browser-live-final/report.json`.
Pierwszy przebieg odbioru zatrzymał się na wyścigu asercji z etykietą
„Odświeżanie…”. W lokalnym teście dodano oczekiwanie na właściwy licznik;
ponowiony odbiór PASS bez zmiany opublikowanego kodu. Hashe obu wersji testu
zapisano w `final-artifact.json`. Fizycznego telefonu nadal nie testowano.

## Zakres i izolacja

- Strzałki w widoku dnia zmieniają dzień; w tygodniu nadal tydzień.
- Poniedziałek–sobota, spójny nagłówek/licznik/sloty, powrót do dzisiaj.
- Dostępne nazwy kontrolek, reset poziomego scrolla, poprawa dopasowania 320 px.
- Backend zmieniony wyłącznie w numerze wersji. Brak SQL i zmian danych.
- Izolowany klon: `.tmp/day-release-20261017/release`.
- Nie włączono lokalnych zmian opisów planowania ani Excela z ciekawostkami.
- Kanoniczny checkout i stash zachowane; raport runnera nie trafił do commitu.

## Odbiór przed publikacją

- Regresja izolowana PASS: 153 odkryte Python/API, 152 PASS, 1 SKIP lokalnego XLSX;
  51 JS, parser 50 modułów oraz 92 SQL/PGlite. Brak nowego błędu.
  SKIP wynika z braku lokalnego Excela w wydanym repozytorium; znana różnica
  Excel/JSON z kanonicznego drzewa pozostaje osobnym zakresem.
- Expo export `--clear`, produkcyjny API URL potwierdzony w bundlu; brak localhost.
- `check-release-assets.py` PASS 44/44 wobec finalnego commitu.
- Testowane `git archive`; końcowe 44 pliki identyczne z testowanymi bajtowo.
- 16 wariantów Chrome PASS: oba motywy, 320–1440 px, poziom, reflow 200%,
  tekst200, reduced motion, klawiatura i axe top bara; fonty loaded.
- Weekend, miesiąc/rok, 29 lutego, oba DST, puste dni, liczniki, tydzień/dzień,
  503 i dalsza nawigacja PASS. Wszystkie API syntetyczne, bez danych trenerów.
- Niezależny przegląd nie znalazł blokera; ograniczenia zapisano w `review.json`.
- Preflight kandydata PASS 44; testy brakującego fontu i błędnego indexu PASS.
- Dowody: `.tmp/day-release-20261017/{regression.log,final-git-assets.json,
  browser-git/report.json,review.json}`. Build: `production-build`; finalny Git: `final`.
- JS: `index-7b42154aec77898a54ac5def7d6086e1.js`;
  SHA256: `d8046e6db2fbc3e9ab72155ac866d5564f49ab97d3cb2a93e602428e911614a2`.

## Rollback

Checkpoint `C:/Projects/Backups/atylla-pro/day-navigation-2.1.27-20261017`:
`production-2.1.26-code.zip` oraz `manifest.json` z SHA256. ZIP/CRC, odtworzenie
do pustego katalogu i zgodność wszystkich 44 poprzednich zasobów PASS;
odtworzony preflight również PASS. Nie jest to aktualna kopia danych Supabase.
Wydanie nie migruje danych ani schematu; rollback polega na ponownym wdrożeniu
kompletnego commitu `f18309b` (2.1.26) w istniejącej usłudze Railway.
Nie wracać do niepełnej statyki 2.1.25. Produkcyjnego rollbacku nie wykonywano.

## Granice

Nie testowano fizycznego telefonu, native, VoiceOver/TalkBack ani rzeczywistych
zapisów trenerów. Panel Railway w dostępnej sesji przeglądarki wymaga logowania,
więc odczyt surowego logu predeploy nie jest potwierdzony. Status wdrożenia
weryfikujemy przez integrację Railway/GitHub oraz publiczny HTTP/hash i render.
