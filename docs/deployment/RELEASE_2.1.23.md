# Atylla Pro 2.1.23 — ciekawostka dnia w menu

Pełny tekst z lokalnego zestawu 313 ciekawostek w czarnym lewym pasku,
czytany od dołu ku górze. Pomiar, zawijanie i przewijanie chronią dostępność
całej treści; menu zachowuje nawigację, zamykanie i obsługę klawiatury.

Na jawne życzenie użytkownika 4.10.2026 pokazujemy testowo tekst o wydrach.
Wyjątek wygasa automatycznie o północy Europe/Warsaw. Od 5.10 obowiązuje
harmonogram z arkusza; pozostałe niedziele są puste. Po końcu zestawu
cykl powtarza się deterministycznie w dni od poniedziałku do soboty.
Źródłowy XLSX pozostaje lokalny i nie jest częścią wydania.

## Weryfikacja przed publikacją

131 Python/API, 51 JS, parser 50 modułów i produkcyjny build: PASS.
Test przeglądarkowy gotowego pakietu: 18 wariantów, oba motywy, 5634 pomiary,
313 dat w komponencie, tekst 200%, obrót, klawiatura, nawigacja i daty.
API w testach syntetyczne; bez zapisów rzeczywistych danych.
Dowody: .tmp/release-2.1.23/browser/report.json i lokalny raport audytu.
Fizyczny telefon i natywne czytniki ekranu wymagają odbioru urządzenia.

## Publikacja i rollback

Użytkownik jawnie zatwierdził produkcję. Izolowany klon bazuje na
c33eac31610f76189ec7393efd60fc4e5608dfa6 (2.1.22). Niezwiązane lokalne
zmiany i stash pozostają zachowane. Brak migracji i zmian backendu poza wersją.
API: https://atylla-pro-production.up.railway.app.
Bundle: index-4b03a5428e7670a768b4fdd6730856b6.js.
SHA256: 323fa57ae3a7ea9cca75788f19e6b64e7aa1654aa9fce4878844a1e32735bd5e.
Po publikacji wymagane /version, /health i zgodność bajtów z tym pakietem.
Rollback: odwrócenie commitu wydania na master, bez cofania bazy.
Kopia: C:/Projects/Backups/atylla-pro/release-2.1.23-20261004/production-2.1.22.bundle.
SHA256 kopii: ac8a385844662a9eb9fa4ec7d8c3bf288fc55d6720d82766b85c04a6c610e130.
Kopia zweryfikowana przez git bundle verify oraz próbny klon i zgodność HEAD.
Ostateczny wynik wdrożenia zapisuje docs/audits/DEPLOY_2.1.23_2026-10-04.json.
