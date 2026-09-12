-- Atylla Pro 2.0 — migracja 004: unikalnosc nazw case-insensitive (per trener).
-- Uruchomic RAZ w Supabase Dashboard → SQL Editor (jako postgres/service_role).
-- Addytywna, idempotentna. Backend od 2.0.1-dev blokuje duplikaty przez ilike;
-- te indeksy sa twarda gwarancja na poziomie bazy (wyscig zapisow).
-- UWAGA: przed uruchomieniem scalic istniejace duplikaty ('Barki' vs 'BARKI')
-- skryptem merge_duplicate_groups.py na koncie testowym — indeks wywali sie
-- na istniejacych duplikatach (i tak ma byc: najpierw cleanup, potem indeks).

create unique index if not exists muscle_groups_trainer_lower_name_uidx
  on muscle_groups (trainer_id, lower(name));

create unique index if not exists workout_types_trainer_lower_name_uidx
  on workout_types (trainer_id, lower(name));

create unique index if not exists training_plans_trainer_lower_name_uidx
  on training_plans (trainer_id, lower(name));

create unique index if not exists exercises_group_lower_name_uidx
  on exercises (muscle_group_id, lower(name));

-- Weryfikacja po uruchomieniu:
--   select trainer_id, lower(name), count(*) from muscle_groups
--   group by 1, 2 having count(*) > 1;
-- Oczekiwane: 0 wierszy.
