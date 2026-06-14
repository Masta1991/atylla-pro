-- ═══════════════════════════════════════════════════════════════════════════
-- ATYLLA PRO — Seed Data for NEW Trainers
-- ═══════════════════════════════════════════════════════════════════════════
-- This seed is applied automatically on first login of a new trainer.
-- It creates a minimal starting set: 3 workout types, 4 muscle groups,
-- 16 exercises (4 per group). All other tables start empty.
-- ═══════════════════════════════════════════════════════════════════════════
-- Usage from backend: pass the trainer's UUID as %(trainer_id)s

-- Workout types
INSERT INTO workout_types (name, trainer_id) VALUES
    ('Push', %(trainer_id)s),
    ('Pull', %(trainer_id)s),
    ('FBW',  %(trainer_id)s);

-- Muscle groups
INSERT INTO muscle_groups (name, trainer_id) VALUES
    ('KLATKA PIERSIOWA', %(trainer_id)s),
    ('PLECY',            %(trainer_id)s),
    ('NOGI',             %(trainer_id)s),
    ('BARKI',            %(trainer_id)s);

-- Exercises — KLATKA PIERSIOWA
WITH chest AS (SELECT id FROM muscle_groups WHERE name = 'KLATKA PIERSIOWA' AND trainer_id = %(trainer_id)s)
INSERT INTO exercises (muscle_group_id, name, trainer_id)
SELECT chest.id, e, %(trainer_id)s FROM chest, unnest(ARRAY[
    'Wyciskanie sztangi na ławce płaskiej',
    'Wyciskanie sztangielek na ławce płaskiej',
    'Rozpiętki ze sztangielkami',
    'Pompki'
]) AS e;

-- Exercises — PLECY
WITH back AS (SELECT id FROM muscle_groups WHERE name = 'PLECY' AND trainer_id = %(trainer_id)s)
INSERT INTO exercises (muscle_group_id, name, trainer_id)
SELECT back.id, e, %(trainer_id)s FROM back, unnest(ARRAY[
    'Martwy ciąg',
    'Podciąganie na drążku',
    'Wiosłowanie sztangą',
    'Ściąganie drążka wyciągu górnego'
]) AS e;

-- Exercises — NOGI
WITH legs AS (SELECT id FROM muscle_groups WHERE name = 'NOGI' AND trainer_id = %(trainer_id)s)
INSERT INTO exercises (muscle_group_id, name, trainer_id)
SELECT legs.id, e, %(trainer_id)s FROM legs, unnest(ARRAY[
    'Przysiady ze sztangą',
    'Prostowanie nóg na maszynie',
    'Uginanie nóg na maszynie',
    'Wykroki ze sztangielkami'
]) AS e;

-- Exercises — BARKI
WITH shoulders AS (SELECT id FROM muscle_groups WHERE name = 'BARKI' AND trainer_id = %(trainer_id)s)
INSERT INTO exercises (muscle_group_id, name, trainer_id)
SELECT shoulders.id, e, %(trainer_id)s FROM shoulders, unnest(ARRAY[
    'Wyciskanie sztangi nad głowę',
    'Wyciskanie sztangielek siedząc',
    'Unoszenie sztangielek bokiem',
    'Arnoldki'
]) AS e;
