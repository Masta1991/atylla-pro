# Atylla Pro 2.1.19 — rozliczenia i wyszukiwarka klientów

Zakres zatwierdzony przez użytkownika 2026-10-04: wyłącznie dwa widoki.

- Rozliczenia: kompaktowe karty z licznikiem; rozwinięcie pokazuje istniejące
  dane i operacje rozliczeniowe. Historia, edycja licznika, zwiększenie i obsługa
  pakietów zachowują dotychczasowe działanie. Hard reset znajduje się pod „Więcej”.
  Wejście w rozliczenia pojedynczego klienta otwiera jego kartę.
- Klienci: dodana wyłącznie wyszukiwarka imienia/nazwiska, tolerująca polskie
  znaki i dodatkowe spacje. Istniejące karty i przyciski pozostają bez zmian.
- Strefa Trenera, sezonowość i wszystkie pozostałe widoki bez zmian.
- Backend: wyłącznie numer wersji. Brak migracji i zmian logiki rozliczeń.

## Weryfikacja przed publikacją

- PASS: 200 kontroli lokalnych (100 Python/API, 44 JS, 56 PGlite), parser 43 modułów.
- PASS: 112 stanów przeglądarkowych, jasny/ciemny motyw, szerokości
  320/390/768/1024/1366/1440 oraz układ odpowiadający powiększeniu 200%.
- Sprawdzone: rozwijanie kart i „Więcej”, klawiatura, ARIA, ukrywanie akcji,
  wyszukiwanie, brak wyników, długie nazwiska, modale oraz istniejące operacje.
- Brak nowych usterek axe serious/critical względem 42 stanów wersji 2.1.18;
  istniejące uwagi kontrastu kart klientów w jasnym motywie pozostawiono zgodnie
  z zakresem. Brak przepełnienia poziomego i błędów JS w sprawdzonych stanach.
- PASS: dodatkowe scenariusze istniejących pakietów, historii, błędów zapisu,
  powrotu do klienta i wykresu. Wszystkie zapisy wyłącznie na syntetycznym API.
- Obejrzano zrzuty wszystkich 14 wariantów szerokości/motywu.
- Fizyczny telefon i zalogowana produkcyjna sesja trenera: NOT_TESTED.

## Artefakt i odtworzenie

Build ma jawny adres API https://atylla-pro-production.up.railway.app.
Sprawdzony bundle: `index-1b3eb08f8e9beb40fc0dd835492b769a.js`.
Wydanie powstaje z izolowanego klonu 2.1.18; niezwiązane lokalne zmiany i stash
nie są częścią publikacji. Poprzednie bundle pozostają dostępne.

Punkt odtworzenia kodu: commit `9d719040b3868b96267ffe2189630c2cbc8a34a4`.
Zweryfikowany git bundle: `C:/Projects/Backups/atylla-pro/release-2.1.19-20261004/production-2.1.18.bundle`.
SHA256: `68bc51c0a13f57b2369829d2a8ebc10fbe150e606dfd6491dfa30cfaa2ec6a61`.
Rollback przywraca kod 2.1.18 bez cofania danych ani schematu bazy.

Raporty lokalne: `.tmp/release-2.1.19/{regression-report.json,browser/report.json,
baseline/report.json,existing-flows-light/report.json}`. Oddzielny raport
`docs/audits/DEPLOY_2.1.19_2026-10-04.json` powstaje dopiero po potwierdzeniu
wdrożenia i zgodności opublikowanego bundle ze sprawdzonym artefaktem.
