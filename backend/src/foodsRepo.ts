// backend/src/foodsRepo.ts
import { pool } from "./database";

export type FoodRow = {
  food_id: number; // foods.id (SERIAL) in the DB
  name: string;
  brand: string | null;
  source: string;
  fdc_id: number | null;
  data_type: string | null;
  serving_options: ServingOption[];
};

export type ServingOption = {
  id: string;
  label: string;
  grams: number;
};

export type FoodWithNutrientsRow = FoodRow & {
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  sodium_mg: number | null;
  potassium_mg: number | null;
  phosphorus_mg: number | null;

  fiber_g: number | null;
  total_sugars_g: number | null;
  added_sugars_g: number | null;
  saturated_fat_g: number | null;
  cholesterol_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  vitamin_d_mcg: number | null;

  acidic: boolean | null;
};

export async function findCachedFoodsByName(q: string) {
  const r = await pool.query<FoodRow>(
    `SELECT id AS food_id, name, brand, source, fdc_id, data_type, serving_options
     FROM foods
     WHERE lower(name) LIKE '%' || lower($1) || '%'
     ORDER BY CASE
                WHEN lower(name) = lower($1) THEN 0
                WHEN lower(name) LIKE lower($1) || '%' THEN 1
                ELSE 2
              END,
              CASE WHEN source = 'fdc' THEN 0 ELSE 1 END,
              CASE WHEN brand IS NULL THEN 0 ELSE 1 END,
              name
     LIMIT 8`,
    [q]
  );
  return r.rows;
}

export async function findFoodByFdcId(fdcId: number) {
  const r = await pool.query<FoodRow>(
    `SELECT id AS food_id, name, brand, source, fdc_id, data_type, serving_options
     FROM foods
     WHERE fdc_id = $1
     LIMIT 1`,
    [fdcId]
  );
  return r.rows[0] ?? null;
}

export async function upsertFoodFromFdc(params: {
  name: string;
  brand?: string | null;
  fdcId: number;
  dataType?: string | null;
  servingOptions?: ServingOption[];
}) {
  const { name, brand, fdcId, dataType, servingOptions = [] } = params;

  const r = await pool.query<FoodRow>(
    `INSERT INTO foods (name, brand, source, fdc_id, data_type, serving_options)
     VALUES ($1, $2, 'fdc', $3, $4, $5::jsonb)
     ON CONFLICT (fdc_id) DO UPDATE
       SET name = EXCLUDED.name,
           brand = EXCLUDED.brand,
           data_type = EXCLUDED.data_type,
           serving_options = CASE
             WHEN jsonb_array_length(EXCLUDED.serving_options) > 0 THEN EXCLUDED.serving_options
             ELSE foods.serving_options
           END
     RETURNING id AS food_id, name, brand, source, fdc_id, data_type, serving_options`,
    [name, brand ?? null, fdcId, dataType ?? null, JSON.stringify(servingOptions)]
  );

  return r.rows[0];
}

export async function upsertFoodNutrients(foodId: number, nutrients: any) {
  const {
    calories_kcal,
    protein_g,
    carbs_g,
    fat_g,
    sodium_mg,
    potassium_mg,
    phosphorus_mg,
    fiber_g,
    total_sugars_g,
    added_sugars_g,
    saturated_fat_g,
    cholesterol_mg,
    calcium_mg,
    iron_mg,
    vitamin_d_mcg,
    acidic,
  } = nutrients;

  await pool.query(
    `INSERT INTO food_nutrients
      (food_id, calories_kcal, protein_g, carbs_g, fat_g,
       sodium_mg, potassium_mg, phosphorus_mg,
       fiber_g, total_sugars_g, added_sugars_g, saturated_fat_g,
       cholesterol_mg, calcium_mg, iron_mg, vitamin_d_mcg,
       acidic, updated_at)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
     ON CONFLICT (food_id) DO UPDATE
       SET calories_kcal = EXCLUDED.calories_kcal,
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
           updated_at = now()`,
    [
      foodId,
      calories_kcal ?? null,
      protein_g ?? null,
      carbs_g ?? null,
      fat_g ?? null,
      sodium_mg ?? null,
      potassium_mg ?? null,
      phosphorus_mg ?? null,
      fiber_g ?? null,
      total_sugars_g ?? null,
      added_sugars_g ?? null,
      saturated_fat_g ?? null,
      cholesterol_mg ?? null,
      calcium_mg ?? null,
      iron_mg ?? null,
      vitamin_d_mcg ?? null,
      acidic ?? null,
    ]
  );
}

export async function getFoodWithNutrients(foodId: string | number) {
  const r = await pool.query<FoodWithNutrientsRow>(
    `SELECT f.id AS food_id, f.name, f.brand, f.source, f.fdc_id,
            f.data_type, f.serving_options,
            n.calories_kcal::float8 AS calories_kcal,
            n.protein_g::float8 AS protein_g,
            n.carbs_g::float8 AS carbs_g,
            n.fat_g::float8 AS fat_g,
            n.sodium_mg::float8 AS sodium_mg,
            n.potassium_mg::float8 AS potassium_mg,
            n.phosphorus_mg::float8 AS phosphorus_mg,
            n.fiber_g::float8 AS fiber_g,
            n.total_sugars_g::float8 AS total_sugars_g,
            n.added_sugars_g::float8 AS added_sugars_g,
            n.saturated_fat_g::float8 AS saturated_fat_g,
            n.cholesterol_mg::float8 AS cholesterol_mg,
            n.calcium_mg::float8 AS calcium_mg,
            n.iron_mg::float8 AS iron_mg,
            n.vitamin_d_mcg::float8 AS vitamin_d_mcg,
            n.acidic
     FROM foods f
     LEFT JOIN food_nutrients n ON n.food_id = f.id
     WHERE f.id = $1
     LIMIT 1`,
    [foodId]
  );

  return r.rows[0] ?? null;
}
