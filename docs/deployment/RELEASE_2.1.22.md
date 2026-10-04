# Atylla Pro 2.1.22 — zgodność Strefy Trenera z mockupem

Wydanie 2.1.21 wdrożyło funkcje, lecz zachowało stary początek Podsumowania
i część starych kart. Użytkownik odrzucił ten rezultat jako niezgodny z
zaakceptowanym podglądem. 2.1.22 przenosi jego układ do rzeczywistej aplikacji.

- Segmentowane zakładki, jeden rząd wyboru miesiąca i roku ze strzałkami.
- Trzy zwarte, neutralne statystyki w jednym rzędzie również na 320 px.
- Krótki wniosek z pionowym akcentem zamiast nagłówka i karty „Rytm miesiąca”.
- Wykres z zachowanymi obliczeniami; pod nim tabelka wybranego miesiąca.
  Rozwijane liczby roku są tabelą z tygodniową średnią, a brak danych to „—”.
- Płaskie rozwijane tygodnie i lista treningów zamiast kolejnych dużych kart.
- Nagłówki, kolory, odstępy, wybór okresu i karty wzorców Grafiku oraz
  hierarchia Sezonowości pochodzą z referencji. Historia: miesiąc, potem rok.
- Pytania, zapis ustawień i rzeczywiste propozycje z 2.1.21 pozostają zgodne
  z późniejszymi ustaleniami. Dane i fikcyjne czasy z mockupu nie są kopiowane.

Referencja: `atylla-strefa-trenera.html`, oryginalny plik zaakceptowanego
podglądu w lokalnym katalogu wizualizacji. Kontrakt i porównanie:
`docs/audits/MOCKUP_PARITY_2.1.22_2026-10-04.md`.

## Weryfikacja

128 testów Python/API, 44 JS i parser 46 modułów: PASS. Testy renderowanego
interfejsu korzystają z syntetycznego API, obu motywów i 7 szerokości/reflow.
Zrzuty porównane bezpośrednio z wyrenderowaną referencją, dodatkowo niezależna
recenzja. Końcowe zakresy i wyniki zapisane w audycie UI_2.1.22_2026-10-04.json.
Zalogowana sesja produkcyjna i fizyczny telefon nie były testowane.

## Publikacja i rollback

Izolowany klon bazuje na `a6583b7bab1825259679c9647cab36a52f799615` (2.1.21).
Brak migracji, zmian backendu poza numerem wersji oraz zapisów realnych profili.
Rozliczenia, Klienci i silnik planowania identyczne z 2.1.21.
API: https://atylla-pro-production.up.railway.app.
Bundle: `index-a83e0f7171d26977d4731cf5cc4b8625.js`.
Po publikacji wymagane porównanie z dokładnie przetestowanym pakietem.
Rollback kodu do 2.1.21 bez cofania bazy.
Kopia: `C:/Projects/Backups/atylla-pro/release-2.1.22-20261004/production-2.1.21.bundle`.
SHA256: `9d0d473dc35cc829541840ba2ba15ec26585da8b8b94d63d40e55db5bba2569b`.
