// backend/src/foodsRepo.ts
import { pool } from "./database";

export type FoodRow = {
  food_id: number; // foods.id (SERIAL) in the DB
  name: string;
  brand: string | null;
  source: string;
  fdc_id: number | null;
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
  added_sugars_g: number | null;
  saturated_fat_g: number | null;

  acidic: boolean | null;
};

export async function findCachedFoodsByName(q: string) {
  const r = await pool.query<FoodRow>(
    `SELECT id AS food_id, name, brand, source, fdc_id
     FROM foods
     WHERE lower(name) LIKE '%' || lower($1) || '%'
     ORDER BY name
     LIMIT 20`,
    [q]
  );
  return r.rows;
}

export async function findFoodByFdcId(fdcId: number) {
  const r = await pool.query<FoodRow>(
    `SELECT id AS food_id, name, brand, source, fdc_id
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
}) {
  const { name, brand, fdcId } = params;

  const r = await pool.query<FoodRow>(
    `INSERT INTO foods (name, brand, source, fdc_id)
     VALUES ($1, $2, 'fdc', $3)
     ON CONFLICT (fdc_id) DO UPDATE
       SET name = EXCLUDED.name,
           brand = EXCLUDED.brand
     RETURNING id AS food_id, name, brand, source, fdc_id`,
    [name, brand ?? null, fdcId]
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
    added_sugars_g,
    saturated_fat_g,
    acidic,
  } = nutrients;

  await pool.query(
    `INSERT INTO food_nutrients
      (food_id, calories_kcal, protein_g, carbs_g, fat_g,
       sodium_mg, potassium_mg, phosphorus_mg,
       fiber_g, added_sugars_g, saturated_fat_g, acidic, updated_at)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (food_id) DO UPDATE
       SET calories_kcal = EXCLUDED.calories_kcal,
           protein_g = EXCLUDED.protein_g,
           carbs_g = EXCLUDED.carbs_g,
           fat_g = EXCLUDED.fat_g,
           sodium_mg = EXCLUDED.sodium_mg,
           potassium_mg = EXCLUDED.potassium_mg,
           phosphorus_mg = EXCLUDED.phosphorus_mg,
           fiber_g = EXCLUDED.fiber_g,
           added_sugars_g = EXCLUDED.added_sugars_g,
           saturated_fat_g = EXCLUDED.saturated_fat_g,
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
      added_sugars_g ?? null,
      saturated_fat_g ?? null,
      acidic ?? null,
    ]
  );
}

export async function getFoodWithNutrients(foodId: string | number) {
  const r = await pool.query<FoodWithNutrientsRow>(
    `SELECT f.id AS food_id, f.name, f.brand, f.source, f.fdc_id,
            n.calories_kcal, n.protein_g, n.carbs_g, n.fat_g,
            n.sodium_mg, n.potassium_mg, n.phosphorus_mg,
            n.fiber_g, n.added_sugars_g, n.saturated_fat_g,
            n.acidic
     FROM foods f
     LEFT JOIN food_nutrients n ON n.food_id = f.id
     WHERE f.id = $1
     LIMIT 1`,
    [foodId]
  );

  return r.rows[0] ?? null;
}
