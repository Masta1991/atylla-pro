# Model Handoff — Atylla Pro

## Synchronizacja repozytorium — 2026-11-05

Gałąź `codex/local-sync-2026-11-05` przygotowano na bazie zdalnego
`master` (`d269761f96581662bcde0debb4ba8982517ef92c`). To synchronizacja
kodu i dokumentacji, bez publikacji aplikacji, migracji ani zapisów danych.
Backend wykonawczy, pełny `backend/static/`, manifest zasobów i wersja 2.1.27
pozostają zgodne z tym zdalnym wydaniem. Lokalny starszy manifest 2.1.26
nie został przeniesiony.

Zachowano niewydane źródłowe doprecyzowanie tekstów planowania wraz z testami
oraz poprawkę oczekiwania na licznik w teście nawigacji dnia. Statyki nie
przebudowano: opisów planowania nie ma w dostarczonej paczce produkcyjnej.
Przed ewentualnym wydaniem tych zmian potrzebne są osobny numer wersji,
nowy build i odbiór. Ta gałąź nie jest gotowym nowym wydaniem.

Pominięto `.env`, lokalny Excel ciekawostek, cache Supabase, lokalny raport
runnera i nieopublikowane archiwa raportów/stanów. Odsyłacze do takich dowodów
w dokumentach historycznych mogą wskazywać wyłącznie pliki lokalne.
Źródłowy checkout, jego indeks oraz stash pozostawiono bez zmian.

Kontrola synchronizacji: parser 51 modułów JS, test opisów planowania, składnia
dwóch testów przeglądarki i runnera Python oraz metadane JSON PASS. Wszystkie
44 zasoby manifestu 2.1.27 potwierdzono hashami w Git i na dysku. Skan nowych
plików indeksu nie wykrył wzorców sekretów; nie jest audytem historii. Pełnej
regresji, nowych buildów ani odbioru produkcji w tym kroku nie wykonywano.


## Utrzymanie instrukcji — 2026-11-05

Dodano routing do [preferowanych procedur](../../CONTEXT_MAP.md#preferowane-procedury) i odsyłacz w AGENTS.
Zmiana dotyczy wyłącznie instrukcji; nie wykonywano lekcji, transakcji ERP,
testów aplikacji ani wydania. Poniższe dowody i ograniczenia zachowują swoje
pierwotne daty; ten wpis nie jest ponownym odbiorem. Następny krok pozostaje
bez zmian. Próba odczytu Git status zakończyła się `Permission denied`
(w Atylli również odczyt stash); bieżącego stanu Git nie potwierdzono.

## Stan — 2026-10-17, produkcja 2.1.27

Wdrożono na jawne polecenie użytkownika nawigację dnia w kalendarzu.
Produkcja: https://atylla-pro-production.up.railway.app.
Commit: d269761f96581662bcde0debb4ba8982517ef92c.
Railway: bbb7ec97-b4ab-4eb9-b8a6-43f26da5382f, success.
/version 2.1.27, /health healthy; 44/44 zasobów HTTP/hash PASS.
Poprzedni stan lokalny: history/MODEL_HANDOFF_2026-10-17_before_day_release.md.

## Wydana zmiana

- Strzałki w widoku dnia zmieniają dzień; w tygodniu nadal tydzień.
- Zachowano poniedziałek–sobotę, z przejściem sobota ↔ poniedziałek.
- Nagłówek, licznik i 16 slotów wskazują tę samą datę; kliknięcie daty
  odległego dnia wraca do dzisiaj. Bieżący dzień otwiera wybór tygodnia.
- Wejście w dzień ustawia dzisiaj (w niedzielę sobotę); powrót do tygodnia
  zachowuje przeglądany tydzień. Poprawiono reset poziomego scrolla.
- Przyciski mają dostępne nazwy; nagłówek mieści się na 320 px.
- Backend zmieniony tylko w numerze wersji. Brak migracji SQL i zmian danych.

## Odbiór

- Procedura i granice: docs/deployment/RELEASE_2.1.27.md.
- Raport: docs/audits/DEPLOY_2.1.27_2026-10-17.json.
- Izolowana regresja PASS: 153 Python/API (152 PASS, 1 SKIP lokalnego XLSX),
  51 JS, parser 50 modułów i 92 SQL/PGlite. Syntetyczne dane, bez Supabase.
- 16 wariantów Chrome na archiwum Git PASS; te same 16 na produkcyjnych
  zasobach PASS. Oba motywy, 320–1440 px, poziom, reflow200, tekst200,
  reduced motion, klawiatura, axe top bara, fonty loaded i przegląd zrzutów.
- PASS: weekend, miesiąc/rok, 29 lutego, DST, zgodność slotów/liczników,
  powrót do dziś, dzień/tydzień, dialog 503 i dalsza nawigacja.
- API podczas testów live w całości przechwycone syntetycznie; z produkcji
  pobrano tylko publiczne pliki. Nie wykonywano zapisów danych trenerów.
- Pierwszy odbiór live wykazał wyścig w asercji testowej. Dodano lokalnie
  oczekiwanie na licznik; ponowiony test PASS, kod aplikacji bez zmian.
- Niezależny przegląd nie znalazł blokera. Manifest Git, finalne archiwum
  i preflight 44 zasobów PASS; test brakującego fontu blokuje publikację.
- Panel Railway wymaga logowania w dostępnej sesji, więc surowego logu
  predeploy nie odczytano. Railway/GitHub success i odbiór HTTP potwierdzone.
- NOT_TESTED: fizyczny telefon, native, VoiceOver/TalkBack, rzeczywiste zapisy.

## Paczka, izolacja i odzyskanie

- Izolowany Git: .tmp/day-release-20261017/release, HEAD d269761.
- Odtworzony finalny commit: .tmp/day-release-20261017/final.
  Build z produkcyjnym API: .tmp/day-release-20261017/production-build.
- JS index-7b42154aec77898a54ac5def7d6086e1.js.
  SHA256 d8046e6db2fbc3e9ab72155ac866d5564f49ab97d3cb2a93e602428e911614a2.
- Dowody: .tmp/day-release-20261017: final-git-assets.json, status.json,
  live-assets.json, browser-git/report.json, browser-live-final/report.json.
- Rollback: kompletny commit f18309b (2.1.26), bez zmian schematu/danych.
  ZIP/CRC/SHA256, odtworzenie 44 zasobów i preflight PASS.
  Checkpoint: C:/Projects/Backups/atylla-pro/day-navigation-2.1.27-20261017.
- Nie cofać do niepełnej statyki 2.1.25. Aktualny checkpoint nie zawiera bazy;
  pełna starsza zaszyfrowana kopia: Backups/atylla-pro/release-2.1.25-20261011.
- Kanoniczny checkout i stash zawierają wcześniejsze zmiany; zachowano je.
  backend/static w kanonicznym drzewie nie jest paczką produkcyjną.
- Niewydane opisy planowania i import ciekawostek pozostają osobnym zakresem.
  Brak synchronizacji LLM-WIKI. Absencje/migracja 015 bez zmian.

## Ciekawostki — zachowana różnica

- Lokalny Excel zmieniony 11.10 (253/313 tekstów), frontend JSON nadal stary.
  Import wymaga odrębnego zlecenia. Kanoniczny test Excel/JSON nadal FAIL;
  w izolowanym wydaniu XLSX nie występuje, więc ten test ma jawny SKIP.
- Dowody: .tmp/humor-20261011/verification.json i changes.json;
  kopia: C:/Projects/Backups/atylla-pro/humor-20261011.

## Jeden następny krok

Odebrać zmianę widoku dnia na fizycznym telefonie po odświeżeniu aplikacji.
