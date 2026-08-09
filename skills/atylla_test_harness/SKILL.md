---
name: atylla_test_harness
description: Autonomiczny skill testowania i ciągłej weryfikacji aplikacji Atylla Pro (FastAPI + Supabase + Logika Rozliczeń). Uruchamia pełny zestaw testów E2E / API bez udziału człowieka, wykrywa anomalie w kalendarzu, pakietach i autoryzacji oraz generuje raporty jakości.
version: 1.0.0
author: AI Agentic QA Engine
---

# Atylla Pro Automated Test Harness Skill

## Przeznaczenie
Skill służy do bezobsługowego testowania wszystkich kluczowych przepływów biznesowych w aplikacji **Atylla Pro**. Eliminuje konieczność manualnego klikania przez użytkownika po wdrożeniu nowych zmian.

## Główne Obszary Testowe
1. **Autoryzacja i Sesje**: Poprawność generowania i odświeżania tokenów JWT, blokada nieautoryzowanych zapytań.
2. **Klienci i Pakiety**: Tworzenie klienta, przypisanie pakietu (np. 10 sesji), spójność liczników jednostek.
3. **Kalendarz i Harmonogram**: Rezerwacja slotu, sprawdzanie konfliktów nakładających się godzin, przesuwanie treningów (drag & drop simulation).
4. **Pobieranie Jednostek z Pakietów**:
   - Status `completed` -> odjęcie 1 jednostki z pakietu.
   - Status `cancelled_keep` -> odjęcie 1 jednostki (późne odwołanie).
   - Status `cancelled_free` -> jednostka NIE jest pobierana.
5. **Dziennik Treningowy i Pomiary**: Zapis serii/powtórzeń, historia pomiarów sylwetki, generowanie wykresów matplotlib.

## Instrukcja Uruchomienia

### Uruchomienie pojedynczego przebiegu:
```bash
python skills/atylla_test_harness/harness.py
```

### Uruchomienie w trybie ciągłym (aż do 100% pewności / N iteracji):
```bash
python skills/atylla_test_harness/harness.py --iterations 5 --verbose
```

### Wyniki:
Raport z testów zapisywany jest w formacie JSON oraz podsumowania tekstowego w `skills/atylla_test_harness/latest_test_report.json`.
