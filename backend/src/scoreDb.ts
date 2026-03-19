// scoreDb.ts
import { pool } from "./database";
import { getPhCategoryForFoodName } from "./PHLocal";

export type ConditionId = "KidneyDisease" | "IC" | "IBS" | "Crohns";
export type Rating = "eat" | "limit" | "avoid";

const ORDER: Rating[] = ["eat", "limit", "avoid"];
const worse = (a: Rating, b: Rating) =>
  ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];

type FoodWithNutrients = {
  food_id: string;
  name: string;
  brand: string | null;
  source: string;
  fdc_id: number | null;

  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  sodium_mg: number | null;
  potassium_mg: number | null;
  phosphorus_mg: number | null;

  fiber_g: number | null;
  saturated_fat_g: number | null;
  added_sugars_g: number | null;

  acidic: boolean;
};

export type ScoreSettings = {
  kidneyStage?: number; // 1-5
  crohnsState?: "stable" | "flare";
  ibsMode?: "general" | "lowFODMAP";
};

export type ScoreResult = {
  rating: Rating;
  reasons: string[];

  // Local pH DB results
  ph_category: string | null;
  ph_note: string | null;
};

const n = (v: number | null) => (typeof v === "number" ? v : 0);

// ------- Kidney / Renal (stage-aware demo thresholds) -------
function scoreKidney(food: FoodWithNutrients, stage?: number) {
  const st = stage ?? 3;
  const reasons: string[] = [];
  let rating: Rating = "eat";

  const k = n(food.potassium_mg);
  const na = n(food.sodium_mg);
  const p = n(food.phosphorus_mg);

  const potassiumAvoid = st >= 4 ? 250 : 400;
  const potassiumLimit = st >= 4 ? 150 : 300;

  if (k >= potassiumAvoid) {
    rating = worse(rating, "avoid");
    reasons.push(`Potassium high (${k} mg) for kidney stage ${st}.`);
  } else if (k >= potassiumLimit) {
    rating = worse(rating, "limit");
    reasons.push(`Potassium moderate (${k} mg) for kidney stage ${st}.`);
  }

  if (na >= 500) {
    rating = worse(rating, "avoid");
    reasons.push(`Sodium high (${na} mg).`);
  } else if (na >= 200) {
    rating = worse(rating, "limit");
    reasons.push(`Sodium moderate (${na} mg).`);
  }

  const phosphorusAvoid = st >= 4 ? 250 : 350;
  const phosphorusLimit = st >= 4 ? 150 : 250;

  if (p >= phosphorusAvoid) {
    rating = worse(rating, "avoid");
    reasons.push(`Phosphorus high (${p} mg) for kidney stage ${st}.`);
  } else if (p >= phosphorusLimit) {
    rating = worse(rating, "limit");
    reasons.push(`Phosphorus moderate (${p} mg) for kidney stage ${st}.`);
  }

  if (reasons.length === 0) {
    reasons.push("Kidney: looks acceptable in current demo thresholds.");
  }

  return { rating, reasons };
}

// ------- IC / Bladder -------
function scoreIC(food: FoodWithNutrients) {
  if (food.acidic) {
    return {
      rating: "limit" as Rating,
      reasons: ["Acidic flag is true; common IC trigger category."],
    };
  }
  return { rating: "eat" as Rating, reasons: ["Not marked acidic in current data."] };
}

// ------- IBS -------
function scoreIBS(_food: FoodWithNutrients, mode?: "general" | "lowFODMAP") {
  if (mode === "lowFODMAP") {
    return {
      rating: "eat" as Rating,
      reasons: ["IBS low-FODMAP mode on (needs FODMAP dataset for strict scoring)."],
    };
  }
  return {
    rating: "eat" as Rating,
    reasons: ["IBS general mode (no special filters applied yet)."],
  };
}

// ------- Crohn’s -------
function scoreCrohns(food: FoodWithNutrients, state?: "stable" | "flare") {
  const st = state ?? "stable";
  const fiber = n(food.fiber_g);

  if (st === "flare") {
    if (fiber >= 5) {
      return {
        rating: "limit" as Rating,
        reasons: [`Flare mode: higher fiber (${fiber} g) may be harder during flares.`],
      };
    }
    return { rating: "eat" as Rating, reasons: [`Flare mode: lower fiber (${fiber} g).`] };
  }

  return { rating: "eat" as Rating, reasons: [`Stable mode: fiber noted (${fiber} g).`] };
}

// ------- User overrides (per user + food + condition) -------
async function getUserOverride(params: {
  userId?: string;
  foodId: string;
  conditionId: ConditionId;
}): Promise<{ feedback: "safe" | "trigger"; note: string | null } | null> {
  const { userId, foodId, conditionId } = params;
  if (!userId) return null;

  const r = await pool.query(
    `SELECT feedback, note
     FROM user_food_feedback
     WHERE user_id = $1
       AND food_id = $2
       AND condition_id = $3
     LIMIT 1`,
    [userId, foodId, conditionId]
  );

  const row = r.rows[0];
  if (!row) return null;

  const fb = String(row.feedback) as "safe" | "trigger";
  if (fb !== "safe" && fb !== "trigger") return null;

  return { feedback: fb, note: row.note ?? null };
}

export async function scoreFoodForConditionsDb(
  food: FoodWithNutrients,
  conditions: ConditionId[],
  settings: ScoreSettings,
  userId?: string
): Promise<ScoreResult> {
  const ph = getPhCategoryForFoodName(food.name);

  if (!conditions || conditions.length === 0) {
    return {
      rating: "eat",
      reasons: ["No conditions selected."],
      ph_category: ph?.ph_category ?? null,
      ph_note: ph?.ph_note ?? null,
    };
  }

  let finalRating: Rating = "eat";
  const finalReasons: string[] = [];

  for (const c of conditions) {
    let result: { rating: Rating; reasons: string[] };

    if (c === "KidneyDisease") result = scoreKidney(food, settings.kidneyStage);
    else if (c === "IC") result = scoreIC(food);
    else if (c === "IBS") result = scoreIBS(food, settings.ibsMode);
    else if (c === "Crohns") result = scoreCrohns(food, settings.crohnsState);
    else result = { rating: "eat", reasons: ["Condition not recognized."] };

    // Apply user override PER CONDITION
    const override = await getUserOverride({ userId, foodId: food.food_id, conditionId: c });
    if (override?.feedback === "trigger") {
      result = {
        rating: "avoid",
        reasons: [
          `You marked this as a TRIGGER for ${c}${override.note ? ` — ${override.note}` : ""}.`,
          ...result.reasons,
        ],
      };
    } else if (override?.feedback === "safe") {
      result = {
        ...result,
        reasons: [
          `You marked this as SAFE for ${c}${override.note ? ` — ${override.note}` : ""}.`,
          ...result.reasons,
        ],
      };
    }

    finalRating = worse(finalRating, result.rating);
    finalReasons.push(`${c}: ${result.reasons.join(" ")}`);
  }

  return {
    rating: finalRating,
    reasons: finalReasons,
    ph_category: ph?.ph_category ?? null,
    ph_note: ph?.ph_note ?? null,
  };
}