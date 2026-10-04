# Atylla Pro 2.1.20 — korekta rozliczeń

Na polecenie użytkownika usunięto rozwijane „Więcej”. „Twardy reset” jest
bezpośrednio dostępny w rozwiniętej karcie rozliczenia, z dotychczasowym
potwierdzeniem i niezmienioną operacją resetu.

Lista rozliczeń ma wyszukiwarkę imienia/nazwiska, działającą tak jak w Klientach:
wiele słów w dowolnej kolejności, dodatkowe spacje oraz wpisy bez polskich znaków.
Brak dopasowań daje czytelny komunikat. Rozliczenia pojedynczego klienta
zachowują ograniczenie do wskazanej osoby. Pozostałe widoki bez zmian.

## Weryfikacja

- Lokalna regresja Python/API i JS oraz parser frontendu: PASS.
- Przeglądarka: oba motywy, 320/390/768/1024/1366/1440 i reflow 200%;
  wyszukiwanie, puste wyniki, wyczyszczenie filtra, bezpośredni reset,
  potwierdzenie/anulowanie, historia i dotychczasowe akcje pakietów.
- Porównanie axe z 2.1.19; zastane uwagi kontrastu Klientów pozostają poza zakresem.
- Kod wszystkich handlerów rozliczeń identyczny przed/po.
- API w testach przeglądarkowych całkowicie syntetyczne; brak rzeczywistych zapisów.
- Brak migracji SQL; backend zmieniony wyłącznie w numerze wersji.
- Fizyczny telefon i zalogowana sesja produkcyjna: NOT_TESTED.

Raporty: `.tmp/release-2.1.20/regression-report.json` i `browser/report.json`
w tym samym katalogu; raport produkcji zapisywany po potwierdzeniu wdrożenia
w `docs/audits/DEPLOY_2.1.20_2026-10-04.json`.

## Publikacja i rollback

Izolowany klon `.tmp/release-2.1.20/repo` bazuje na produkcyjnym commicie
`4a85111fc1e993a93574e727f2b31d0cd1bbf354`. Niezwiązane lokalne zmiany pominięte.
Build używa API https://atylla-pro-production.up.railway.app.
Bundle: `index-e1d8b237b60d2cc4f8ccf7728d32620c.js`.
Rollback do wskazanego commita 2.1.19 bez cofania danych bazy.
Zweryfikowany git bundle:
`C:/Projects/Backups/atylla-pro/release-2.1.20-20261004/production-2.1.19.bundle`.
