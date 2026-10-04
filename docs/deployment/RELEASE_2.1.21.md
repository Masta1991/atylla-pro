# Atylla Pro 2.1.21 — Strefa Trenera i planowanie pracy

Strefa Trenera rozdziela Podsumowanie, Grafik i Sezonowość. Zachowuje wykres
roczny oraz szczegóły odbytych treningów i opłaconych odwołań. Liczby całego
roku zawierają średnią odbytych na tydzień ważoną dniami kalendarzowymi pełnych
miesięcy z danymi. Tygodnie i lista sesji są rozwijane; usunięto panel
„Do sprawdzenia teraz”. Sezonowość zaczyna się od wniosków; edytor historii
pozwala wybrać rok i miesiąc. Rozliczenia i Klienci pozostają bez zmian.

## Silnik planowania

- Domyślnie każdy profil: od 06:00, sesje 60 minut o pełnych godzinach,
  bez narzuconego końca dnia i stałych dni pracy. Ustawienia są per profil.
- Historia 3/6 zakończonych miesięcy; pytania o powtarzalne okna i skąpe
  miesiące, poprzednie odpowiedzi do zmiany przed kolejną analizą.
- Ochrona przerw, limitu kolejnych sesji, granic dnia i klientów ze stałą
  godziną. Nieznane powtarzalne przerwy pozostają chronione. Urlop lub
  niepełny miesiąc wyłącza miesiąc z typowych wzorców.
- Propozycje na następne 28 dni wskazują klientów, stare i nowe terminy,
  zmianę końca dnia oraz opcjonalny przychód z dodatkowej sesji. Przesunięcie
  jednej lub dwóch sesji oceniane dla całego dnia. Wspólny trening liczony raz.
- Wszystko jest „do uzgodnienia”. Bez automatycznego przesuwania kalendarza,
  kontaktowania klientów lub zewnętrznego AI. Historia nie potwierdza dostępności.
- Preferencje tylko dla analizy albo zapisane w profilu; niezmienne raporty
  z pytaniami i odpowiedziami. CAS chroni ustawienia, idempotencja zapis raportu.
- Obecny kalendarz obsługuje poniedziałek–sobotę; brak propozycji niedzielnych.

## Walidacja

- PASS: 128 Python/API, 44 JS, 72 PGlite; parser 46 modułów frontendu.
- PASS: dodatkowe 16 testów migracji 014 po uszczelnieniu domyślnych grantów
  Supabase. Zapis wyniku tylko przez backend z potwierdzonym właścicielem.
- PASS: 196 stanów przeglądarki / 14 wariantów (oba motywy,
  320/390/768/1024/1366/1440 oraz reflow 200%). Klawiatura, focus,
  pytania, ustawienia, zapis historii miesiąca, błąd odczytu, konflikt ustawień,
  niepewny zapis i ponowienie bez duplikatu. API całkowicie syntetyczne.
- PASS: przegląd 14 zestawień zrzutów i pełnowymiarowych kluczowych widoków;
  brak nowych serious/critical axe, overflow i błędów JS względem 2.1.20.
- PASS: odczytowa kontrola użyteczności propozycji na wskazanym kalendarzu.
  Brak zapisów testowych na rzeczywistych profilach.
- NOT_TESTED: fizyczny telefon, zalogowany przepływ produkcyjny, równoległe
  połączenia PostgreSQL. PGlite testuje sekwencyjny konflikt revision i rollback.

Dowody: `.tmp/release-2.1.21/`, `docs/audits/UI_2.1.21_2026-10-04.json`.
Raport produkcji zostanie zapisany po potwierdzeniu aktywnego wydania jako
`docs/audits/DEPLOY_2.1.21_2026-10-04.json`.

## Migracja i publikacja

Migracja 014 wdrożona addytywnie: trainer_planning_preferences i
trainer_planning_analyses, RLS właściciela, brak bezpośrednich zapisów użytkownika.
Zapis preferencji wymaga authenticated, zapis analizy wyłącznie service_role
przez API z potwierdzonym aktorem. Prywatne helpery bez EXECUTE dla ról API.
Zweryfikowano źródła funkcji, granty, RLS i dostęp PostgREST; liczby istniejących
rekordów bez zmian. Brak danych testowych w produkcji.

Izolowany klon `.tmp/release-2.1.21/repo` bazuje na produkcyjnym
`df8fe8d37ef6de37b1f73eed5732b7bbbc01d434` (2.1.20). Zachowano niezwiązane
zmiany kanonicznego repozytorium i stash. API buildu:
https://atylla-pro-production.up.railway.app.
Bundle: `index-483844f187440b1c8c88f52152fca4ca.js`.

## Rollback

Cofnąć kod do 2.1.20, pozostawiając addytywne tabele oraz zapisane preferencje
i analizy. Nie usuwać nowych danych użytkowników. Zweryfikowany git bundle:
`C:/Projects/Backups/atylla-pro/release-2.1.21-20261004/production-2.1.20.bundle`,
SHA256 `6b1e8923212ec0cef524095496cc05c54d9dc504ac9651d618dce1f1d7e21c74`.
Nie jest to aktualna kopia całej bazy; pełny backup pozostaje z 15.09.
