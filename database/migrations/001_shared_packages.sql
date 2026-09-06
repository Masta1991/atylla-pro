-- Atylla Pro — pakiety łączone (wspólna pula) + wspólne treningi.
-- Uruchomić RAZ w Supabase Dashboard → SQL Editor (jako postgres/service_role).
-- Idempotentne (IF NOT EXISTS), bezpieczne dla istniejących danych.

-- 1) Pakiet: z kim dzielona pula (owner = client_id wiersza pakietu).
alter table client_packages
  add column if not exists shared_client_ids uuid[] not null default '{}';

-- 2) Rozliczenie miesięczne: z kim dzielony cykl (na wierszu klienta).
alter table clients
  add column if not exists shared_monthly_with uuid[] not null default '{}';

-- 3) Wspólny trening: drugi uczestnik slotu (jeden slot = jeden wiersz).
alter table calendar_events
  add column if not exists partner_client_id uuid;

-- Weryfikacja po uruchomieniu:
--   select column_name from information_schema.columns
--   where table_name in ('client_packages','clients','calendar_events')
--     and column_name in ('shared_client_ids','shared_monthly_with','partner_client_id');
-- Oczekiwane: 3 wiersze.
