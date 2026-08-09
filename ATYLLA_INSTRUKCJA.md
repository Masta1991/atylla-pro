# Instrukcja Użytkownika — Atylla Pro

Niniejszy dokument opisuje **wyłącznie funkcje rzeczywiście działające** w aplikacji Atylla Pro.

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
  - *Odwołany (z zachowaniem jednostki)* — podopieczny odwołał zbyt późno (jednostka pobrana).
  - *Odwołany (bez pobrania)* — jednostka wraca do puli klienta.

## 3. Baza Klientów i Pakiety
- Kartoteka klienta: dane kontaktowe, data rozpoczęcia współpracy, cele i preferencje.
- Przypisywanie pakietów treningowych (np. 10 treningów, 20 treningów).
- Automatyczne wyliczanie pozostałych jednostek oraz alert o kończącym się pakiecie.

## 4. Dziennik Treningowy i Pomiary
- Zapis wykonanych ćwiczeń, ciężarów, serii i powtórzeń.
- Tabela pomiarów obwodów ciała i wagi z generowaniem wykresów trendu.

## 5. Raporty Postępów
- Generowanie raportów podsumowujących dla klienta z automatyczną wysyłką e-mail.
