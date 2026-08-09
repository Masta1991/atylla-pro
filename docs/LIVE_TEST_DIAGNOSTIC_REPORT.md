# Raport Diagnostyczny i Plan Naprawczy po Symulacji 2-Miesięcznej — Atylla Pro

## 1. Zakres i Przebieg Testu Na Żywo (Sandbox: `staws22-1@gmail.com`)

Przeprowadzono pełną, 9-tygodniową symulację pracy trenera personalnego za okres **1 czerwca 2026 – 31 lipca 2026** na koncie testowym `staws22-1@gmail.com` (UUID: `520504a4-1a24-4534-aac6-56237ff84f15`):
- **4 Nowych Klientów QA**:
  1. *Michał Wiśniewski (QA)* — pakiet 10 treningów, grafik: Pon/Śr/Pt 09:00.
  2. *Karolina Mazur (QA)* — pakiet 20 treningów, grafik: Wt/Czw 17:00.
  3. *Tomasz Adamski (QA)* — pakiet 10 treningów, grafik: Pon/Śr/Pt 18:00.
  4. *Ewa Dąbrowska (QA)* — rozliczenie pojedyncze (bez pakietu), grafik: Sob 10:00.
- **79 Sesji Treningowych w Kalendarzu** (łącznie 300 zdarzeń w bazie dla tego trenera).
- **85 Zapisanych Dzienników Treningowych** z tygodniową progresją obciążenia (Wyciskanie leżąc, Przysiad, Martwy ciąg, OHP).
- **13 Punktów Pomiarowych Sylwetki** (waga, % tkanki tłuszczowej, % masy mięśniowej w 3 punktach: 1 czerwca, 1 lipca, 31 lipca).
- **Symulacja Odwołań Treningów**:
  - Płatne odwołanie (`cancelled` + `is_settled=True`) $\rightarrow$ jednostka pobrana z pakietu.
  - Bezpłatne odwołanie (`cancelled` + `is_settled=False`) $\rightarrow$ jednostka zachowana w puli.

---

## 2. Wyniki Testu: Co Działa Perfekcyjnie?

1. **Izolacja Danych Trenera (Multi-tenant):**  
   Wszystkie rekordy klientów, kalendarza, pomiarów i ćwiczeń są w 100% odizolowane przez `trainer_id`. Brak wycieków do innych profili.
2. **Rejestrowanie Ćwiczeń i Progresja Ciężaru:**  
   Moduł `workout_logs` prawidłowo powiązuje serie, powtórzenia i obciążenia z relacją `exercises`.
3. **Logika Rozliczania Odwołań:**  
   Płatne i bezpłatne odwołania działają zgodnie z założeniami biznesowymi.
4. **Pomiary Sylwetki i Wskaźniki:**  
   Historia pomiarów zapisuje się chronologicznie i zachowuje spójność danych.

---

## 3. Wykryte Błędy i Anomalie (Defekty Logiki)

### Defekt 1 (KRYTYCZNY): Twardy limit numeracji w `calendar.py:142` (Overflow Cap Bug)
* **Objaw:** Gdy podopieczny (np. Michał Wiśniewski) przekroczy 10 treningów w ramach 10-paku (np. 11. i 12. trening w czerwcu przed zamknięciem pakietu przez trenera), na kafelkach kalendarza pojawia się etykieta `[0/10]` zamiast `[11/10]`.
* **Przyczyna w kodzie:**  
  W pliku `backend/routers/calendar.py` w funkcji `assign_chronological_numbers` (linie 142–146):
  ```python
  pkg_size = pkg.get("size", 10)
  if current_count <= pkg_size:
      event_counts[e_id] = current_count
      event_counts[f"{e_id}_size"] = pkg_size
  else:
      pass # <-- BŁĄD: porzuca numerację powyżej limitu!
  ```
* **Naruszenie reguły biznesowej:** Zgodnie z wytycznymi SSOT i Poka-yoke: *„System musi akceptować liczby powyżej pakietu (np. 11/10, 12/10) bez automatycznego zerowania, aż do jawnej akcji Zakończ Pakiet”*.

### Defekt 2: Brak automatycznego podpinania nowego pakietu po osiągnięciu limitu
* **Objaw:** Po zamknięciu pakietu i rozpoczęciu nowego (np. od 24 czerwca), jeśli trener nie wskaże ręcznie nowego `start_training_id`, kolejne treningi nie są numerowane od `[1/10]`.

---

## 4. Plan Naprawczy (Actionable Remediation Plan)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PLAN NAPRAWCZY BACKENDU                         │
│                                                                        │
│   KROK 1: Usunięcie sztucznego ograniczenia w calendar.py:142         │
│          Zezwolenie na ciągłe numerowanie (11/10, 12/10)               │
│          │                                                             │
│          ▼                                                             │
│   KROK 2: Aktualizacja logiki zamykania pakietu                       │
│          Automatyczne ustawianie end_training_id na ostatnim treningu  │
│          │                                                             │
│          ▼                                                             │
│   KROK 3: Weryfikacja regresyjna przez atylla_test_harness             │
│          Uruchomienie pełnego zestawu 3 cykli testowych                │
└────────────────────────────────────────────────────────────────────────┘
```

### Poprawka w `backend/routers/calendar.py`:
Zastąpienie linii 142–146 kodem:
```python
pkg_size = pkg.get("size", 10)
event_counts[e_id] = current_count
event_counts[f"{e_id}_size"] = pkg_size
```
Dzięki tej poprawce klient z przekroczonym pakietem ma czytelne oznaczenie `[11/10]`, a trener widzi konieczność rozliczenia i otwarcia nowego pakietu.
