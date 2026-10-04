# Ciekawostka dnia — lokalny odbiór 2.1.23

## Zachowanie

Zaakceptowany mockup: tekst tylko w lewym czarnym pasku menu, obrót -90°
(od dołu ku górze), pełna treść bez skrótów. Domyślnie 15/20 px.
Komponent mierzy tekst przed obrotem. Gdy potrzeba, poszerza pasek kosztem menu;
na wąskim ekranie limit wynosi 40%. Przy braku miejsca pełna treść jest
przewijana w obróconym polu, również klawiaturą. Dotknięcie tekstu nie zamyka
menu. Wolne tło oraz Escape zamykają je; focus wraca na przycisk otwarcia.

Źródło: `smieszne_ciekawostki_na_rok_bez_niedziel.xlsx`, arkusz Ciekawostki,
A2:A314 i D2:D314. 313 wpisów, 2026-10-05–2027-10-04, 95–298 znaków.
Źródłowy Excel pozostaje bez zmian. Dane są w `frontend/src/data/dailyFacts.json`.
Importer `scripts/import-daily-facts.py` korzysta wyłącznie z biblioteki standardowej;
odrzuca braki, duplikaty, niedziele, niepoprawną kolejność i formuły w A/D.
`--check` porównuje plik wynikowy ze źródłem bez zapisu.

Wybór: data Europe/Warsaw, w zakresie źródła dokładne przypisanie. Przed początkiem
i w niedzielę brak tekstu. 2027-10-05 zaczyna się kolejny cykl; niedziele nie
przesuwają kolejki. Cykl liczy dni kalendarzowe, bez zależności od logowań.
Timer wskazuje następną północ w Warszawie (dni 23/25 h uwzględnione), a powrót
do aplikacji lub otwarcie menu ponownie oblicza tekst. Brak API dla ciekawostek.

## Dowody

- PASS: niezależne porównanie wszystkich 313 par z Excelem przez openpyxl.
- PASS: 131 testów Python/API, 50 testów/kontroli JS, parser 50 modułów.
  Bieżący runner: `skills/atylla_test_harness/latest_test_report.json`.
- PASS: 6 testów selektora, w tym niezależne przejście po ośmiu latach kalendarza,
  rok przestępny, pomijanie niedziel, kolejne cykle oraz polska północ i DST.
- PASS: 18 wariantów przeglądarki (oba motywy × 320×568, 375×667, 390×844,
  667×375, 768×1024, 1024×768, 1366×768, 1440×900, 320×400).
- PASS: 5634 pomiary treści (313 × 18), wszystkie 313 dat przełączone i sprawdzone
  w rzeczywistym komponencie na 320×568; brak pozostawionych elementów pomiarowych.
- PASS: najdłuższe teksty, zmiana wymiarów otwartego menu, dwa dodatkowe widoki
  z powiększeniem tekstu 200% oraz przewinięcie ciekawostki klawiszem End.
- PASS: pusta niedziela → poniedziałek, sobota → niedziela, ostatni dzień zestawu
  → pierwszy powtórzony tekst o północy, odświeżenie po powrocie na pierwszy plan.
- PASS: dotknięcie tekstu bez zamykania, tło/Escape, Enter/Tab, powrót focusu,
  przejście do Ustawień i powrót, dotarcie przewijaniem do Wyloguj.
- PASS: brak overflow dokumentu, błędów JS/console i dodatkowych odczytów API
  dla tekstów. Zwykłe /auth/activity pozostaje zachowaniem istniejącej aplikacji.
- PASS: oględziny 20 zrzutów (18 wariantów i 2 powiększenia) oraz porównanie
  z zaakceptowanym mockupem. Na 320×568 pasek ma 104 px, na 390×844 — 110 px.

Przeglądarka: lokalny Chrome/Playwright; wszystkie odpowiedzi API syntetyczne,
rzeczywiste połączenia z API przechwycone, pozostałe zewnętrzne adresy blokowane.
Test: `backend/tests/offline/browser_daily_facts.test.cjs`.
Dowody: `.tmp/daily-facts-2.1.23/baseline/` i `browser/report.json`, zrzuty i
cztery zestawienia `browser/review-*.jpg`.

## Znane granice

Brak nowych serious/critical axe względem bazowego 2.1.22. Zachowane wcześniejsze
uwagi kontrastu dotyczą stopki e-mail oraz miedzianego logo/Wyloguj w jasnym motywie;
nie dotyczą nowego tekstu. Porównanie odwołuje się do konkretnych elementów bazowych,
nie wyłącza globalnie reguły kontrastu.

NOT_TESTED: fizyczny telefon, natywne iOS/Android i VoiceOver/TalkBack.
Powiększenie 200% to jawne podwojenie rozmiaru tekstu i interlinii w przeglądarce,
nie systemowe ustawienie telefonu. Natywna obsługa dotyku wymaga odbioru urządzenia.
Nie ponawiano PostgreSQL/Supabase — zmiana nie obejmuje bazy ani logiki backendu.
Nie opublikowano zmiany i nie wykonano testów na rzeczywistych kontach.

## Pakiet lokalny i wersja

W trakcie planowania produkcja przeszła na 2.1.22; następny patch to 2.1.23.
Metadane frontend/Expo/lock/backend są zgodne. Numery natywnych buildów nie były
podnoszone: nie wykonywano archiwizacji ani wydania do sklepu.

Build: `.tmp/daily-facts-2.1.23/build`, API `http://127.0.0.1:8000`.
JS: `index-a16c4943ddc18d1e93ece169582ff73f.js`.
SHA256: `f69edcaac0409c8a82ef2798e9003d36d50dfecd3325da64e4be2c304b9d1238`.
Excel SHA256: `2ef8c64f6d4be3a07ab9ab92f943e03c72cb2b7406069fc49c491e8bb7dff887`.
Pakiet testowy nie jest pakietem produkcyjnym: publikacja wymaga osobnego odbioru
i przygotowania z zatwierdzonym adresem API. Bez migracji danych.

## Uzupełnienie wydania — 2026-10-04

Użytkownik zatwierdził publikację i jednorazowy tekst o wydrach na dziś.
Wyjątek obowiązuje wyłącznie 2026-10-04 w Europe/Warsaw; test granic daty
i przejścia w otwartym menu potwierdza powrót do harmonogramu o północy.
Po tej zmianie: 131 Python/API, 51 JS (7 grup selektora), parser 50: PASS.
Ponowiono pełną macierz UI na pakiecie z produkcyjnym adresem API.
Oględziny release-day-preview.png potwierdzają pełny tekst w lewym pasku.
Wyniki: .tmp/release-2.1.23/browser/report.json. Szczegóły pakietu i rollbacku:
docs/deployment/RELEASE_2.1.23.md. Ostateczny wynik publikacji w raporcie DEPLOY.
