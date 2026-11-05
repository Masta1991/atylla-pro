# Najnowszy backup Atylli

Na polecenie użytkownika projekt ma jeden lokalny backup w backup/latest.zip.dpapi.
Manifest: backup/latest-manifest.json; potwierdzenie szyfrowania:
backup/latest.zip.dpapi.json. Folder backup jest ignorowany przez Git.

Kopia obejmuje bieżące pliki aplikacji, dokumenty, konfigurację lokalną, pełną .git
z indeksem/stashem i potrzebne outputy. Wyłączone: backup, node_modules, .venv,
venv, __pycache__ oraz pliki logów aktywnych procesów. Zależności odtwórz według
manifestów aplikacji. ZIP i każdy wpis przechodzą kontrolę SHA-256.

Kopia zawiera lokalne sekrety i historię: szyfrowanie Windows DPAPI CurrentUser,
z odtworzeniem wymagającym tego samego profilu Windows. Przed migracją komputera
przygotuj przenośną zaszyfrowaną kopię z obecnego profilu.
Nie wysyłaj archiwum do chmury bez zgody.

Odzyskuj do pustego katalogu: odszyfruj ProtectedData.Unprotect w swoim profilu,
porównaj SHA-256 ZIP z manifestem, rozpakuj i sprawdź każdy wpis. Nie nadpisuj
bieżącego drzewa ani .git. Instrukcja pomocnicza znajduje się w raporcie
C:/Projects/.agents/reports/atylla-root-cleanup-20260915/README.md.

Nową kopię przygotuj do pliku tymczasowego i zweryfikuj przed zastąpieniem latest.
Dopiero potem usuń poprzednią kopię; w projekcie pozostaje jedna generacja.
Nie twórz kolejnych katalogów backup-pre-fix ani kopii wewnątrz backend/frontendu.

Ta kopia plików NIE jest aktualnym zrzutem zdalnej bazy Supabase.
Przed destrukcyjną migracją wymagany osobny aktualny zrzut bazy, sprawdzenie
odtworzenia i właściwa zgoda. Dawne zrzuty nie dowodzą bieżącego stanu bazy.
