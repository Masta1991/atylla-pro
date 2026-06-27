# INSTRUKCJA OBSŁUGI — Atylla Pro v1.3.13

Aplikacja do zarządzania treningami personalnymi.

---

## 1. LOGOWANIE

Wpisz email i hasło przypisane do Twojego konta trenerskiego. Każdy trener ma własną, odizolowaną bazę danych — nie widzisz klientów, planów ani terminów innych trenerów.

Przy pierwszym logowaniu nowego trenera aplikacja automatycznie tworzy podstawowy zestaw startowy:
- 3 rodzaje treningów (Push, Pull, FBW)
- 4 partie mięśniowe (Klatka Piersiowa, Plecy, Nogi, Barki)
- 16 ćwiczeń (po 4 na każdą partię)

---

## 2. KALENDARZ — EKRAN GŁÓWNY

### Nawigacja
- **← →** — przełączanie między tygodniami
- **Data na górze** — kliknij, aby szybko przeskoczyć do konkretnego tygodnia/miesiąca
- **Ikona kalendarza (prawy górny róg)** — przełączanie między widokiem tygodnia a dnia

### Dolny pasek
- **HISTORIA (zegar)** — włącza tryb szybkiego podglądu (po kliknięciu w kafelek na kalendarzu, aplikacja przenosi bezpośrednio do historii klienta)
- **GŁÓWNA (piesek)** — główny widok / powrót do kalendarza
- **EDYCJA (ołówek)** — włącza tryb edycji (kasowanie i przeciąganie)

### Dodawanie treningu
1. Kliknij na pusty slot w kalendarzu (dzień + godzina)
2. Wybierz podopiecznego
3. Wybierz rodzaj treningu lub plan
4. Dodaj ćwiczenia, ciężary, powtórzenia
5. Opcjonalnie: notatka (możliwość dyktowania głosowego — mikrofon)
6. Kliknij **ZAPISZ**

### Przenoszenie treningu (drag & drop)
1. Włącz tryb **EDYCJA** (prawy dolny przycisk)
2. Przytrzymaj palec na kaflu treningu
3. Pojawi się banner "Przenoszenie..."
4. Kliknij w docelowy slot

### Usuwanie treningu
1. Włącz tryb **EDYCJA**
2. Kliknij **X** na kaflu
3. Potwierdź usunięcie
4. **Nowe**: pojawi się pytanie "Czy chcesz rozliczyć ten trening?" — jeśli klikniesz OK, trening zostanie doliczony do pakietu klienta przed usunięciem
5. Usunięty trening automatycznie tworzy wpis w **Absencjach**
6. W kalendarzu pojawi się **czerwony trójkąt** w rogu slotu — najechanie pokazuje "Trening odwołany: [imię klienta]"

### Rozliczanie treningu (ikonka $)
- Po zakończonym treningu kliknij slot → ekran treningu → przycisk **ROZLICZ TRENING**
- Dolicza 1 do licznika pakietu klienta
- Rozliczone treningi mają ikonkę $ na kaflu

### Statusy rozliczeniowe na kafelkach (NOWE)
- System automatycznie oznacza cykle rozliczeniowe bezpośrednio na kafelkach kalendarza:
  - **Koniec Pakietu** – pojawia się na ostatnim zrealizowanym treningu w ramach obecnego pakietu.
  - **Rozpoczęto nowy pakiet** – przypisywane automatycznie do kolejnego planowanego treningu po kliknięciu "Rozpocznij nowy pakiet".
  - **Rozliczono** – widoczne po ręcznym wskazaniu ostatnio opłaconego treningu u klientów bez pakietu.
  - **Rozpoczęto nowe rozliczanie** – pojawia się na następnym treningu po "Rozliczono".

### Tryb HISTORIA (lewy dolny przycisk)
- Kliknij kafelek → wyświetla historię treningów danego klienta
- Szybki podgląd ostatnich sesji, ciężarów i progresji

---

## 3. KLIENCI

### Lista klientów
- **Menu hamburger → Klienci** → pełna lista podopiecznych
- Każdy klient pokazuje imię, datę dołączenia, przypisany plan

### Dodawanie / Edycja klienta
1. Kliknij **+** lub wybierz klienta z listy
2. Wypełnij dane:
   - Imię i nazwisko
   - Telefon, email
   - Data dołączenia
   - **Forma płatności**: Pakiet (np. 10 treningów) / Miesięcznie / Bez pakietu
   - **Harmonogram stałych treningów**: dzień tygodnia, godzina, plan
   - **Progresja siłowa**: wybierz ćwiczenia do śledzenia postępów

### Harmonogram
Harmonogram automatycznie generuje wpisy w kalendarzu na 2 tygodnie do przodu. Przy każdej zmianie harmonogramu terminy są odświeżane.

---

## 4. TRENING (wpisywanie ćwiczeń)

### Wybór ćwiczeń
1. Wybierz klienta i datę/godzinę
2. Wybierz rodzaj treningu lub plan
3. Ćwiczenia ładują się automatycznie z planu (jeśli przypisany)
4. Dla każdego ćwiczenia wpisz ciężar (kg) i powtórzenia

### Dyktowanie notatek (NOWE)
- Przy polu "Notatka" kliknij przycisk **Dyktuj** z mikrofonem
- Mów — tekst automatycznie się wpisuje
- Działa w Chrome/Edge, język polski

### Auto-uzupełnianie
- Przy ponownym wejściu w trening tego samego klienta, aplikacja pamięta ostatnio użyte ćwiczenia i ciężary

---

## 5. PLANY TRENINGOWE

### Tworzenie planu
- Menu hamburger → **Plany treningowe** → kliknij **+**
- Nadaj nazwę, przypisz rodzaj treningu
- Dodaj ćwiczenia z listy

### Zarządzanie planem
- **Ustawienia → Edytor planów treningowych** — pełna edycja
- Dodawaj, usuwaj, zmieniaj kolejność ćwiczeń
- Plany są przypisywane do klientów w formularzu klienta

---

## 6. MENADŻER

Narzędzie do planowania tygodnia.

### Dwie sekcje
- **Treningi z Harmonogramu** — terminy wynikające z harmonogramów klientów
- **Pozostałe Treningi** — wszystkie inne wpisy w kalendarzu

### Kopiowanie na kolejne tygodnie / miesiące
1. Zaznacz wybrane treningi (ptaszek)
2. Kliknij **Kopiuj zaznaczone na następny tydzień** lub **Kopiuj na następny miesiąc** (4 tygodnie).
3. **Uwaga (Nadpisywanie)**: Kopiowanie całkowicie nadpisuje treningi w docelowym okresie. Ewentualne wcześniejsze zapisy w docelowym tygodniu są usuwane (i nie wliczają się do rozliczeń) na rzecz nowo kopiowanych.
4. Treningi kopiowane uwzględniają **Absencje** klienta – jeśli w docelowym tygodniu klient ma zapisaną absencję, treningi z harmonogramu automatycznie ją pominą (nie nadpiszą jej).

### Ostrzeżenia i Zastępstwa
- Manager pokazuje, czy klient ma absencję w następnym tygodniu.
- Zastępstwa są odpowiednio oznaczone.

### Czyszczenie Tygodnia (NOWE)
- Masz możliwość szybkiego i całkowitego wyczyszczenia danego tygodnia (tylko tygodni przyszłych, które się jeszcze nie rozpoczęły).
- Użyj czerwonego przycisku **Wyczyść ten tydzień** na dole ekranu menedżera. Wszystkie zapisy zostaną trwale usunięte z bazy (bez dodawania do absencji/historii).

---

## 7. ROZLICZENIA

### Status pakietów
- **Rozliczenia** (w menu hamburger) — lista wszystkich klientów z ich pakietami
- Pokazuje: typ (Pakiet / Miesięcznie / Bez pakietu), użyte/zakupione treningi

### Nowy pakiet / Nowy miesiąc
- Kliknij **Nowy Pakiet** (lub Nowy Miesiąc) — archiwizuje obecny stan i zaczyna od 0.
- **Wybór daty (NOWE)**: Dla klientów *bez pakietu* (Miesięcznie / Pojedyncze), system zapyta o datę **Ostatnio zapłaconego treningu**. Możesz wybrać ją z rozwijalnej listy (treningi z ostatnich i nadchodzących dni). System następnie automatycznie oznaczy ten trening jako "Rozliczono" na kalendarzu.

### Zwiększanie pakietu (NOWE)
- Kliknij zielony **+** przy kliencie z pakietem
- Podaj liczbę dokupionych treningów
- **Komentarz jest wymagany** (np. "Klient dokupił 10 treningów")

### Edycja licznika
- Kliknij ikonę ołówka — możesz ręcznie skorygować liczbę zużytych treningów
- Każda korekta wymaga podania powodu

### Historia
- Przycisk **Historia** — pełna historia płatności i zmian pakietu
- Możliwość edycji zarchiwizowanych wpisów

---

## 8. ABSENCJE

- **Menu hamburger → Absencje** — lista wszystkich odwołanych terminów.
- **Ręczne dodawanie**: Wybierz klienta, a z listy rozwijanej wybierz **jedną lub wiele dat naraz** (wiele checkboxów) oraz, jeśli to konieczne, precyzyjną godzinę.
- **Wpływ na Kalendarz**: 
  - Jeśli zapiszesz absencję w dniu, w którym klient miał już zaplanowane treningi, system **automatycznie je odwoła i zdejmie z kalendarza** (bez naliczania kosztów w pakiecie, jak w przypadku ręcznego usunięcia).
  - Absencje blokują kopiowanie w Menadżerze – treningi z harmonogramu nie zostaną na ten dzień wstawione.

---

## 9. POMIARY CIAŁA

- **Menu hamburger → Pomiary** — rejestruj wagę, % tkanki tłuszczowej, % masy mięśniowej
- Wybierz klienta → wprowadź datę i wartości
- Historia pomiarów dostępna dla każdego klienta

---

## 10. RAPORTY

- **Menu hamburger → Raporty** — generuj raporty email dla klientów
- Wybierz klienta, okres (1/2/3/6 miesięcy)
- Raport zawiera:
  - Liczbę sesji treningowych
  - Top partie mięśniowe
  - Zmiany w składzie ciała
  - Progresję siłową
  - Wykresy (słupkowy — sesje tygodniowo, liniowy — progresja siłowa)
- Raport wysyłany na email klienta

---

## 11. STREFA TRENERA

- **Menu hamburger → Strefa Trenera** — statystyki
- Domyślnie pokazuje **bieżący miesiąc**
- Nawigacja ← → między miesiącami
- **Treningi w tygodniach** — rozkład na poszczególne tygodnie miesiąca
- **Łącznie w miesiącu**
- **Wykres roczny** — słupkowy, 12 miesięcy

---

## 12. USTAWIENIA

- **Menu hamburger → Ustawienia**
- Tryb: Ciemny / Jasny
- Motywy kolorystyczne (różne akcenty)
- Zarządzanie ćwiczeniami (partie, rodzaje)
- Edytor planów treningowych

### Aktualizacja aplikacji (NOWE)
- Sekcja **Aktualizacja** na dole ekranu
- Pokazuje aktualnie zainstalowaną wersję
- Przycisk **Sprawdź** — porównuje z wersją na serwerze
- Jeśli dostępna jest nowsza — przycisk **ODŚWIEŻ APLIKACJĘ**

---

## 13. INSTALACJA NA TELEFONIE (PWA)

### iOS (Safari)
1. Otwórz `atylla-pro-production.up.railway.app` w Safari
2. Kliknij ikonę Udostępnij (kwadrat ze strzałką)
3. Wybierz **Dodaj do ekranu głównego**
4. Nadaj nazwę i kliknij **Dodaj**

### Android (Chrome)
1. Otwórz `atylla-pro-production.up.railway.app` w Chrome
2. Kliknij 3 kropki → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**

> **Uwaga**: po aktualizacji aplikacji na serwerze, zainstalowana PWA może wymagać odświeżenia. Wejdź w Ustawienia → Aktualizacja → Sprawdź.

---

## 14. KONTA TRENERSKIE (wielodostęp)

Każdy trener ma własne, w pełni odizolowane konto:
- Własna baza klientów
- Własne plany treningowe
- Własny kalendarz
- Własne ćwiczenia i partie

Logowanie innym kontem: wyloguj się (menu hamburger → Wyloguj) i zaloguj ponownie.

> Aktualne konto widać na dole menu hamburgerowego.

---

## SZYBKI START

| Co chcesz zrobić | Gdzie |
|---|---|
| Dodać trening | Kalendarz → kliknij slot → wybierz klienta → ćwiczenia → ZAPISZ |
| Dodać klienta | Menu hamburger → Klienci → + |
| Rozliczyć trening | Wejdź w trening → ROZLICZ TRENING |
| Sprawdzić pakiety | Menu → Rozliczenia |
| Zaplanować tydzień | Menu → Menadżer → zaznacz → kopiuj |
| Sprawdzić statystyki | Menu → Strefa Trenera |
| Wysłać raport | Menu → Raporty |
| Sprawdzić aktualizację | Menu → Ustawienia → Aktualizacja |
