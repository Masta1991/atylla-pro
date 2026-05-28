# Backup v1.0.20 — Opis Stanu i Instrukcja Przywrócenia

## Metadane Kopii Zapasowej
* **Wersja:** `v1.0.20`
* **Data utworzenia kopii:** 2026-05-28
* **Baza danych:** Supabase PostgreSQL (11 tabel)
* **Środowisko uruchomieniowe:** Expo SDK 56 + React 19 + FastAPI (Python 3.12)

---

## Szczegółowy Opis Kluczowych Elementów UI i Stylizacji (do 100% odtworzenia)

Kluczowe style graficzne, na które należy zwrócić szczególną uwagę przy ewentualnym ręcznym odtwarzaniu lub debugowaniu:

### 1. Górny Wiersz Kalendarza (Dni i Daty)
Etykiety dni (Pon-Sob) i numerów dni miesiąca znajdują się w pliku [CalendarScreen.js](file:///c:/Projects/atylla-pro/frontend/src/screens/CalendarScreen.js):
* **Kontener wiersza (`headerRow`):** 
  - `height: 56` (wysokość komórek).
  - `backgroundColor: TC.background` (dopasowuje się do trybu jasnego/ciemnego).
  - `borderBottomWidth: 2` i `borderColor: TC.border`.
* **Komórka dnia (`dayCell`):**
  - `alignItems: 'center'`, `justifyContent: 'center'`.
  - `borderRightWidth: 1`, `borderColor: TC.border`.
* **Dzień dzisiejszy (`todayCell`):**
  - Wyróżniony jasnym tłem akcentu: `backgroundColor: accent + '1a'` (10% przezroczystości koloru akcentu).
* **Formatowanie czcionek:**
  - Nazwa dnia (`dayText`): `color: TC.textSecondary`, rozmiar `11`, grubość `600`.
  - Numer dnia (`dayNum`): `color: TC.textSecondary`, rozmiar `14`, grubość `700`, margines górny `2`.
  - W przypadku dzisiejszego dnia kolory tekstu zmieniają się na `accent` (akcent motywu).

### 2. Pierwsza Kolumna z Godzinami (6:00 — 21:00)
Znajduje się w pliku [CalendarScreen.js](file:///c:/Projects/atylla-pro/frontend/src/screens/CalendarScreen.js):
* **Wymiary komórki godziny (`hourCell`):**
  - Szerokość: `50` (stała szerokość kolumny godzin).
  - Wysokość: `56` (musi być identyczna jak wysokość komórek siatki).
* **Borders i background:**
  - `borderRightWidth: 1`, `borderBottomWidth: 1`.
  - `borderColor: TC.border`, `backgroundColor: TC.background`.
* **Tekst godziny (`hourText`):**
  - `color: TC.textSecondary`, rozmiar czcionki `10`.

### 3. Przycisk Główny (GŁÓWNA) z Wyraźnie Ciemniejszym Polem
Przycisk powrotu do kalendarza na dolnym pasku nawigacyjnym (wspólny dla [CalendarScreen.js](file:///c:/Projects/atylla-pro/frontend/src/screens/CalendarScreen.js) oraz [AppLayout.js](file:///c:/Projects/atylla-pro/frontend/src/components/AppLayout.js)):
* **Zewnętrzny okrąg przycisku (`homeButton`):**
  - `width: 70`, `height: 70`, `borderRadius: 35`.
  - Obramowanie: `borderWidth: 2`, `borderColor: C.accent`.
  - Tło: **zawsze czarne** (`backgroundColor: '#000000'`).
  - Cień: `shadowColor: '#000'`, `shadowOpacity: 0.5`, `shadowRadius: 10`, `elevation: 10`.
* **Wewnętrzny kontener ikony psa:**
  - `width: 66`, `height: 66`, `borderRadius: 33`.
  - Tło: **wyraźnie ciemniejsze/czarne** w trybie ciemnym (`#000000`) oraz białe w trybie jasnym (`#FFFFFF` dla kontrastu).
  - Kolor ikony psa (`tintColor`): kolor akcentu motywu `C.accent` w trybie ciemnym, oraz czarny `#000000` w trybie jasnym.

### 4. Styl Glossy Glass (Efekt Szkła)
* **Zaimplementowany w:** [AppLayout.js](file:///c:/Projects/atylla-pro/frontend/src/components/AppLayout.js) oraz [CalendarScreen.js](file:///c:/Projects/atylla-pro/frontend/src/screens/CalendarScreen.js).
* **Nagłówek (Top Bar):**
  - Renderowany za pomocą SVG `<LinearGradient>` o kącie ukośnym (stops od góry-prawej do dołu-lewej).
  - Dodatkowo na platformie Web stosowany jest CSS: `backdropFilter: 'blur(20px)'`.
  - Cienie dolne i brak obramowań bocznych dają pełne pokrycie krawędzi ekranu.
  - W trybie jasnym: delikatny mleczno-błękitny gradient (`rgba(255,255,255,0.9)` -> `rgba(235,240,250,0.85)`).
  - W trybie ciemnym: ciemny szklany gradient (`rgba(255,255,255,0.25)` -> `rgba(30,30,35,0.85)`).
* **Stopka (Bottom Bar):**
  - Kształt wycięty za pomocą ścieżki SVG `<Path>` dopasowanej do przycisku głównego.
  - Wypełnienie gradientem o mniejszej przezroczystości, aby dolne przyciski były doskonale czytelne.

### 5. Tryb Jasny i Ciemny
* Zarządzany globalnie przez kontekst [ThemeContext.js](file:///c:/Projects/atylla-pro/frontend/src/context/ThemeContext.js).
* Palety kolorów zdefiniowane w `LIGHT_COLORS` i `DARK_COLORS` (struktura z kluczami: `background`, `surface`, `surfaceLight`, `border`, `text`, `textSecondary`, `textMuted`, `danger`, `success`, `warning`).

---

## Zmiany Wprowadzone w Wersji v1.0.20
1. **Dynamiczne SVG IDs:** Zapobiegnięto konfliktom identyfikatorów gradientów SVG w zagnieżdżonych widokach formularzy poprzez dodanie generowanego losowo sufiksu (np. `headerGlassApp_${uniqueId}`).
2. **Naprawa Rejestru Treningów (`TrainingScreen.js`):**
   - Selektor głównej partii mięśniowej poprawnie mapuje obiekty z Supabase na ciągi znaków `mg.name`.
   - Zaimplementowano brakującą funkcję API `saveCalendarWorkout` w [api.js](file:///c:/Projects/atylla-pro/frontend/src/services/api.js) (tworzy wpis w kalendarzu oraz zapisuje listę ćwiczeń w bazie danych).
3. **Kolor Czcionki Daty:** Zmieniono kolor etykiety daty (dnia i miesiąca) oraz powiązanego chevronu w top barze na kolor akcentu aktywnego motywu (`C.accent`) również w trybie ciemnym.

---

## Instrukcja Pełnego Przywrócenia (100% Odtworzenia Stanu)

W przypadku chęci cofnięcia się do tej wersji, wykonaj poniższe kroki w terminalu:

### Krok 1: Przywrócenie głównego repozytorium (Backend + Konfiguracja)
```bash
# 1. Sklonuj archiwum backendu do nowego katalogu
git clone "backup/backup v.20/atylla-pro-backup-v1.0.20.bundle" atylla-pro-restore

# 2. Wejdź do utworzonego katalogu
cd atylla-pro-restore
```

### Krok 2: Przywrócenie subrepozytorium frontendu (Frontend źródłowy)
```bash
# 1. Przejdź do katalogu frontendu
cd frontend

# 2. Zainicjalizuj czyste repozytorium git
git init

# 3. Dodaj jako zdalne źródło plik bundle frontendu z wersji v1.0.20
git remote add origin "../../backup/backup v.20/atylla-pro-frontend-backup-v1.0.20.bundle"

# 4. Pobierz historię i zatwierdź gałąź master
git fetch origin
git checkout master
```

### Krok 3: Instalacja zależności i uruchomienie lokalne
* **Backend:** `pip install -r requirements.txt` oraz `uvicorn main:app --reload` w folderze `backend`.
* **Frontend:** `npm install` w folderze `frontend` oraz `npm run web` (lub `npx expo start --web`).
