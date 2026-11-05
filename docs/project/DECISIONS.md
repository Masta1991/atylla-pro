# Rejestr Decyzji Architektonicznych — Atylla Pro

## DEC-ATYLLA-001: Wybór Architektury Backendowej FastAPI + Supabase
- **Status**: Zatwierdzona
- **Data**: 2026-05-10
- **Kontekst**: Aplikacja wymagała szybkiego, asynchronicznego API z silną walidacją typów oraz relacyjnej bazy danych PostgreSQL.
- **Decyzja**: Zastosowanie FastAPI (Python 3.12, Pydantic v2) jako warstwy API oraz Supabase PostgreSQL jako zarządzanej bazy danych.
- **Konsekwencje**: Wysoka wydajność, łatwość pisania testów jednostkowych, bezpieczeństwo relacji w bazie.

## DEC-ATYLLA-002: Standaryzacja Systemu Zarządzania i Testowania (Wzorzec Jarvis)
- **Status**: Zatwierdzona
- **Data**: 2026-08-09
- **Kontekst**: Wymóg ujednolicenia standardów zarządzania projektami, wyeliminowania konieczności manualnego testowania i wdrożenia autonomicznego QA skilla.
- **Decyzja**: Wdrożenie pełnego zestawu governance (AGENTS.md, PROJECT.md, implementation_plan.md, MODEL_HANDOFF.md, LOG.md) oraz dedykowanego skilla testowego `skills/atylla_test_harness/`.


## DEC-ATYLLA-003: Odwołania, przypomnienia i sezonowość
- **Data**: 2026-10-02; jawne wymagania użytkownika, implementacja lokalna 2.1.18.
- Odwołanie oznacza trening opłacony. Dawne nieopłacone odwołania pozostają w bazie,
  lecz są pomijane w Strefie Trenera, widoku tygodnia i widocznych podsumowaniach rozliczeń.
- Roczny wykres obejmuje odbyte treningi i opłacone odwołania, bez planowanych.
- Potwierdzenie usuwa przypomnienie także z treningu źródłowego; tekst pozostaje
  w dzienniku. Każda notatka ma własne potwierdzenie, bez karuzeli i licznika.
- Przycisk rozpoczęcia pakietu zachowuje wspólny wiersz z pozostałymi przyciskami;
  poprawione zawijanie/wyśrodkowanie tekstu. W szufladzie można wybrać wspólną pulę.
- Historia miesięczna trenera jest osobnym źródłem wyłącznie dla raportu sezonowości.
  Ręczny wynik zastępuje cały miesiąc w tym raporcie, nie dodaje się do wyniku aplikacji
  i nie zmienia treningów, kotwic ani rozliczeń. Usunięcie przywraca wynik aplikacji/brak danych.
- Brak danych nie oznacza zera. Rankingi pomijają miesiąc bieżący i pierwszy miesiąc
  zapisów aplikacji, chyba że kompletny wynik został uzupełniony ręcznie.
- Powtarzalność sezonu wynika z pozycji miesiąca w pełnym roku (dolne/górne trzy),
  zgodnej w co najmniej dwóch i 2/3 porównanych lat. Średnie mają jawne pokrycie.
- Migracja 013 jest addytywna. Początkowo przygotowana lokalnie; późniejsza zgoda i wykonanie opisane poniżej.

- Decyzja użytkownika 2026-10-02 (zastąpiona 2026-10-03): wstrzymać dalsze poprawki jasnego motywu.
  Pozostałe wykryte problemy jego kontrastu są świadomie odłożone; odbiór dotyczy ciemnego motywu.

### Doprecyzowanie 2026-10-03 — publikacja i oba motywy

Użytkownik zatwierdził publikację 2.1.18, a następnie wycofał odroczenie jasnego motywu. Poprawiono wykazane kontrasty w obu motywach bez powiększania szuflady. Publikacja i addytywna migracja 013 zakończyły się PASS; dowód w audycie DEPLOY_2.1.18_2026-10-03.json. Nowsza decyzja zastępuje wcześniejsze odłożenie jasnego motywu.

## DEC-ATYLLA-004: Planowanie pracy i preferencje trenera

- **Data**: 2026-10-04.
- **Status**: wdrożone i zweryfikowane na produkcji 2.1.21; użytkownik polecił
  implementację i publikację 2026-10-04. Dowód: DEPLOY_2.1.21_2026-10-04.json.
- Domyślna reguła dla wszystkich istniejących i nowych profili: początek pracy
  od 06:00, sesja 60 minut, start i koniec o pełnej godzinie. Wyjątki nie zmieniają
  reguły. Brak zadeklarowanych stałych dni pracy ani godziny zakończenia.
  06:00 nie oznacza potwierdzonej dostępności każdego dnia do ostatniego slotu.
- Grafik jest zmienny. Występują stałe terminy i odstępstwa. Okno pomiędzy sesjami
  może być pożądanym czasem własnym; nie uznawać go automatycznie za stratę.
- Przed każdą analizą można ponownie zadawać pytania i zmieniać preferencje
  dotyczące obłożenia. Odpowiedzi mają być utrwalane w bazie i rozdzielone między
  profile. Ustawienia aplikacji mają pokazywać regułę oraz preferencje planowania.
- Integracja z AI jest możliwością na przyszłość, bez obecnej integracji,
  przekazywania danych zewnętrznemu modelowi lub nowego kosztu.

### Kontrakt silnika

1. Odczyt 3/6 zakończonych miesięcy, z jawnym zakresem dostępnych danych.
   Dni bez zapisów i skąpe miesiące nie są dowodem wolnego czasu ani urlopu.
   Pierwszy okres, odstępstwa i podejrzenie braków wymagają oznaczenia jakości.
2. Przed uruchomieniem: ostatnie odpowiedzi do potwierdzenia/zmiany; cel analizy
   (czas, dodatkowe sesje, równowaga), pożądane przerwy, maksymalna liczba sesji
   z rzędu, ewentualne granice dnia i terminy, których nie wolno proponować zmieniać.
   Pytania kontekstowe powstają z obserwacji, np. o częste okno lub skąpy miesiąc.
3. „Tylko ta analiza” i „Zapisz jako moje ustawienia” mają odrębne skutki.
   Odpowiedź „nie wiem/pomiń” pozostawia niepewność, nie oznacza zgody ani zera.
   Oznaczenie chronionej przerwy może dotyczyć jednej daty albo dni tygodnia
   w podanym okresie. Nowy cel nie usuwa automatycznie chronionych przerw.
4. Minimalna trwałość: bieżące trainer_planning_preferences (właściciel,
   wersja formatu, revision, data zmiany, zwalidowane preferencje) oraz niezmienne
   trainer_planning_analyses (zakres, wersja silnika, odpowiedzi, założenia,
   minimalne dowody wejściowe, wynik i data odczytu). Pytania mają stabilne ID,
   wersję i zapis tekstu; odpowiedzi należą do konkretnej analizy.
5. Silnik deterministyczny liczy zajętość i warianty przy zadanych ograniczeniach.
   Sesja wspólna zajmuje czas raz; opłacone odwołanie nie jest przepracowaną godziną.
   Propozycje porównują czas zakończenia, sesje, przerwy i warunkowy przychód,
   z podaniem wymaganych zmian. Brak dopuszczalnej poprawy jest prawidłowym wynikiem.
6. Historyczny termin lub jego zmienność nie potwierdza dyspozycyjności klienta.
   Bez potwierdzonej elastyczności propozycja jest wariantem do uzgodnienia;
   trening wspólny wymaga dostępności obu osób. Nie przesuwać kalendarza automatycznie.
7. API ustala właściciela z uwierzytelnionej sesji, a RLS izoluje obie tabele.
   Zapis preferencji kontroluje revision; zapis analizy jest idempotentny.
   Zmiana preferencji nie nadpisuje wcześniejszych raportów. Późniejsza edycja
   kalendarza oznacza potrzebę nowej analizy, nie aktualność starej propozycji.
8. Późniejsze AI może objaśniać wyliczone warianty i proponować pytania.
   Liczby, ograniczenia i dopuszczalność sprawdza silnik; interfejs czyta liczby
   ze strukturalnego wyniku. Funkcja działa również bez AI.

### Doprecyzowanie: propozycje dla konkretnych klientów

- Użytkownik chce wskazywać konkretnych klientów sugerowanych do zmiany godziny.
  Karta propozycji pokazuje imię/nazwisko z własnego profilu trenera, bieżącą
  i proponowaną datę/godzinę, powód wyboru oraz korzyść policzoną dla całego dnia.
- Dla cyklicznej propozycji jawnie określić dni tygodnia i zakres obowiązywania;
  nie mieszać pojedynczego przesunięcia z trwałą zmianą harmonogramu klienta.
- Wynik wskazuje wszystkie sesje wymagające przesunięcia (obie osoby w parze),
  zachowane przerwy i warunki wykonalności. Dopuszczalność wynika z aktualnego
  kalendarza i preferencji, a historia pomaga wyjaśnić wybór kandydata.
- Wcześniejsze wizyty o innej godzinie są dowodem historycznym, nie zgodą na nowy
  termin. Przy braku potwierdzonej dostępności: „Do uzgodnienia z klientem”.
  Pytanie o możliwość przesunięcia może uzupełniać kolejną analizę; nie zastępuje
  potwierdzenia przez klienta. Brak automatycznych przesunięć i kontaktu z klientem.
- Dane kandydatów i sesji muszą należeć do uwierzytelnionego trenera; nazwy nie
  trafiają do wspólnych ustawień innych profili. Preferować mniejszą liczbę zmian
  przy porównywalnej korzyści, z wyjaśnieniem wpływu każdego wariantu.

### Realizacja 2.1.21

- Migracja 014: RLS właściciela, odczyt profilu, zapis preferencji przez
  uwierzytelniony RPC z CAS. Zapis snapshotu tylko przez service_role w API,
  po uwierzytelnieniu aktora i obliczeniu wyniku na serwerze. Bezpośredni
  użytkownik nie może podmienić wyniku raportu. Prywatne helpery bez grantów API.
- Zapis raportu jest idempotentny i atomowy z opcjonalnym zapisem preferencji.
  Błąd 409/422 umożliwia poprawę/odświeżenie; niepewny zapis zachowuje ID i payload.
- Pierwsza wersja proponuje konkretne dni w następnych 28 dniach, przesunięcie
  jednej/dwóch końcowych sesji do wewnętrznych okien albo dodatkową sesję.
  Brak cyklicznych zmian harmonogramu. Niedziele pominięte zgodnie z kalendarzem.
- Pytania obejmują do 24 obserwacji; niepotwierdzone powtarzalne przerwy są
  chronione także poza pokazanym limitem. Urlop/niepełna historia wyłącza
  miesiąc z typowych wzorców, bez usuwania rzeczywistych statystyk okresu.
- Ustawienia są indywidualne; reguły domyślne działają bez tworzenia wierszy
  dla wszystkich kont. Historia obejmuje 50 ostatnich analiz w interfejsie.
- Wykres roczny zachowany, średnie ważone dniami, rozwijane tygodnie/lista.
  Sezonowość zachowuje obliczenia i tekstowe wnioski, udostępnia wybór miesiąca.
- Testy offline i przeglądarkowe oraz kontrola produkcji opisane w RELEASE_2.1.21.md.
  Nie wykonywano zapisów testowych na rzeczywistych kontach ani integracji z AI.


### Korekta wizualna 2.1.22

- Użytkownik odrzucił wygląd 2.1.21: funkcjonalne wdrożenie nie odwzorowało
  zaakceptowanego mockupu. Wiążącą referencją jest oryginalny plik
  atylla-strefa-trenera.html, nie nowa interpretacja opisu.
- Przeniesiono układ okresu, statystyk, wykresu i tabel, rozwijanych sekcji,
  hierarchię Grafiku i Sezonowości oraz tokeny wizualne. Późniejsze ustalenia
  działania silnika pozostają nadrzędne wobec przykładowej treści mockupu.
- Macierze renderu porównane z oryginalną referencją; wdrożenie 2.1.22
  potwierdzone odczytem dokładnego pakietu produkcyjnego. Odbiór telefonu otwarty.


## Absencje przed skopiowaniem tygodnia — 2026-10-11

- Użytkownik wymaga zgłoszenia przyszłej absencji na podstawie stałego
  harmonogramu klienta także bez wydarzenia/kafelka w kalendarzu.
- Realizacja 2.1.25: takie zgłoszenie jest oznaczeniem nieobecności, pomijanym
  przez kopiowanie tygodnia. Nie tworzy płatnego treningu i nie zmienia pakietu.
- Istniejące sesje zachowują dotychczasową zasadę płatnego odwołania (DEC-003).
  Zasady obu czynności wyjaśnia ogólny opis formularza.
- Późniejsza decyzja użytkownika 11.10: lista ma zawierać tylko datę i godzinę,
  jak wcześniej. Usunięto powtarzane opisy rodzaju terminu i wspólnej sesji.
  Nie zmienia to trybu zapisu, rozliczeń ani ochrony przed konfliktem.
- Zmiana typu/wersji terminu wymaga ponownego świadomego wyboru; nie wolno
  automatycznie zamienić zgłoszenia z harmonogramu na płatne odwołanie.
- Usunięcie oznaczenia nie cofa rozliczenia ani nie przywraca wydarzenia.
  Zachowuje historię i umożliwia ponowne planowanie pustego terminu.
- Zapis wielu dat jest atomowy, maksymalnie 30 pozycji. Brak drugiego licznika
  pakietu. Po ponownym audycie i jawnej zgodzie użytkownika wdrożono 2.1.25
  wraz z migracją 015; odbiór produkcji zapisano w DEPLOY_2.1.25_2026-10-11.json.

## Ciekawostki — jednorazowy podgląd 4.10.2026

- Jawna decyzja użytkownika: publikacja 2.1.23 i dowolna ciekawostka testowa dziś.
- Wybrano istniejący tekst o wydrach (drugi wpis), bez zmiany źródła.
- Superseded wyłącznie dla 2026-10-04: wcześniejsza zasada pustego paska przed
  5.10 oraz we wszystkie niedziele. Wyjątek wygasa o północy Europe/Warsaw.
- Od 5.10 normalny harmonogram, pozostałe niedziele puste. Dowód:
  DEPLOY_2.1.23_2026-10-04.json oraz test granic daty/otwartego menu.
