# Kontrakt z zaakceptowanym mockupem — 2.1.22

Źródło: HTML `atylla-strefa-trenera.html` z wizualizacji rozmowy
`01a1058f-eb77-77a1-8250-c2968fef5a7b`. To rzeczywisty zaakceptowany podgląd,
nie Figma ani kontrakt odtworzony z opisu. Referencja pozostawiona bez zmian.
Zrzuty odniesienia: `.tmp/release-2.1.22/reference`, aplikacji: `browser`
i `browser-final` w tym samym katalogu. Dane obu widoków są przykładowe;
porównanie dotyczy układu i ról, nie wartości liczbowych.

| Rola | Rozjazd w 2.1.21 | Korekta 2.1.22 |
|---|---|---|
| Zakładki | osobne obramowane przyciski | segmenty na wspólnym tle |
| Okres | tytuł + karta z 3 rzędami | 44 px strzałki, miesiąc i rok w jednym rzędzie |
| Statystyki | kolorowe liczby, trzecia karta pod spodem | trzy równe neutralne kafelki |
| Wniosek | duża karta Rytm miesiąca | tekst z pionową miedzianą linią |
| Wykres | 82 px kolumny, dodatkowe opisy | kolumny 66 + 6 px, pole 240 px |
| Szczegóły miesiąca | dodatkowe kolorowe paski | tabelka na podniesionym tle |
| Liczby roku | długa lista opisowa | tabela 4 kolumn z tygodniową średnią |
| Brak danych | zero | kreska, bez sugerowania kompletności |
| Tygodnie/lista | duże karty z plusem | płaskie sekcje z trójkątnym znacznikiem |
| Grafik | stary nagłówek i przyciski okresu | kicker, tytuł, wybór okresu, karty wzorców |
| Sezonowość | karta zakresu z polami tekstowymi | dwa selektory lat, wnioski, tabela, edytor |

## Tokeny i świadome adaptacje

TrainerDesignProvider ogranicza zmiany do Strefy Trenera i osobnego raportu
sezonowego. Pozostałe ekrany korzystające z TrainerPanels zachowują swoje style.
Kolory referencji: tło #faf7f1/#0d1117, powierzchnia #fffdfa/#171d25,
podniesione tło #f2e9dd/#222a35, tekst #3c3429/#e7edf3,
tekst pomocniczy #746856/#a4aebc, obramowanie #e7dccd/#303844,
miedź #9b6245/#d09a78, słupki #c68b6d.
Hierarchia: tytuł 21/27, nagłówek 15/21, tekst 14/21, pomocniczy i etykiety
12/18, liczby 26. Promienie: karta 16, statystyka 12, kontrolka 10.
Odstępy komponentów odpowiadają referencji: 3/4/6/8/9/10/12/14/16/20.
Wartości zebrane w scoped theme; lokalne geometrie wykresu/siatki wynikają
z różnych ról. Nie dodano końcowego arkusza z nadpisywaniem selektorów.
Kolumna opłaconych odwołań ma wagę 1.3, aby nagłówek mieścił się w dwóch
wierszach także na 320 px. Zweryfikowano dodatkowo końcowy pakiet wydania.

- Zachowano istniejący nagłówek i dolną nawigację rzeczywistej aplikacji.
  Ramka telefonu i napis „dane przykładowe” należą wyłącznie do demonstracji.
- Desktop ma czytelny kontener do 768 px zamiast sztucznej ramki 460 px.
- Etykiety referencji 11 px podniesiono do 12 px, cele strzałek pozostają
  44 px również na 320 px; mockup zmniejszał je tam do 34 px.
- Funkcje Grafiku rozszerzone późniejszymi ustaleniami użytkownika pozostają:
  pełne godziny, pytania, chronione przerwy, ustawienia, zapisane raporty.
- Liczby z API, rozróżnienie niepełnych miesięcy i istniejąca metoda sezonowa
  zastępują sztuczne dane demonstracji. Brak automatycznych zmian kalendarza.

## Stany i dowody

Testy: oba motywy, 320/390/768/1024/1366/1440 i reflow 200%; rozwijanie
Enter/Space, Escape i powrót focusu selektora, miesiąc wstecz/wprzód,
wybór lat, tabela roczna, stany braku danych, błędy odczytu i zapisu,
konflikt ustawień, ponowienie bez duplikatu. Axe w każdym zapisanym stanie,
overflow, ukryty focus, obrazy i błędy JS. API przechwycone syntetycznie.
Żaden test nie zapisuje danych rzeczywistego trenera.

Niezależna recenzja potwierdziła strukturę Podsumowania na 320/390/1024,
oba motywy. Zgłoszone P2: zera zamiast braku danych i etykieta scenariusza
przychodowego zostały poprawione. Końcowy render tych poprawek ma osobną macierz.
Wynik końcowy i dokładny zakres artefaktów: UI_2.1.22_2026-10-04.json.
