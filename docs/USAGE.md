# Instrukcja Użytkownika — Atylla Pro

## Absencje — 2.1.25, wdrożono 2026-10-11

Po aktualizacji przeładuj aplikację i sprawdź numer **2.1.25**.

Wybierz klienta i terminy na ekranie **Absencje**. Lista obejmuje najbliższe
60 dni: treningi zapisane w kalendarzu oraz przyszłe terminy ze stałego grafiku.
Możesz wybrać do 30 terminów i zapisać je razem.

- **Termin ze stałego grafiku bez kafelka**: możesz
  zgłosić absencję przed skopiowaniem tygodnia. Kopiowanie pominie termin,
  a samo zgłoszenie nie tworzy treningu i nie zmniejsza pakietu.
- **Trening już wpisany do kalendarza**: odwołanie istniejącej sesji
  jest rozliczane zgodnie z dotychczasowymi zasadami. Przy wspólnym treningu
  dotyczy obu osób. Lista pokazuje tylko datę i godzinę, bez opisów przy terminach.
- Zmiana terminu w trakcie wyboru wymaga odświeżenia i ponownego zaznaczenia.
  Gdy jedna pozycja nie może zostać zapisana, cały zestaw pozostaje niezapisany.
- Kosz usuwa **oznaczenie absencji**. Nie przywraca odwołanego treningu ani
  nie cofa opłaty. Dla przyszłego terminu bez kafelka pozwala ponownie go
  zaplanować, np. przy kolejnym kopiowaniu tygodnia.

Opis wersji produkcyjnej **2.1.18**, wdrożonej 2026-10-03 wraz z migracją 013. Jasny i ciemny motyw są dostępne. Po aktualizacji przeładuj aplikację i sprawdź numer wersji.

---

## 1. Logowanie i Dostęp
- Trener loguje się adresem e-mail oraz hasłem.
- System automatycznie zarządza tokenami JWT (dostęp i odświeżanie sesji).

## 2. Kalendarz Treningowy
- **Widok tygodniowy**: Prezentacja od poniedziałku do soboty w godzinach 06:00 – 21:00.
- **Dodawanie treningu**: Kliknięcie w wolny slot czasowy otwiera formularz wyboru klienta i typu treningu.
- **Przesuwanie i zamiana (Drag & Drop)**: Możliwość szybkiej zmiany godziny lub dnia treningu.
- **Statusy obecności**:
  - *Zaplanowany* — domyślny status po utworzeniu.
  - *Zrealizowany* — automatycznie odejmuje 1 jednostkę z aktywnego pakietu klienta.
  - *Odwołany opłacony* — jednostka jest pobrana. Wariant bez płatności jest wyłączony.

### Notatki i przypomnienia (2.1.18)

Od wersji 2.1.18 obowiązuje poniższe zachowanie.

- Notatkę wpisujesz w dzienniku treningu. Po zapisaniu kafelek w kalendarzu pokazuje ikonę kartki.
- Na kolejnych treningach tego podopiecznego pojawia się ta sama ikona kartki, bez dzwonka i licznika. Oznacza wcześniejszą nieprzeczytaną notatkę; przypomnienie nie wygasa po jednym treningu ani po zmianie tygodnia.
- Po dotknięciu kafelka dolna szuflada pokazuje osobne oczekujące notatki z datą i krótkim podglądem, maksymalnie dwie linie. Lista jest przewijana, bez licznika „1/95”. Dotknij wybranego podglądu, aby przeczytać całość.
- Samo otwarcie nie usuwa przypomnienia. W szufladzie naciśnij kwadratowy przycisk **✓** po prawej stronie notatki; wtedy przypomnienie i jego ikona znikają także z treningu źródłowego. Treść pozostaje w dzienniku treningu. Pozostałe niepotwierdzone notatki nadal wymagają odczytu.
- Zmiana treści przeczytanej notatki ponownie włącza przypomnienie. Informacja o odczycie jest zapisywana na koncie trenera.
- Notatka ze wspólnego treningu przypomina o sobie przy kolejnych treningach obu uczestników. Oznaczenie jej jako przeczytanej wyłącza to wspólne przypomnienie.

## 3. Baza Klientów i Pakiety
- Kartoteka klienta: dane kontaktowe, data rozpoczęcia współpracy, cele i preferencje.
- Przypisywanie pakietów treningowych (np. 10 treningów, 20 treningów).
- Automatyczne wyliczanie pozostałych jednostek oraz alert o kończącym się pakiecie.

## 4. Dziennik Treningowy i Pomiary
- Zapis wykonanych ćwiczeń, ciężarów, serii i powtórzeń.
- Tabela pomiarów obwodów ciała i wagi z generowaniem wykresów trendu.

## 5. Raporty Postępów
- Generowanie raportów podsumowujących dla klienta z automatyczną wysyłką e-mail.


## 6. Strefa Trenera — raport sezonowości (2.1.18)

Wybierz **Raport sezonowości · porównaj lata**, wpisz zakres (maksymalnie 10 lat)
i naciśnij **Wygeneruj raport**. Tabela porównuje miesiące kolejnych lat; można ją
przewijać w bok. Wynik obejmuje sesje odbyte i opłacone odwołania, wspólną sesję licząc raz.

Raport pokazuje najlepsze/najsłabsze zakończone miesiące, średnie wraz z liczbą lat
z danymi oraz powtarzające się spokojne i intensywne okresy. Te ostatnie wymagają
minimum dwóch pełnych lat. Niepełny miesiąc bieżący i pierwszy miesiąc zapisów
aplikacji nie są używane do rankingu. Brak danych oznaczono „—”, nie zerem.

W **Uzupełnij dane historyczne** wybierz rok/miesiąc i wpisz pełną liczbę treningów,
łącznie z opłaconymi odwołaniami. Możesz też dotknąć miesiąca w tabeli. Ręczny wpis
jest oznaczony i zastępuje wynik tylko w raporcie sezonowości; nie zmienia pakietów.
Wartość 0 jest dozwolona. Możesz poprawić lub usunąć wpis — usunięcie przywróci
wynik zapisany w aplikacji albo brak danych. Dane można wpisywać tylko za zakończone miesiące.

## 7. Rozliczenia i pakiety z kalendarza (2.1.18)

Przy **Rozpocznij pakiet** w szufladzie zaznacz **Pakiet łączony** i wybierz
co najmniej jedną dodatkową osobę bez aktywnego rozliczenia. Osoby dzielą jedną pulę.
Przycisk startu pozostaje we wspólnym rzędzie, z tekstem dopasowanym do szerokości.
Po usunięciu wpisu historii rozliczeń wracasz do odświeżonych szczegółów tej samej osoby.
