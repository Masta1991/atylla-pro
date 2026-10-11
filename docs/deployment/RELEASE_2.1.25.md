# Kandydat 2.1.25 — absencje

Stan 2026-10-11: użytkownik zatwierdził wdrożenie po ponownym audycie.
Powtórna regresja i 14 wariantów przeglądarki PASS; niezależny audyt bez
blockerów. Cztery próby wielu połączeń PostgreSQL 17 PASS. Test zgodności XLSX
pominięty w klonie wykonano w kanonicznym drzewie: PASS (3/3).
Świeżą kopię public/auth odtworzono lokalnie: 46 tabel, 33626 rekordów.
Checkpoint: C:/Projects/Backups/atylla-pro/release-2.1.25-20261011.
Baza: `e9f8574cf22a9cccbe63687e305e4c89e297dbe5` (2.1.24, szuflada).
Izolowany katalog: `.tmp/absences-20261011/release`.
Paczka: `.tmp/absences-20261011/production-build-r3`; skopiowana także do
`backend/static` izolowanego klonu. Adres API jest produkcyjny, budowa z
`expo export --platform web --clear`. Pierwszy katalog `production-build`
odrzucono z powodu zapamiętanego lokalnego adresu API; nie publikować go.
Nie publikować całego kanonicznego drzewa: zawiera inne wcześniejsze prace.

## Zakres

- Przyszłe absencje z harmonogramu bez kafelka, pomijane przy kopiowaniu tygodnia.
- Płatne odwołania istniejących sesji, także partnera; trwałe ID i kotwice.
- Atomowy batch, obowiązkowa kontrola wersji terminu, paginacja i izolacja danych.
- Poprawiony ekran Absencji i wywołanie odwołania z kalendarza.
- Wersja 2.1.25 w API, UI, Expo i obu plikach package.
- Nowa migracja `015_absence_contract.sql`; wymaga istniejących 010 i 011.
  Nowe RPC: record_absence_v4, record_absences_v1, delete_absence_v1.
  Odbiera wykonanie v3 rolom aplikacyjnym; nie przebudowuje danych historycznych.

Raport: `docs/audits/ABSENCES_2.1.25_2026-10-11.md`.
Izolowana regresja PASS: 150/151 Python (1 SKIP XLSX), 51 JS, parser 50, 92 SQL.
Paczka produkcyjna lokalnie PASS w 14 wariantach (84 zrzuty stanów);
API przechwycone syntetycznie, bez połączenia z produkcją.
JS: `index-25348123f980011aed5bdd180aa2b884.js`.
SHA256: `87855f4be547ae4b5d74254c727938c0b029f0ab73b2fe3ccf11ed02f01a14d7`.
Dowody: `.tmp/absences-20261011/release-browser-r3/report.json`,
`candidate-manifest.json` i `release-build-r3.log` w katalogu tej sesji.

## Po uzyskaniu zgody na publikację

1. Potwierdzić aktualny HEAD/wydanie i stan migracji w docelowym środowisku.
   Jeżeli produkcja zmieniła się od bazy, ponownie ocenić diff kandydata.
2. Wykonać i zweryfikować świeży checkpoint kodu oraz bazy; stary backup danych
   z 15.09 i kopia Git nie zastępują backupu aktualnej bazy.
3. Najpierw zainstalować nowe funkcje 015, chwilowo zachowując istniejące
   uprawnienie v3 (stage-migration.sql to dokładna 015 bez jednej instrukcji
   REVOKE dla v3). Opublikować API/PWA 2.1.25. Po potwierdzeniu ich zdrowia
   zastosować pełną 015 i zweryfikować źródła/uprawnienia. Pozwala to uniknąć
   przerwy zapisu w czasie budowania Railway. Stare PWA wymagają przeładowania.
4. Potwierdzić /version, /health i bajtową zgodność paczki. Integrację zapisów
   sprawdzać wyłącznie na dopuszczonym koncie w potwierdzonym środowisku testowym.
   Nie wykonywać próbnych zapisów na kontach trenerów.
5. Zaktualizować raport odbioru i handoff, rozdzielając potwierdzone wdrożenie
   od odbioru na fizycznym telefonie.

## Rollback

Przywrócić zatwierdzony kod i paczkę 2.1.24 oraz uprawnienie starego RPC:

```sql
GRANT EXECUTE ON FUNCTION public.record_absence_v3(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

Pozostawić nowe funkcje i zapisane absencje; nie usuwać danych, nie cofać
rozliczeń. Ten rollback przywraca również ograniczenie 2.1.24: zgłoszenie
absencji bez wydarzenia ponownie nie będzie obsługiwane przez stary interfejs.
Po ponownym wdrożeniu 2.1.25 zastosować 015 jeszcze raz, aby odebrać uprawnienie
v3. Lokalnie sprawdzono grant, wejście do starej funkcji, brak zmian danych
przy jej błędzie, ponowną migrację oraz ponowne zablokowanie starej ścieżki.

Pełny rollback Railway/Supabase i równoległe połączenia bazy: NOT_TESTED.
