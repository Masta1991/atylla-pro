# Plan Wdrożeń i Rozwoju Atylla Pro

## Backlog Zadań

### TASK-ATYLLA-01: Wdrożenie Dedykowanego Skilla Automatycznych Testów (QA Harness)
- **Cel**: Automatyzacja testów regresyjnych API i przepływów biznesowych (Auth -> Klient -> Pakiet -> Kalendarz -> Dziennik -> Rozliczenie) bez konieczności manualnego klikania.
- **Kryteria odbioru**:
  - Dedykowany skill w `skills/atylla_test_harness/` potrafi uruchomić pełny pipeline testów.
  - Wykrywa niespójności w rozliczeniach pakietów i konfliktach godzinowych w kalendarzu.
  - Generuje raport wykonania z podsumowaniem stanu aplikacji.
- **Status**: Harness istnieje w skills/atylla_test_harness; historyczne wyniki testów w bieżącym handoffie. Odbiór stagingu pozostaje otwarty.

### TASK-ATYLLA-02: Stabilizacja Modułu Rozliczeń i Pakietów
- **Cel**: Eliminacja problemów z podwójnym naliczaniem wykorzystanych sesji przy dynamicznej edycji terminów w kalendarzu.
- **Status**: W trakcie weryfikacji.

### TASK-ATYLLA-03: Optymalizacja Raportów i Notyfikacji E-mail
- **Cel**: Wzbogacenie raportów wysyłanych do podopiecznych o wektorowe wykresy siły i spadku tkanki tłuszczowej.
- **Status**: Zaplanowany.

### TASK-ATYLLA-04: Strefa Trenera i silnik planowania
- **Status**: silnik wdrożony w 2.1.21, zgodność UI z mockupem poprawiona w 2.1.22; testy i weryfikacja
  produkcyjnego artefaktu PASS. Odbiór na fizycznym telefonie pozostaje otwarty.
- **Kontrakt**: DEC-ATYLLA-004 w DECISIONS.md; produkcja 2.1.22, migracja 014 bez zmian.
- **Zakres UI**: Podsumowanie/Grafik/Sezonowość; zachowany wykres roczny,
  średnia odbytych na tydzień z jawnym mianownikiem, rozwijane tygodnie i lista,
  usunięcie „Do sprawdzenia teraz”, wnioski sezonowe i wybór miesiąca historii.
- **Zakres grafiku**: reguły pracy w Ustawieniach, pytania przy każdej analizie,
  trwałe preferencje i historia analiz, warianty szanujące pożądane przerwy.
- **Odbiór**: izolacja profili i RLS, konflikt dwóch zapisów, idempotencja analizy,
  braki historii, pary i odwołania, chronione okna, brak zgody klienta,
  weryfikacja korzyści z całego dnia, oba motywy i mobilny układ.
- **Poza obecną realizacją**: zewnętrzne AI oraz automatyczne przesuwanie treningów.
