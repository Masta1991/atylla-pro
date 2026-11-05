# Agent — atylla-pro

## Start i zakres

Najpierw `CONTEXT_MAP.md`, następnie tylko dokumenty pasujące do zadania.
`docs/project/PROJECT.md` służy architekturze; handoff kontynuacji; historia wyjaśnia wcześniejsze
decyzje. Nie ładuj całych logów, wszystkich skilli ani wszystkich rules.
Jeżeli istnieje `.agents/rules/INDEX.md`, wybierz reguły przez Activation i Scope.
Nowsza jawna decyzja użytkownika zastępuje starszą dokumentację.

## Zasady domenowe

- Aplikacja trenera: FastAPI + Expo/PWA + Supabase. Obliczenia pakietów wynikają
  z chronologii i trwałych faktów; nie twórz drugiego źródła liczników.
- Zachowaj kotwice pakietów, rozróżnienie completed/cancelled/planned i wygląd UI.
- Zapisy testowe tylko na koncie `staws22-1@gmail.com` w potwierdzonym środowisku
  testowym; dane rzeczywistych trenerów są wyłączone z testów zapisów.
- Przed edycją sprawdź także stash; nie wykonuj pop/reset ani automatycznego przenoszenia.
- Dla kodu zastosuj projektowe wersjonowanie; dokumentacja nie podbija wersji aplikacji.
- Przed wydaniem sprawdź wersję, adres API, migracje i test awarii/rollbacku;
  lokalny PASS nie oznacza potwierdzonego Supabase ani gotowej produkcji.

## Realizacja i pamięć

- Przed edycją sprawdź stan Git, jeśli projekt ma repozytorium, i zachowaj cudze zmiany.
- Dopasuj skill do rzeczywistego zadania; testuj zmienione zachowanie, także błąd wejścia.
- Dane pozostają w zatwierdzonym zakresie. Nowa chmura, publikacja, tunel lub koszt
  cykliczny wymagają odpowiedniej zgody; zastana konfiguracja nie rozszerza zgody.
- Backup przed destrukcją: `backup/latest.zip.dpapi (docs/project/BACKUP_POLICY.md)`; sprawdź hash
  i możliwość odtworzenia. Nie usuwaj źródeł tylko dlatego, że wyglądają na duplikat.
- Zakończ zatwierdzony zakres proporcjonalną weryfikacją. Rozróżniaj PASS, FAIL
  i NOT_TESTED oraz test lokalny, odbiór urządzenia i wdrożenie.
- Handoff aktualizuj po zmianie stanu: cel, wynik, dowód, blokery i dokładnie jeden
  następny krok. Celuj w 50–100 linii, wcześniej zabezpieczając pełną historię.
- Powtarzalną lekcję wpisz w jedno właściwe miejsce; nie kopiuj historii do instrukcji.
  Zwykłe zamknięcie sesji nie synchronizuje LLM-WIKI.

Ten katalog jest kanoniczną Atyllą; sandbox 2.0 usunięto 2026-09-15.
Porządek folderu opisuje README.md. Część .tmp jest aktywną zależnością testów.

## Stały układ folderu

Root: tylko README, AGENTS, CONTEXT_MAP i konfiguracja uruchomienia/Git.
Bieżący handoff i plan: docs/project. Narzędzia: scripts. Nowe raporty sesji nie
trafiają do root. Nie odtwarzaj usuniętych LOG.md, FILE_LAYOUT.md i deploy.ps1.
W backup utrzymuj jeden latest: wymiana dopiero po sprawdzeniu kompletności,
szyfrowania i odtworzenia nowej kopii. Nie usuwaj aktywnego buildu, zależności
testów, danych ani nierozstrzygniętych wymagań pod pretekstem porządków.

## Dobór procedury

Przed realizacją wybierz pasujący wiersz [Preferowane procedury](CONTEXT_MAP.md#preferowane-procedury); odczytaj tylko potrzebną procedurę.
