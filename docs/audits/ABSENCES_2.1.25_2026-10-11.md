# Absencje — naprawa i audyt 2.1.25

Stan: poprawka lokalna; nie wdrożono kodu ani migracji do produkcji.
Ponowny audyt przed zatwierdzonym przez użytkownika wdrożeniem: regresja i
14 wariantów Chrome PASS, niezależny recenzent bez nowych blockerów.
Dodatkowe cztery próby wielu połączeń PostgreSQL 17 PASS:
`docs/audits/ABSENCES_CONCURRENCY_2026-10-11.json`. Brakujący w klonie test
porównania XLSX wykonano w kanonicznym drzewie (3/3 PASS).
Późniejsza korekta UI na życzenie użytkownika: przy każdej pozycji listy
pozostawiono wyłącznie datę i godzinę. Usunięto powtarzane opisy rodzaju
terminu i wspólnej sesji. Logika zapisów oraz zabezpieczenia nie zmieniły się.
Data: 2026-10-11. Baza izolowanego kandydata: produkcyjne 2.1.24,
commit `e9f8574cf22a9cccbe63687e305e4c89e297dbe5`.

## Przyczyna i uzgodnione zachowanie

Ekran wyliczał terminy z harmonogramu, a następnie każdy wysyłał jako płatne
odwołanie. RPC v3 wymagał istniejącego wydarzenia. Dla nieskopiowanego tygodnia
powstawał błąd ze zdjęcia: „Brak treningu do odwołania z płatnością”. Odtworzono
go w lokalnym PostgreSQL przed zastosowaniem migracji 015.

Użytkownik doprecyzował, że harmonogram stałych treningów ma wystarczać do
zgłoszenia przyszłej absencji, zanim trener skopiuje tydzień. Nowe rozwiązanie:

- Brak kafelka, termin zgodny z aktualnym harmonogramem: tylko oznaczenie
  absencji, bez tworzenia treningu i naliczania jednostki. Kopiowanie tygodnia
  pomija termin także wtedy, gdy nieobecna osoba jest partnerem treningu.
- Istniejący trening: płatne odwołanie zachowuje ID oraz kotwicę pakietu.
  Wspólny trening odwoływany jest raz, z informacją o obu uczestnikach.
- Usunięcie oznaczenia absencji umożliwia ponowne planowanie terminu, ale samo
  nie przywraca odwołanego treningu ani nie cofa rozliczenia. Dialog to wyjaśnia.
- Zamknięta historia pakietu pozostaje chroniona przez dotychczasowy mechanizm.

## Naprawione ustalenia audytu

| Ustalenie | Korekta i dowód |
|---|---|
| Terminy z harmonogramu bez kafelka kończą się błędem | Tryby schedule/cancel; test SQL pierwotnego błędu i późniejszego poprawnego zapisu |
| Partner treningu i klient bez stałego grafiku są pomijani | Opcje z rzeczywistych wydarzeń obejmują obie pozycje uczestnika; testy API/SQL |
| Kolejne daty mogą zapisać się częściowo | Jeden batch do 30 pozycji, jedna transakcja; błąd cofa wszystkie zmiany |
| Termin może zmienić się po wyświetleniu | Wymagane ID i wersja wydarzenia; zajęty slot odrzuca zgłoszenie z harmonogramu |
| Stary wybór „bez naliczenia” może zostać zachowany po zmianie na trening | UI porównuje typ, ID, wersję i uczestników; konflikt czyści wybór, test przeglądarkowy |
| Stary RPC pozwala ominąć nowy kontrakt | Odebrano wykonanie v3 rolom PUBLIC/anon/authenticated; test negatywny i test rollbacku |
| Powtórzenie żądania lub obie osoby w batchu | Idempotencja; brak drugiego wydarzenia lub drugiej opłaty |
| Odczyt historii może być ucięty limitem bazy | Paginacja, zakres dat i właściciel; test ponad 1000 pozycji i awarii drugiej strony |
| Stare odpowiedzi UI mogą podmienić wybranego klienta | Numer żądania, blokada zapisu i odświeżenie po niepewnym wyniku |
| Niejasne kasowanie, fokus, kontrast błędu w jasnym motywie | Dialog skutków, obsługa klawiatury, przywrócenie fokusu i poprawiony kolor tekstu |
| Pierwsza izolowana kompilacja zachowała lokalny adres API z cache | Odrzucono tę paczkę; ponowny export z --clear ma adres produkcji i nie zawiera lokalnego API |

Niezależny przegląd wskazał lukę zachowanego wyboru po zmianie typu terminu;
po naprawie kontrola statyczna PASS i scenariusz przeglądarkowy PASS. Recenzent
uruchomił 19 pierwotnych testów SQL; końcowy zestaw rozszerzono o rollback.

## Weryfikacja lokalna

- Kanoniczne drzewo: PASS 151 Python/API, 52 JS, parser 51 modułów,
  91 SQL przed dodaniem ostatniego scenariusza rollbacku. Pełny istniejący
  zestaw regresji, w tym pakiety, sesje, kopiowanie, notatki i planowanie.
- Izolowany kandydat: PASS 151 odkrytych testów Python/API (150 wykonanych;
  1 SKIP porównania z lokalnym XLSX, którego nie ma w klonie), 51 JS,
  parser 50 modułów i 92 testy SQL, w tym 20 dla absencji. Różnica JS wynika
  z wyłączenia wcześniejszych, niewydanych zmian opisów Strefy Trenera.
- 14 wariantów Chrome: oba motywy przy szerokości 320/390/768/1024/1366/1440,
  poziomy 844×390 oraz reflow 720×500 przy skali 2. To odpowiednik układu
  przy powiększeniu 200%, nie test natywnego ustawienia zoom przeglądarki.
- 84 zrzuty stanów i 14 podsumowań: wybór, zapis mieszany, usunięcie,
  błędy odczytu/zapisu, niepewny commit, konflikt zmienionego terminu.
  PASS klawiatura, Tab/Shift+Tab/Escape, focus po zamknięciu, disabled/busy,
  zero critical/serious axe w badanych stanach, zero błędów JS i overflow
  dokumentu. Obejrzano plansze wszystkich 14 wariantów.
- API przeglądarkowe jest syntetyczne, inne żądania sieciowe blokowane.
  Zapis SQL wykonano osobno na PGlite z syntetycznymi użytkownikami i RLS.
- Powtórzenie migracji, cofnięcie uprawnień v3 i ponowne zastosowanie 015 PASS;
  ten test nie zastępuje rzeczywistego rollbacku wdrożenia.

Dowody: `.tmp/absence-regression-20261011.json`,
`.tmp/absences-20261011/release-regression.json`,
`.tmp/absences-20261011/browser/report.json`,
`.tmp/absences-20261011/browser/contact-*.jpg`.

## Granice wyniku

NOT_TESTED: bieżąca produkcja, Supabase/PostgREST, rzeczywiste równoległe
połączenia PostgreSQL, fizyczny telefon, aplikacje natywne, VoiceOver/TalkBack.
Nie wykonywano zapisów na rzeczywistych kontach. Audyt obejmuje głęboko
absencje i ich powiązania oraz pełną dostępną regresję aplikacji; nie jest
deklaracją ręcznego sprawdzenia wszystkich ekranów i danych produkcyjnych.

Migracja 015 i skoordynowana publikacja API/PWA wymagają odrębnej zgody.
Procedura i rollback: `docs/deployment/RELEASE_2.1.25.md`.

Pierwszy test izolowanej paczki poprawnie zatrzymał lokalne żądania API
niezgodne z zadanym adresem produkcji. To błąd konfiguracji artefaktu z cache,
usunięty przez czystą kompilację. Nie publikować katalogu `production-build`;
kandydat znajduje się w `production-build-r3`. Końcowy test tej dokładnej
paczki PASS: ponownie 14 wariantów i 84 zrzuty + 14 podsumowań, syntetyczne
API, zero żądań do zewnętrznych usług. Obejrzano dodatkowo wąskie ekrany
obu motywów i reflow 200%. Raport: `release-browser-r3/report.json`.
Paczka skopiowana do `backend/static` izolowanego kandydata; porównanie
bajtowe i manifest: `.tmp/absences-20261011/candidate-manifest.json`.
