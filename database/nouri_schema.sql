-- nouri_schema.sql
BEGIN;

-- ---------------------------------------------
-- USERS (device-independent, DB-backed accounts)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  -- keep email optional (future proof)
  email TEXT,
  username TEXT UNIQUE,
  name TEXT,
  doctor_recommendations TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If your older schema had users(email, password_hash) only, this upgrades it safely.
-- (These will no-op if the column already exists.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_recommendations TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Make username unique if it exists (safe attempt)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'users_username_key'
  ) THEN
    -- This will fail only if there are duplicate usernames already.
    -- In a fresh DB this is fine.
    BEGIN
      CREATE UNIQUE INDEX users_username_key ON users(username);
    EXCEPTION WHEN others THEN
      -- ignore if it can't be created due to legacy data
      NULL;
    END;
  END IF;
END $$;

-- ---------------------------------------------
-- FOODS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  fdc_id BIGINT UNIQUE,
  source TEXT NOT NULL DEFAULT 'demo',
  data_type TEXT,
  serving_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE foods ADD COLUMN IF NOT EXISTS data_type TEXT;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS serving_options JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Helpful for cached search
CREATE INDEX IF NOT EXISTS foods_name_idx ON foods (name);

-- ---------------------------------------------
-- FOOD NUTRIENTS (one row per food)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS food_nutrients (
  food_id INTEGER PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,

  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,

  sodium_mg NUMERIC,
  potassium_mg NUMERIC,
  phosphorus_mg NUMERIC,

  fiber_g NUMERIC,
  total_sugars_g NUMERIC,
  added_sugars_g NUMERIC,
  saturated_fat_g NUMERIC,
  cholesterol_mg NUMERIC,
  calcium_mg NUMERIC,
  iron_mg NUMERIC,
  vitamin_d_mcg NUMERIC,

  acidic BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe upgrades for databases created before the expanded nutrition panel.
ALTER TABLE food_nutrients ADD COLUMN IF NOT EXISTS total_sugars_g NUMERIC;
ALTER TABLE food_nutrients ADD COLUMN IF NOT EXISTS cholesterol_mg NUMERIC;
ALTER TABLE food_nutrients ADD COLUMN IF NOT EXISTS calcium_mg NUMERIC;
ALTER TABLE food_nutrients ADD COLUMN IF NOT EXISTS iron_mg NUMERIC;
ALTER TABLE food_nutrients ADD COLUMN IF NOT EXISTS vitamin_d_mcg NUMERIC;

-- ---------------------------------------------
-- USER CONDITIONS + SETTINGS (per condition)
-- Stores "selected conditions" and condition-specific settings
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS user_conditions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_id TEXT NOT NULL,

  -- optional per-condition settings
  kidney_stage INTEGER,
  kidney_limit_potassium BOOLEAN,
  kidney_limit_phosphorus BOOLEAN,
  crohns_state TEXT,
  ibs_mode TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, condition_id)
);

ALTER TABLE user_conditions ADD COLUMN IF NOT EXISTS kidney_limit_potassium BOOLEAN;
ALTER TABLE user_conditions ADD COLUMN IF NOT EXISTS kidney_limit_phosphorus BOOLEAN;

CREATE INDEX IF NOT EXISTS user_conditions_user_idx ON user_conditions(user_id);

-- ---------------------------------------------
-- USER FOOD FEEDBACK (for overrides / "past choices")
-- per user + food + condition: safe/trigger + note
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS user_food_feedback (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  condition_id TEXT NOT NULL,

  feedback TEXT NOT NULL CHECK (feedback IN ('safe','trigger')),
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, food_id, condition_id)
);

CREATE INDEX IF NOT EXISTS user_food_feedback_user_idx ON user_food_feedback(user_id);
CREATE INDEX IF NOT EXISTS user_food_feedback_food_idx ON user_food_feedback(food_id);

COMMIT;
