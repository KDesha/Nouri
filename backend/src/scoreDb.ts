import { pool } from "./database";
import { assessFoodForIbs, IbsAssessment, IbsMode } from "./ibsData";

export type ConditionId =
  | "KidneyDisease"
  | "IC"
  | "IBS"
  | "Crohns"
  | "GERD"
  | "Diabetes"
  | "Hypertension"
  | "HeartHealth";
export type Rating = "eat" | "limit" | "avoid" | "unknown";
export type Confidence = "low" | "moderate" | "high";

const ORDER: Rating[] = ["eat", "unknown", "limit", "avoid"];
const worse = (a: Rating, b: Rating): Rating =>
  ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];

export type FoodWithNutrients = {
  food_id: string | number;
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
  total_sugars_g?: number | null;
  saturated_fat_g: number | null;
  added_sugars_g: number | null;
  cholesterol_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_d_mcg?: number | null;
  acidic: boolean | null;
};

export type ScoreSettings = {
  // Retained for existing profiles, but never used alone to prescribe nutrient limits.
  kidneyStage?: number;
  kidneyLimitPotassium?: boolean;
  kidneyLimitPhosphorus?: boolean;
  crohnsState?: "stable" | "flare";
  ibsMode?: IbsMode;
};

export type ConditionResult = {
  condition: ConditionId;
  rating: Rating;
  confidence: Confidence;
  reasons: string[];
};

export type ScoreResult = {
  rating: Rating;
  reasons: string[];
  condition_results: ConditionResult[];
  ibs_guidance: IbsAssessment | null;
};

type ConditionScore = Omit<ConditionResult, "condition"> & { ibsGuidance?: IbsAssessment };
type UserOverride = { feedback: "safe" | "trigger"; note: string | null };

const present = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

function rounded(value: number, decimals = 0) {
  return decimals ? value.toFixed(decimals) : String(Math.round(value));
}

/** Scale USDA's per-100-g nutrient values to the amount the person selected. */
export function scaleFoodNutrients(food: FoodWithNutrients, servingGrams: number): FoodWithNutrients {
  const grams = Math.min(2000, Math.max(1, Number(servingGrams) || 100));
  const factor = grams / 100;
  const scale = (value: number | null | undefined) =>
    present(value) ? Math.round(value * factor * 1000) / 1000 : value ?? null;

  return {
    ...food,
    calories_kcal: scale(food.calories_kcal),
    protein_g: scale(food.protein_g),
    carbs_g: scale(food.carbs_g),
    fat_g: scale(food.fat_g),
    sodium_mg: scale(food.sodium_mg),
    potassium_mg: scale(food.potassium_mg),
    phosphorus_mg: scale(food.phosphorus_mg),
    fiber_g: scale(food.fiber_g),
    total_sugars_g: scale(food.total_sugars_g),
    saturated_fat_g: scale(food.saturated_fat_g),
    added_sugars_g: scale(food.added_sugars_g),
    cholesterol_mg: scale(food.cholesterol_mg),
    calcium_mg: scale(food.calcium_mg),
    iron_mg: scale(food.iron_mg),
    vitamin_d_mcg: scale(food.vitamin_d_mcg),
  };
}

function scoreKidney(food: FoodWithNutrients, settings: ScoreSettings): ConditionScore {
  const reasons: string[] = [];
  let rating: Rating = "eat";
  let reported = 0;

  if (present(food.sodium_mg)) {
    reported += 1;
    if (food.sodium_mg >= 460) {
      rating = worse(rating, "limit");
      reasons.push(`Kidney check: ${rounded(food.sodium_mg)} mg sodium is high for this serving (20% or more of the FDA Daily Value).`);
    } else if (food.sodium_mg > 115) {
      rating = worse(rating, "unknown");
      reasons.push(`Kidney check: this serving has ${rounded(food.sodium_mg)} mg sodium; compare it with your daily sodium plan.`);
    } else {
      reasons.push(`Kidney check: this serving is low in sodium (${rounded(food.sodium_mg)} mg, at or below 5% Daily Value).`);
    }
  }

  if (settings.kidneyLimitPotassium) {
    if (present(food.potassium_mg)) {
      reported += 1;
      if (food.potassium_mg >= 200) rating = worse(rating, "limit");
      reasons.push(`Your care-plan setting says to watch potassium; this serving has ${rounded(food.potassium_mg)} mg.`);
    } else {
      rating = worse(rating, "unknown");
      reasons.push("Potassium is missing, so Nouri cannot check it against your care-plan setting.");
    }
  } else if (present(food.potassium_mg)) {
    reasons.push(`Potassium is ${rounded(food.potassium_mg)} mg per serving. Kidney stage alone does not determine whether you should limit it.`);
  }

  if (settings.kidneyLimitPhosphorus) {
    if (present(food.phosphorus_mg)) {
      reported += 1;
      if (food.phosphorus_mg >= 250) rating = worse(rating, "limit");
      else rating = worse(rating, "unknown");
      reasons.push(`Your care-plan setting says to watch phosphorus; this serving has ${rounded(food.phosphorus_mg)} mg${food.phosphorus_mg >= 250 ? ", at least 20% of the FDA Daily Value" : ""}. Natural and added phosphorus are absorbed differently, so compare this with your personal target.`);
    } else {
      rating = worse(rating, "unknown");
      reasons.push("Phosphorus is missing, and nutrition data may not fully reflect highly absorbed phosphate additives.");
    }
  } else if (present(food.phosphorus_mg)) {
    reasons.push(`Phosphorus is ${rounded(food.phosphorus_mg)} mg per serving. Only restrict it if your labs or care team call for that.`);
  }

  if (settings.kidneyStage) {
    reasons.push(`Stage ${settings.kidneyStage} is recorded for context; lab results, medicines, and dialysis status—not stage alone—set potassium, phosphorus, fluid, and protein needs.`);
  }
  if (!reported && !present(food.potassium_mg) && !present(food.phosphorus_mg)) {
    return {
      rating: "unknown",
      confidence: "low",
      reasons: ["Kidney check: sodium, potassium, and phosphorus are missing from the source data."],
    };
  }
  reasons.push("Phosphate additives and preparation methods are not reliably captured without a full ingredient label.");
  return { rating, confidence: reported >= 2 ? "moderate" : "low", reasons };
}

const IC_TRIGGERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(oranges?|grapefruits?|lemons?|limes?|citrus|clementines?|tangerines?)\b/i, label: "citrus" },
  { pattern: /\b(coffee|espresso|tea|cola|soda|energy drinks?|caffeinated)\b/i, label: "coffee, tea, soda, or caffeine" },
  { pattern: /\b(beer|wine|cider|liquor|vodka|whiskey|whisky|rum|alcohol)\b/i, label: "alcohol" },
  { pattern: /\b(tomato(?:es)?|marinara|ketchup|salsa)\b/i, label: "tomato or tomato sauce" },
  { pattern: /\b(spicy|hot sauce|chili|chilli|jalapeño|jalapeno|cayenne)\b/i, label: "hot or spicy food" },
  { pattern: /\b(aspartame|saccharin|sucralose|artificial sweetener|diet soda)\b/i, label: "artificial sweetener" },
  { pattern: /\b(chocolate|cocoa)\b/i, label: "chocolate" },
  { pattern: /\b(msg|monosodium glutamate)\b/i, label: "MSG" },
];

function matchedLabels(name: string, rules: { pattern: RegExp; label: string }[]) {
  return [...new Set(rules.filter((rule) => rule.pattern.test(name)).map((rule) => rule.label))];
}

function scoreIC(food: FoodWithNutrients): ConditionScore {
  const matches = matchedLabels(food.name, IC_TRIGGERS);
  if (matches.length) {
    return {
      rating: "limit",
      confidence: "moderate",
      reasons: [`Bladder / IC check: the name matches common symptom-trigger categories (${matches.join(", ")}). Triggers vary, so your food diary matters most.`],
    };
  }
  return {
    rating: "unknown",
    confidence: "low",
    reasons: ["Bladder / IC check: no common trigger was found in the food name, but that does not prove the food is symptom-safe. Ingredients and your own diary are more reliable than food pH."],
  };
}

function scoreIBS(food: FoodWithNutrients, mode: IbsMode = "general"): ConditionScore {
  const guidance = assessFoodForIbs(food.name, mode);
  const reasons: string[] = [];
  let rating: Rating;

  if (guidance.fodmap_level === "high") {
    rating = mode === "personalization" ? "unknown" : "limit";
    reasons.push(`IBS check: ${guidance.summary}`);
  } else if (guidance.fodmap_level === "low") {
    rating = "eat";
    reasons.push(`IBS check: ${guidance.summary}`);
  } else {
    rating = "unknown";
    reasons.push(`IBS check: ${guidance.summary}`);
  }

  if (guidance.common_triggers.length) {
    rating = worse(rating, "limit");
    reasons.push(`Common non-FODMAP triggers in the name: ${guidance.common_triggers.join(", ")}.`);
  }
  if (present(food.fiber_g)) {
    reasons.push(`This serving has ${rounded(food.fiber_g, 1)} g fiber. For IBS, soluble fiber and gradual changes are often better tolerated than sudden increases.`);
  } else {
    reasons.push("Fiber was not reported by the nutrition source.");
  }
  return {
    rating,
    confidence: guidance.fodmap_level === "unknown" ? "low" : "moderate",
    reasons,
    ibsGuidance: guidance,
  };
}

function scoreCrohns(food: FoodWithNutrients, state?: "stable" | "flare"): ConditionScore {
  const currentState = state ?? "stable";
  const reasons = [
    "Crohn’s check: research has not shown that one specific food causes or universally worsens Crohn’s disease; symptoms, strictures, surgery, and nutrition status change what fits.",
  ];
  if (present(food.fiber_g)) {
    reasons.push(`This serving has ${rounded(food.fiber_g, 1)} g fiber. During a ${currentState === "flare" ? "flare" : "stable period"}, follow your clinician’s texture and fiber guidance rather than a universal cutoff.`);
  }
  return { rating: "unknown", confidence: "low", reasons };
}

const GERD_TRIGGERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(oranges?|grapefruits?|lemons?|limes?|citrus|tomato(?:es)?|marinara|ketchup)\b/i, label: "acidic citrus or tomato" },
  { pattern: /\b(beer|wine|cider|liquor|alcohol)\b/i, label: "alcohol" },
  { pattern: /\b(chocolate|cocoa)\b/i, label: "chocolate" },
  { pattern: /\b(coffee|espresso|caffeinated|energy drinks?|cola)\b/i, label: "coffee or caffeine" },
  { pattern: /\b(mint|peppermint|spearmint)\b/i, label: "mint" },
  { pattern: /\b(spicy|hot sauce|chili|chilli|jalapeño|jalapeno|cayenne)\b/i, label: "spicy food" },
  { pattern: /\b(fried|deep fried)\b/i, label: "fried/high-fat food" },
];

function scoreGERD(food: FoodWithNutrients): ConditionScore {
  const matches = matchedLabels(food.name, GERD_TRIGGERS);
  if (present(food.fat_g) && food.fat_g >= 17) matches.push("high-fat serving");
  const uniqueMatches = [...new Set(matches)];
  if (uniqueMatches.length) {
    return {
      rating: "limit",
      confidence: "moderate",
      reasons: [`GERD check: this matches commonly reported symptom triggers (${uniqueMatches.join(", ")}). Only reduce foods that actually worsen your symptoms.`],
    };
  }
  return {
    rating: "unknown",
    confidence: "low",
    reasons: ["GERD check: no common trigger was found in the available name and nutrients. Meal timing, total meal size, preparation, and your personal response still matter."],
  };
}

function scoreDiabetes(food: FoodWithNutrients): ConditionScore {
  const reasons: string[] = [];
  if (!present(food.carbs_g)) {
    return { rating: "unknown", confidence: "low", reasons: ["Diabetes check: total carbohydrate is missing, so this serving cannot be estimated reliably."] };
  }

  // Diabetes guidance is individualized; carbohydrate alone cannot prove a food is safe.
  let rating: Rating = "unknown";
  reasons.push(`Diabetes check: this serving has ${rounded(food.carbs_g, 1)} g total carbohydrate; compare it with your personal meal or insulin plan.`);
  const sugaryDrink = /\b(soda|soft drinks?|fruit drinks?|sweet tea|energy drinks?|sports drinks?|milkshakes?)\b/i.test(food.name) && !/diet|zero sugar|unsweetened/i.test(food.name);
  if (sugaryDrink) {
    rating = worse(rating, "limit");
    reasons.push("The name suggests a sugar-sweetened drink, which current diabetes guidance strongly discourages.");
  }
  if (present(food.added_sugars_g) && food.added_sugars_g >= 10) {
    rating = worse(rating, "limit");
    reasons.push(`${rounded(food.added_sugars_g, 1)} g added sugar is at least 20% of the FDA Daily Value for one serving.`);
  } else if (present(food.added_sugars_g)) {
    reasons.push(`Added sugar is ${rounded(food.added_sugars_g, 1)} g per serving.`);
  }
  if (present(food.fiber_g) && food.fiber_g >= 3) {
    reasons.push(`${rounded(food.fiber_g, 1)} g fiber makes this a higher-fiber choice; whole, minimally processed carbohydrate sources are generally preferred.`);
  } else if (present(food.fiber_g)) {
    reasons.push(`Fiber is ${rounded(food.fiber_g, 1)} g per serving.`);
  }
  reasons.push("Nouri does not set a universal carbohydrate limit; medicines, insulin, activity, and personal glucose goals change what fits.");
  return { rating, confidence: "moderate", reasons };
}

function scoreHypertension(food: FoodWithNutrients): ConditionScore {
  if (!present(food.sodium_mg)) {
    return { rating: "unknown", confidence: "low", reasons: ["Blood-pressure check: sodium is missing from the source data."] };
  }
  if (food.sodium_mg >= 460) {
    return { rating: "limit", confidence: "high", reasons: [`Blood-pressure check: ${rounded(food.sodium_mg)} mg sodium is high for one serving (20% or more of the FDA Daily Value).`] };
  }
  if (food.sodium_mg > 115) {
    return { rating: "unknown", confidence: "high", reasons: [`Blood-pressure check: this serving has ${rounded(food.sodium_mg)} mg sodium. It falls between the FDA's low and high label thresholds, so compare it with your 1,500–2,300 mg daily plan.`] };
  }
  return { rating: "eat", confidence: "high", reasons: [`Blood-pressure check: ${rounded(food.sodium_mg)} mg sodium is low for one serving (5% Daily Value or less).`] };
}

function scoreHeartHealth(food: FoodWithNutrients): ConditionScore {
  const reasons: string[] = [];
  let rating: Rating = "eat";
  let measured = 0;
  if (present(food.saturated_fat_g)) {
    measured += 1;
    if (food.saturated_fat_g >= 4) rating = worse(rating, "limit");
    reasons.push(`Heart-health check: saturated fat is ${rounded(food.saturated_fat_g, 1)} g per serving${food.saturated_fat_g >= 4 ? " (20% or more of the FDA Daily Value)" : ""}.`);
  }
  if (present(food.sodium_mg)) {
    measured += 1;
    if (food.sodium_mg >= 460) rating = worse(rating, "limit");
    reasons.push(`Sodium is ${rounded(food.sodium_mg)} mg per serving${food.sodium_mg >= 460 ? "—a high-sodium serving" : ""}.`);
  }
  if (present(food.fiber_g) && food.fiber_g >= 3) {
    measured += 1;
    reasons.push(`Fiber is ${rounded(food.fiber_g, 1)} g per serving, a helpful feature in an overall heart-healthy eating pattern.`);
  }
  if (!measured) return { rating: "unknown", confidence: "low", reasons: ["Heart-health check: saturated fat, sodium, and fiber are missing."] };
  return { rating, confidence: "moderate", reasons };
}

async function getUserOverrides(params: {
  userId?: string;
  foodId: string | number;
  conditions: ConditionId[];
}): Promise<Map<ConditionId, UserOverride>> {
  const { userId, foodId, conditions } = params;
  const overrides = new Map<ConditionId, UserOverride>();
  if (!userId || !conditions.length) return overrides;

  const result = await pool.query(
    `SELECT condition_id, feedback, note
     FROM user_food_feedback
     WHERE user_id = $1
       AND food_id = $2
       AND condition_id = ANY($3::text[])`,
    [userId, foodId, conditions]
  );
  for (const row of result.rows) {
    const conditionId = (row.condition_id || (conditions.length === 1 ? conditions[0] : "")) as ConditionId;
    const feedback = String(row.feedback) as "safe" | "trigger";
    if (conditions.includes(conditionId) && (feedback === "safe" || feedback === "trigger")) {
      overrides.set(conditionId, { feedback, note: row.note ?? null });
    }
  }
  return overrides;
}

function scoreCondition(food: FoodWithNutrients, condition: ConditionId, settings: ScoreSettings): ConditionScore {
  if (condition === "KidneyDisease") return scoreKidney(food, settings);
  if (condition === "IC") return scoreIC(food);
  if (condition === "IBS") return scoreIBS(food, settings.ibsMode);
  if (condition === "Crohns") return scoreCrohns(food, settings.crohnsState);
  if (condition === "GERD") return scoreGERD(food);
  if (condition === "Diabetes") return scoreDiabetes(food);
  if (condition === "Hypertension") return scoreHypertension(food);
  return scoreHeartHealth(food);
}

export async function scoreFoodForConditionsDb(
  food: FoodWithNutrients,
  conditions: ConditionId[],
  settings: ScoreSettings,
  userId?: string
): Promise<ScoreResult> {
  if (!conditions?.length) {
    return {
      rating: "unknown",
      reasons: ["Choose at least one health area to receive tailored guidance."],
      condition_results: [],
      ibs_guidance: null,
    };
  }

  const overrides = await getUserOverrides({ userId, foodId: food.food_id, conditions });
  let finalRating: Rating = "eat";
  let ibsGuidance: IbsAssessment | null = null;
  const conditionResults: ConditionResult[] = [];

  for (const condition of conditions) {
    let result = scoreCondition(food, condition, settings);
    if (result.ibsGuidance) ibsGuidance = result.ibsGuidance;
    const override = overrides.get(condition);
    if (override?.feedback === "trigger") {
      result = {
        ...result,
        rating: "avoid",
        confidence: "high",
        reasons: [`Your history marks this as a trigger${override.note ? `: ${override.note}` : "."}`, ...result.reasons],
      };
    } else if (override?.feedback === "safe") {
      const symptomLed = ["IC", "IBS", "Crohns", "GERD"].includes(condition);
      result = {
        ...result,
        rating: symptomLed ? "eat" : result.rating,
        reasons: [`Your history marks this as safe${override.note ? `: ${override.note}` : "."}`, ...result.reasons],
      };
    }

    const conditionResult: ConditionResult = {
      condition,
      rating: result.rating,
      confidence: result.confidence,
      reasons: result.reasons,
    };
    conditionResults.push(conditionResult);
    finalRating = worse(finalRating, result.rating);
  }

  return {
    rating: finalRating,
    reasons: conditionResults.flatMap((result) => result.reasons),
    condition_results: conditionResults,
    ibs_guidance: ibsGuidance,
  };
}
