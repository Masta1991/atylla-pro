# Plan Wdrożeń i Rozwoju Atylla Pro

## Backlog Zadań

### TASK-ATYLLA-01: Wdrożenie Dedykowanego Skilla Automatycznych Testów (QA Harness)
- **Cel**: Automatyzacja testów regresyjnych API i przepływów biznesowych (Auth -> Klient -> Pakiet -> Kalendarz -> Dziennik -> Rozliczenie) bez konieczności manualnego klikania.
- **Kryteria odbioru**:
  - Dedykowany skill w `skills/atylla_test_harness/` potrafi uruchomić pełny pipeline testów.
  - Wykrywa niespójności w rozliczeniach pakietów i konfliktach godzinowych w kalendarzu.
  - Generuje raport wykonania z podsumowaniem stanu aplikacji.
- **Status**: Gotowy do wdrożenia.

### TASK-ATYLLA-02: Stabilizacja Modułu Rozliczeń i Pakietów
- **Cel**: Eliminacja problemów z podwójnym naliczaniem wykorzystanych sesji przy dynamicznej edycji terminów w kalendarzu.
- **Status**: W trakcie weryfikacji.

### TASK-ATYLLA-03: Optymalizacja Raportów i Notyfikacji E-mail
- **Cel**: Wzbogacenie raportów wysyłanych do podopiecznych o wektorowe wykresy siły i spadku tkanki tłuszczowej.
- **Status**: Zaplanowany.
