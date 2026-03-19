-- nouri_seed.sql
BEGIN;

-- ---------------------------------------------
-- DEMO USER (works with username/password login)
-- Password is: demo123
-- Hash format matches index.ts: scrypt$<salt>$<hash>
-- ---------------------------------------------
INSERT INTO users (username, name, password_hash)
VALUES (
  'demo',
  'Demo User',
  'scrypt$5d8f2c9a0e06c0c0b0b15f5e8bdb7b8b$7b79a2c6c1d6c2b8c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6'
)
ON CONFLICT (username) DO NOTHING;

-- Grab demo user id for linking
WITH demo_user AS (
  SELECT id FROM users WHERE username = 'demo' LIMIT 1
)
-- ---------------------------------------------
-- FOODS
-- ---------------------------------------------
INSERT INTO foods (name, brand, source, fdc_id) VALUES
('banana', NULL, 'demo', NULL),
('tomato', NULL, 'demo', NULL),
('white rice', NULL, 'demo', NULL),
('black coffee', NULL, 'demo', NULL)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------
-- NUTRIENTS (very simple demo numbers)
-- ---------------------------------------------
INSERT INTO food_nutrients (
  food_id, calories_kcal, protein_g, carbs_g, fat_g,
  sodium_mg, potassium_mg, phosphorus_mg,
  fiber_g, added_sugars_g, saturated_fat_g,
  acidic
)
SELECT f.id,
  CASE f.name
    WHEN 'banana' THEN 105
    WHEN 'tomato' THEN 22
    WHEN 'white rice' THEN 205
    WHEN 'black coffee' THEN 2
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 1.3
    WHEN 'tomato' THEN 1.1
    WHEN 'white rice' THEN 4.3
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 27
    WHEN 'tomato' THEN 4.8
    WHEN 'white rice' THEN 45
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 0.4
    WHEN 'tomato' THEN 0.2
    WHEN 'white rice' THEN 0.4
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 1
    WHEN 'tomato' THEN 6
    WHEN 'white rice' THEN 2
    WHEN 'black coffee' THEN 5
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 422
    WHEN 'tomato' THEN 292
    WHEN 'white rice' THEN 55
    WHEN 'black coffee' THEN 116
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 26
    WHEN 'tomato' THEN 43
    WHEN 'white rice' THEN 68
    WHEN 'black coffee' THEN 7
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 3.1
    WHEN 'tomato' THEN 1.5
    WHEN 'white rice' THEN 0.6
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 0
    WHEN 'tomato' THEN 0
    WHEN 'white rice' THEN 0
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 0.1
    WHEN 'tomato' THEN 0
    WHEN 'white rice' THEN 0.1
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'tomato' THEN TRUE
    WHEN 'black coffee' THEN TRUE
    ELSE FALSE
  END
FROM foods f
ON CONFLICT (food_id) DO NOTHING;

-- ---------------------------------------------
-- DEMO: Selected conditions/settings for demo user
-- ---------------------------------------------
WITH demo_user AS (
  SELECT id FROM users WHERE username = 'demo' LIMIT 1
)
INSERT INTO user_conditions (user_id, condition_id, kidney_stage, crohns_state, ibs_mode)
SELECT demo_user.id, c.condition_id, c.kidney_stage, c.crohns_state, c.ibs_mode
FROM demo_user,
     (VALUES
       ('KidneyDisease', 3, NULL, NULL),
       ('IC', NULL, NULL, NULL),
       ('IBS', NULL, NULL, 'general')
     ) AS c(condition_id, kidney_stage, crohns_state, ibs_mode)
ON CONFLICT (user_id, condition_id) DO NOTHING;

-- ---------------------------------------------
-- DEMO: Some feedback (past choices)
-- ---------------------------------------------
WITH demo_user AS (
  SELECT id FROM users WHERE username = 'demo' LIMIT 1
),
banana AS (
  SELECT id FROM foods WHERE name = 'banana' LIMIT 1
),
tomato AS (
  SELECT id FROM foods WHERE name = 'tomato' LIMIT 1
)
INSERT INTO user_food_feedback (user_id, food_id, condition_id, feedback, note)
SELECT demo_user.id, banana.id, 'IBS', 'safe', 'Usually fine for me.'
FROM demo_user, banana
ON CONFLICT (user_id, food_id, condition_id) DO NOTHING;

WITH demo_user AS (
  SELECT id FROM users WHERE username = 'demo' LIMIT 1
),
tomato AS (
  SELECT id FROM foods WHERE name = 'tomato' LIMIT 1
)
INSERT INTO user_food_feedback (user_id, food_id, condition_id, feedback, note)
SELECT demo_user.id, tomato.id, 'IC', 'trigger', 'Acidic foods bother me.'
FROM demo_user, tomato
ON CONFLICT (user_id, food_id, condition_id) DO NOTHING;

COMMIT;
