# Polityka Kopii Zapasowych — Atylla Pro

## Zasady Tworzenia Kopii
1. Przed destrukcyjnymi migracjami schematu bazy danych Supabase wykonaj zrzut tabel (`pg_dump` lub skrypt `dump_db.py`).
2. Po wykonaniu backupu zapisz jego hash, datę i zakres w `BACKUP_MANIFEST.md`.
3. Kopie danych wrażliwych muszą być szyfrowane i nie mogą trafiać do repozytorium git.
