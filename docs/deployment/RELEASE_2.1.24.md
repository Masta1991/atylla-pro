# Atylla Pro 2.1.24 — szuflada: sam panel startu pakietu

Po kliknięciu **Rozpocznij pakiet** w dolnej szufladzie slotu widać było
jednocześnie przyciski Trening / Przenieś / Rozpocznij pakiet na górze oraz
Odwołaj trening / Historia / Usuń na dole — razem z otwartym panelem pakietu.
Od 2.1.24 otwarty panel (`startPanel`) ukrywa wszystkie przyciski akcji
szuflady; widoczne są tylko tytuł slotu oraz panel Pakiet / Miesięczny
(rozmiar, Pakiet łączony, Rozpocznij / Anuluj). Zamknięcie szuflady (X) czyści
też `startPanel`. Logika startu pakietu i rozliczeń bez zmian.

Zakres celowo minimalny (decyzja użytkownika 5.10.2026): baza 2.1.23 plus
12 linii w `frontend/src/screens/CalendarScreen.js` i podbicie wersji.
Przygotowane lokalnie brzmienie Strefy Trenera (planning copy) NIE wchodzi
do tego wydania; jego kolej przyjdzie w 2.1.25.

## Weryfikacja przed publikacją

Harness w izolowanym klonie: overall PASS — 131 Python/API (0 błędów),
suity JS exit 0, parser 50 modułów PASS. Dane syntetyczne, bez zapisów.
Asercje produkcyjnego pakietu: adres prod obecny, brak `127.0.0.1`/`localhost`,
wersja 2.1.24 i napisy szuflady w pakiecie: PASS.
Fizyczny telefon i zalogowana sesja produkcyjna: NOT_TESTED.

## Publikacja i rollback

Użytkownik jawnie zatwierdził produkcję. Izolowany worktree bazuje na
c4e7a11de453d76bf694b6f78bbdcb42f6aa7d81 (2.1.23). Niezwiązane lokalne
zmiany i stash pozostają nietknięte. Brak migracji; jedyna zmiana backendu
to wersja w `backend/main.py`. API: https://atylla-pro-production.up.railway.app.
Bundle: index-cb1304ef6f8ae301a50843f9bf27ea96.js.
SHA256: ab9a9abb3dcda9023a27aca96fe133a0140717c87353049c3458d80616bc81f7.
Po publikacji wymagane /version 2.1.24, /health healthy i zgodność bajtów
serwowanego pakietu z powyższym SHA.
Rollback: odwrócenie commitu wydania na master, bez cofania bazy.
Kopia bezpieczeństwa bazy produkcji: C:/Projects/Backups/atylla-pro/release-2.1.24-20261005/repo-base (klon, checkout c4e7a11 PASS, wersja 2.1.23).
Ostateczny wynik wdrożenia zapisuje docs/audits/DEPLOY_2.1.24_2026-10-05.json.
