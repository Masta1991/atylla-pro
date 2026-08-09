# Dziennik Zmian Modułu Rozliczeń

## [2026-06-30] Faza 1: Diagnoza i Akceptacja Planu Architektury
- **Problem:** Aplikacja używała jednej globalnej zmiennej `package_current_count` na profilu klienta do określania numeru treningu we wszystkich kafelkach. Brak historii pakietów i logiki relacyjnej.
- **Akceptacja Rozwiązania (Architektura SSOT):** 
  - Wprowadzenie tabeli `client_packages` przechowującej początek, koniec i offset pakietu.
  - Kalendarz (`CalendarScreen.js`) to jedynie widok wyświetlający dynamicznie wyliczone [x/y] z aktywnych pakietów.
  - Rejestr Treningu (`TrainingScreen.js`) będzie wyzwalaczem. Tutaj kliknięcie "ROZLICZ TRENING" weryfikuje posiadanie pakietu i wyzwala Poka-yoke (Modal o braku pakietu lub zamknięciu aktualnego).
  - Widok Rozliczeń (`PaymentsScreen.js`) pozwoli zamykać pakiety (ustawiać `end_event_id`) i widzieć historię.
- **Strategia Migracji (Opcja 2):** Zostanie utworzony skrypt automatycznie migrujący (zakładający aktywne pakiety z wstrzykniętym offsetem).
- **Zasady testowe:** Bezpośrednie modyfikacje bazy przeprowadzane wyłącznie na koncie testowym (`staws22-1@gmail.com`). Dane Darka (`treneratyll@gmail.com`) zostały na nie sklonowane.
- **Wykonano operacje bazodanowe:** Skopiowano dane klienta i manualnie utworzono tabelę `client_packages` w Supabase, odpalono skrypt migracyjny z offsetami dla konta testowego.

## [2026-06-30] Faza 2: Baza Danych i Interfejsy API
- W backendzie (`routers/clients.py`) wystawiono nowe endpointy: `GET`, `POST`, `PUT`, `DELETE` pod ścieżkami paczek klienta `/clients/{client_id}/packages`. 
- Uaktualniono frontendowy `api.js` o korespondujące do nich funkcje pobierania, tworzenia, edycji i usuwania (`getClientPackages`, `createClientPackage`, `endClientPackage`, `deleteClientPackage`).
- Usunięto z `api.js` stare endpointy `startBilling` i `endBilling`.
- W backendzie (`routers/calendar.py`) zaimplementowano całkowicie nową logikę w `assign_chronological_numbers`. Zamiast opierać się na statycznym `package_current_count` pobieranym z bazy, system teraz w locie iteruje przez tabelę `calendar_events` począwszy od `start_training_id` przypisanego pakietu (oraz wspiera wsteczną historię "single" po datach zakupu).

## [2026-06-30] Faza 3: Logika Rejestru Treningu i Poka-Yoke
- Przerobiono `TrainingScreen.js` wprowadzając Smart Rozliczenie: 
  - Jeśli trener próbuje rozliczyć trening na "czystym" kliencie bez pakietu, dostaje modal Poka-Yoke: „Ten klient nie ma aktywnego pakietu. Czy chcesz go stworzyć?”.
  - Jeśli trener rozlicza ostatni trening (np. 10/10), system wyrzuca Soft-Close Modal z przypomnieniem o możliwości hermetycznego zamknięcia pakietu.

## [2026-06-30] Faza 4: Dzień 0, Ochrona Kalendarza i Zarządzanie w PaymentsScreen
- **Kalendarz (`CalendarScreen.js`):** 
  - Wyliczanie znaczników SSOT bazuje teraz na nowej fladze. 
  - Usunięto pokazywanie `[0/10]` dla klientów będących całkowitą "czystą kartą" (zainicjowano flagę `has_active_billing_or_history` po stronie backendu). 
  - Ustalono brak renderowania "czerwonych kolorowanek" po przekroczeniu limitu (np. przy 11/10 wyrenderuje to jako szary tekst tak samo jak wszystko inne).
  - Dodano twardą ochronę (`handleDeleteTap`) zapobiegającą usunięciu treningu, który służy w bazie jako kotwica `start_training_id` do wyliczania jakiegokolwiek pakietu.
- **Ekran Rozliczeń (`PaymentsScreen.js`):**
  - **Dzień 0 w pełni funkcjonalny:** Modal "Rozpocznij" używa od teraz `DropdownPicker` do precyzyjnego wskazania `start_training_id` z dotychczasowych treningów i posiada input do wklepania wartości "Offset" dla kontynuacji cyklu.
  - Zaimplementowano głęboką walidację chronologiczną przy zamykaniu pakietu – nie można wybrać treningu końcowego, który nastąpił przed treningiem startowym.
  - W Modal Historii wprowadzono obsługę `client_packages` z przyciskiem "Twarde Usuwanie", które permanentnie pozwala trenerowi wyzerować i skasować zepsuty pakiet i historię (prawdziwy "Dzień 0").

**Status:** Cały kod został wdrożony lokalnie do repozytorium. Skrypty gotowe i czekają na manualne przeklikanie PWA w środowisku testowym przez Użytkownika używając konta staws22-1@gmail.com w następnej sesji.

## [2026-07-01] Poprawka Wyświetlania Zakończonych Pakietów na Kafelkach
- **Problem:** Po zakończeniu pakietu (ustawieniu `end_training_id`), kolejne i przyszłe kafelki treningów nadal wyświetlały status pakietu jako `[0/10]`. Wynikało to z faktu, że flaga `has_active_billing_or_history` była ustawiana globalnie na `true` dla każdego treningu klienta posiadającego jakąkolwiek historię pakietów, co wymuszało renderowanie etykiety pakietowej na wszystkich kafelkach (w tym tych poza zakresem aktywnego pakietu).
- **Rozwiązanie:** W `backend/routers/calendar.py` zmodyfikowano funkcję `assign_chronological_numbers` tak, aby flaga `has_active_billing_or_history` była ustawiana na `true` **wyłącznie** dla tych konkretnych treningów, które należą do wyliczonego zakresu pakietu (znajdują się w słowniku `event_counts`). Dzięki temu dla treningów poza zakresem (przyszłych, gdy brak aktywnego pakietu) flaga przyjmuje wartość `false`, a etykieta `[0/10]` zostaje poprawnie ukryta.

## [2026-07-03] Poprawka zamykania pakietów (Brak końca pakietu po usunięciu treningu)
- **Problem:** Po usunięciu (soft-delete, `status="deleted"`) treningu, który służył jako zamykający dany pakiet (`end_training_id`), system w backendzie (`backend/routers/calendar.py`) nie mógł odnaleźć tego zdarzenia w liście pobranych treningów (z powodu wykluczania usuniętych zdarzeń). W efekcie pakiet był traktowany jako wciąż otwarty, co powodowało nanoszenie numeracji (np. `12/10`) na przyszłe kafelki, mimo że został "zamknięty".
- **Rozwiązanie:** Zmodyfikowano główne zapytanie pobierające dane do funkcji `assign_chronological_numbers`. Skrypt pobiera teraz wszystkie wydarzenia chronologicznie (w tym usunięte). Dzięki temu granice pakietów (`start_training_id` / `end_training_id`) zawsze są prawidłowo wczytane. Dodano warunek wewnątrz pętli liczącej postęp pakietu: usunięte treningi są pomijane (`continue`) i nie nabijają licznika. Gdy trener zamknie pakiet, a potem np. usunie końcowy trening, aplikacja i tak poprawnie utnie cykl i wyczyści etykiety liczbowe dla kafelków poza tym pakietem.
