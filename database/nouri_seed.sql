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

UPDATE foods
SET serving_options = CASE name
  WHEN 'banana' THEN '[{"id":"small","label":"1 small banana","grams":101},{"id":"medium","label":"1 medium banana","grams":118},{"id":"large","label":"1 large banana","grams":136},{"id":"cup-sliced","label":"1 cup sliced","grams":150}]'::jsonb
  WHEN 'tomato' THEN '[{"id":"small","label":"1 small tomato","grams":91},{"id":"medium","label":"1 medium tomato","grams":123},{"id":"large","label":"1 large tomato","grams":182},{"id":"cup-chopped","label":"1 cup chopped","grams":180}]'::jsonb
  WHEN 'white rice' THEN '[{"id":"half-cup","label":"1/2 cup cooked","grams":79},{"id":"cup","label":"1 cup cooked","grams":158},{"id":"grams-100","label":"100 g","grams":100}]'::jsonb
  WHEN 'black coffee' THEN '[{"id":"cup","label":"1 cup (8 fl oz)","grams":237},{"id":"small-mug","label":"Small mug (10 fl oz)","grams":296},{"id":"large-mug","label":"Large mug (12 fl oz)","grams":355}]'::jsonb
  ELSE serving_options
END
WHERE source = 'demo';

-- ---------------------------------------------
-- NUTRIENTS (approximate values per 100 g for local fallback foods)
-- ---------------------------------------------
INSERT INTO food_nutrients (
  food_id, calories_kcal, protein_g, carbs_g, fat_g,
  sodium_mg, potassium_mg, phosphorus_mg,
  fiber_g, total_sugars_g, added_sugars_g, saturated_fat_g,
  cholesterol_mg, calcium_mg, iron_mg, vitamin_d_mcg,
  acidic
)
SELECT f.id,
  CASE f.name
    WHEN 'banana' THEN 89
    WHEN 'tomato' THEN 18
    WHEN 'white rice' THEN 130
    WHEN 'black coffee' THEN 1
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 1.09
    WHEN 'tomato' THEN 0.88
    WHEN 'white rice' THEN 2.69
    WHEN 'black coffee' THEN 0.12
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 22.84
    WHEN 'tomato' THEN 3.89
    WHEN 'white rice' THEN 28.17
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 0.33
    WHEN 'tomato' THEN 0.2
    WHEN 'white rice' THEN 0.28
    WHEN 'black coffee' THEN 0.02
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 1
    WHEN 'tomato' THEN 5
    WHEN 'white rice' THEN 1
    WHEN 'black coffee' THEN 2
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 358
    WHEN 'tomato' THEN 237
    WHEN 'white rice' THEN 35
    WHEN 'black coffee' THEN 49
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 22
    WHEN 'tomato' THEN 24
    WHEN 'white rice' THEN 43
    WHEN 'black coffee' THEN 3
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 2.6
    WHEN 'tomato' THEN 1.2
    WHEN 'white rice' THEN 0.4
    WHEN 'black coffee' THEN 0
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 12.23
    WHEN 'tomato' THEN 2.63
    WHEN 'white rice' THEN 0.05
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
    WHEN 'banana' THEN 0.112
    WHEN 'tomato' THEN 0.028
    WHEN 'white rice' THEN 0.077
    WHEN 'black coffee' THEN 0.002
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
    WHEN 'banana' THEN 5
    WHEN 'tomato' THEN 10
    WHEN 'white rice' THEN 10
    WHEN 'black coffee' THEN 2
    ELSE NULL
  END,
  CASE f.name
    WHEN 'banana' THEN 0.26
    WHEN 'tomato' THEN 0.27
    WHEN 'white rice' THEN 0.2
    WHEN 'black coffee' THEN 0.01
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
    WHEN 'tomato' THEN TRUE
    WHEN 'black coffee' THEN TRUE
    ELSE FALSE
  END
FROM foods f
ON CONFLICT (food_id) DO UPDATE SET
  calories_kcal = EXCLUDED.calories_kcal,
  protein_g = EXCLUDED.protein_g,
  carbs_g = EXCLUDED.carbs_g,
  fat_g = EXCLUDED.fat_g,
  sodium_mg = EXCLUDED.sodium_mg,
  potassium_mg = EXCLUDED.potassium_mg,
  phosphorus_mg = EXCLUDED.phosphorus_mg,
  fiber_g = EXCLUDED.fiber_g,
  total_sugars_g = EXCLUDED.total_sugars_g,
  added_sugars_g = EXCLUDED.added_sugars_g,
  saturated_fat_g = EXCLUDED.saturated_fat_g,
  cholesterol_mg = EXCLUDED.cholesterol_mg,
  calcium_mg = EXCLUDED.calcium_mg,
  iron_mg = EXCLUDED.iron_mg,
  vitamin_d_mcg = EXCLUDED.vitamin_d_mcg,
  acidic = EXCLUDED.acidic,
  updated_at = NOW();

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
