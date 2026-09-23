
import type { ServingOption } from "./foodsRepo";

export type FdcSearchFood = {
  fdcId: number;
  description: string;
  brandName?: string;
  dataType?: string;
};

type FdcSearchResponse = {
  foods: FdcSearchFood[];
};

type FdcNutrient = {
  nutrient: { id: number; name: string; unitName: string };
  amount?: number;
};

type FdcPortion = {
  amount?: number;
  gramWeight?: number;
  modifier?: string;
  portionDescription?: string;
  measureUnit?: { name?: string; abbreviation?: string };
};

export type FdcFoodDetails = {
  fdcId: number;
  description: string;
  brandName?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodPortions?: FdcPortion[];
  foodNutrients?: FdcNutrient[];
};

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

function requireKey(): string {
  const key = process.env.FDC_API_KEY;
  if (!key) throw new Error("FDC_API_KEY missing in .env");
  return key;
}

// Header auth (api.data.gov style)
function fdcHeaders() {
  return { "Content-Type": "application/json", "X-Api-Key": requireKey() };
}

// Fallback: some environments behave better with api_key query param
function withApiKey(url: string) {
  const key = encodeURIComponent(requireKey());
  return url.includes("?") ? `${url}&api_key=${key}` : `${url}?api_key=${key}`;
}

export async function fdcSearchFoods(
  query: string,
  pageSize = 25,
  dataType?: string[]
) {
  const res = await fetch(withApiKey(`${FDC_BASE}/foods/search`), {
    method: "POST",
    headers: fdcHeaders(),
    body: JSON.stringify({
      query,
      pageSize,
      pageNumber: 1,
      ...(dataType?.length ? { dataType } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as FdcSearchResponse;
  return data.foods || [];
}

const GENERAL_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

type FoodFamilyCategory = {
  search: string;
  include: RegExp;
  exclude?: RegExp;
};

type FoodFamily = {
  match: RegExp;
  expandedQueries: string[];
  categories: FoodFamilyCategory[];
};

const FOOD_FAMILIES: FoodFamily[] = [
  {
    match: /^chickens?$/i,
    expandedQueries: [
      "chicken breast raw",
      "chicken thigh raw",
      "chicken leg raw",
      "chicken wing raw",
    ],
    categories: [
      { search: "chicken breast", include: /\bchicken\b.*\bbreast\b/i, exclude: /fried|coated|sandwich|restaurant/i },
      { search: "chicken thigh", include: /\bchicken\b.*\bthigh\b/i, exclude: /fried|coated|sandwich|restaurant|skin \(/i },
      { search: "chicken leg", include: /\bchicken\b.*\b(leg|drumstick)\b/i, exclude: /mock|frog|fried|coated/i },
      { search: "chicken wing", include: /\bchicken\b.*\bwing\b/i, exclude: /fried|coated|restaurant/i },
    ],
  },
  {
    match: /^tomato(?:es)?$/i,
    expandedQueries: ["tomato raw", "tomato roma", "tomato grape raw", "tomato green raw"],
    categories: [
      { search: "tomato raw", include: /\btomato(?:es)?\b.*\braw\b/i, exclude: /grape|green|orange|yellow|sun-dried/i },
      { search: "tomato roma", include: /\btomato\b.*\broma\b/i },
      { search: "tomato grape", include: /\btomato(?:es)?\b.*\b(grape|cherry)\b/i },
      { search: "tomato green", include: /\btomato(?:es)?\b.*\bgreen\b.*\braw\b/i },
    ],
  },
];

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Prefer generic USDA records and exact food-name matches over branded variants. */
export function rankGeneralFoodMatches(query: string, foods: FdcSearchFood[], limit = 3) {
  const queryWords = normalizedWords(query);
  const normalizedQuery = queryWords.join(" ");
  const scored = foods.map((food, index) => {
    const descriptionWords = normalizedWords(food.description);
    const normalizedDescription = descriptionWords.join(" ");
    const typeIndex = GENERAL_DATA_TYPES.indexOf(food.dataType || "");
    const allWordsMatch = queryWords.every((word) =>
      descriptionWords.some((candidate) => candidate === word || candidate === `${word}s` || `${candidate}s` === word)
    );
    let score = typeIndex >= 0 ? typeIndex * 4 : 50;
    if (normalizedDescription === normalizedQuery) score -= 35;
    else if (
      normalizedDescription.startsWith(`${normalizedQuery} `) ||
      normalizedDescription.startsWith(`${normalizedQuery}s `)
    ) score -= 24;
    else if (normalizedDescription.includes(normalizedQuery)) score -= 14;
    if (allWordsMatch) score -= 8;
    if (food.brandName) score += 35;
    if (/babyfood|restaurant|fast food|school lunch|commercially prepared/i.test(food.description)) score += 18;
    if (/\b(overripe|unripe|dehydrated|dried|powder|canned|frozen)\b/i.test(food.description)) score += 20;
    score += Math.max(0, descriptionWords.length - queryWords.length) * 0.35;
    return { food, score, index };
  });

  const seen = new Set<string>();
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ food }) => food)
    .filter((food) => {
      const key = normalizedWords(food.description)
        .slice(0, 8)
        .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
        .join(" ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function familyFor(query: string) {
  const normalized = normalizedWords(query).join(" ");
  return FOOD_FAMILIES.find((family) => family.match.test(normalized));
}

/** Extra USDA searches used only for broad food families such as chicken or tomato. */
export function expandedFoodQueries(query: string) {
  return familyFor(query)?.expandedQueries ?? [];
}

/**
 * Split USDA matches into a short set of useful general choices and a longer
 * list for the optional "Other forms" sheet. This is deterministic so the same
 * query is stable, testable, and does not send health searches to a generative AI.
 */
export function groupFoodSearchMatches(
  query: string,
  foods: FdcSearchFood[],
  generalLimit = 4,
  otherLimit = 40
) {
  const family = familyFor(query);
  const uniqueFoods = [...new Map(foods.map((food) => [food.fdcId, food])).values()];
  const general: FdcSearchFood[] = [];

  if (family) {
    for (const category of family.categories) {
      const candidates = uniqueFoods.filter(
        (food) => category.include.test(food.description) && !category.exclude?.test(food.description)
      );
      const best = rankGeneralFoodMatches(category.search, candidates, 1)[0];
      if (best && !general.some((food) => food.fdcId === best.fdcId)) general.push(best);
      if (general.length >= generalLimit) break;
    }
  } else {
    general.push(...rankGeneralFoodMatches(query, uniqueFoods, 1));
  }

  const selectedIds = new Set(general.map((food) => food.fdcId));
  const other = rankGeneralFoodMatches(query, uniqueFoods, uniqueFoods.length)
    .filter((food) => !selectedIds.has(food.fdcId))
    .slice(0, otherLimit);

  return { general, other, familyMatched: !!family };
}

const CURATED_PORTIONS: { pattern: RegExp; options: ServingOption[] }[] = [
  {
    // These whole-fruit sizes only apply to a plain raw banana. Matching every
    // food containing "banana" made puddings and breads inherit fruit sizes.
    pattern: /^bananas?,\s*raw(?:$|,)/i,
    options: [
      { id: "small", label: "1 small banana", grams: 101 },
      { id: "medium", label: "1 medium banana", grams: 118 },
      { id: "large", label: "1 large banana", grams: 136 },
      { id: "cup-sliced", label: "1 cup sliced", grams: 150 },
    ],
  },
];

function friendlyPortionLabel(value: string) {
  return value
    .replace(/\bRACC\b/gi, "serving")
    .replace(/\s+/g, " ")
    .trim();
}

function portionLabel(portion: FdcPortion) {
  const description = portion.portionDescription?.trim();
  if (description) return friendlyPortionLabel(description);
  const amount = portion.amount && portion.amount !== 1 ? `${portion.amount} ` : "1 ";
  const unit = portion.measureUnit?.name || portion.measureUnit?.abbreviation || "serving";
  const modifier = portion.modifier?.trim();
  return friendlyPortionLabel(`${amount}${unit}${modifier ? ` ${modifier}` : ""}`);
}

function portionId(label: string, grams: number) {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.round(grams)}`;
}

/** Convert USDA household portions to a short, useful serving picker. */
export function buildServingOptions(details: FdcFoodDetails): ServingOption[] {
  const curated = CURATED_PORTIONS.find((entry) => entry.pattern.test(details.description))?.options ?? [];
  const fromFdc = (details.foodPortions || [])
    .map((portion) => {
      const grams = Number(portion.gramWeight);
      const label = portionLabel(portion);
      return { id: portionId(label, grams), label, grams };
    })
    .filter(
      (portion) =>
        Number.isFinite(portion.grams) &&
        portion.grams > 0 &&
        portion.grams <= 1500 &&
        !/quantity not specified|undetermined/i.test(portion.label)
    );

  if (
    Number.isFinite(Number(details.servingSize)) &&
    Number(details.servingSize) > 0 &&
    String(details.servingSizeUnit || "").toLowerCase().startsWith("g")
  ) {
    const grams = Number(details.servingSize);
    const label = details.householdServingFullText?.trim() || "1 labeled serving";
    fromFdc.unshift({ id: portionId(label, grams), label, grams });
  }

  const priority = (label: string) => {
    if (/\bsmall\b/i.test(label)) return 0;
    if (/\bmedium\b/i.test(label)) return 1;
    if (/\blarge\b/i.test(label)) return 2;
    if (/\bcup\b/i.test(label)) return 3;
    if (/slice|piece|each|serving/i.test(label)) return 4;
    return 5;
  };

  const seen = new Set<string>();
  const combined = [...curated, ...fromFdc]
    .sort((a, b) => priority(a.label) - priority(b.label) || a.grams - b.grams)
    .filter((portion) => {
      const key = `${portion.label.toLowerCase()}-${Math.round(portion.grams)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);

  return combined.length
    ? combined
    : [{ id: "grams-100", label: "100 g", grams: 100 }];
}

/** Refresh cached serving data created before friendly, food-specific labels. */
export function servingOptionsNeedRefresh(description: string, options: ServingOption[] | null | undefined) {
  if (!options?.length) return true;
  if (options.some((option) => /\bRACC\b/i.test(option.label))) return true;

  const isPlainRawBanana = /^bananas?,\s*raw(?:$|,)/i.test(description);
  const hasWholeBananaPreset = options.some((option) =>
    ["small", "medium", "large", "cup-sliced"].includes(option.id)
  );
  return !isPlainRawBanana && hasWholeBananaPreset;
}

export async function fdcGetFoodDetails(fdcId: number) {
  const res = await fetch(withApiKey(`${FDC_BASE}/food/${fdcId}`), {
    method: "GET",
    headers: fdcHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC details failed: ${res.status} ${text}`);
  }

  return (await res.json()) as FdcFoodDetails;
}

/**
 * Map FDC nutrients -> your DB columns.
 * IMPORTANT: mapping by nutrient ID is more reliable than matching by name.
 * Common nutrient IDs:
 * 1008 kcal, 1009 kJ, 1003 protein, 1005 carbs, 1004 fat,
 * 1093 sodium, 1092 potassium, 1091 phosphorus, 1079 fiber,
 * 2000 total sugars, 1235 added sugars, 1258 saturated fat,
 * 1253 cholesterol, 1087 calcium, 1089 iron, 1114 vitamin D.
 */
export function mapFdcNutrientsToColumns(details: FdcFoodDetails) {
  const nutrients = details.foodNutrients || [];

  const byId = (id: number) =>
    nutrients.find((x) => x.nutrient?.id === id)?.amount ?? null;

  const byName = (name: string) =>
    nutrients.find(
      (x) => x.nutrient?.name?.toLowerCase() === name.toLowerCase()
    )?.amount ?? null;

  // calories: prefer kcal id 1008, else try name "Energy".
  // If only kJ (1009) exists, convert to kcal.
  const kcal = byId(1008) ?? byName("Energy");
  const kJ = byId(1009);

  const calories_kcal =
    kcal ?? (kJ != null ? Math.round((kJ / 4.184) * 100) / 100 : null);

  // Retained for database compatibility. A positive value means a documented
  // IC/GERD trigger keyword was present; a non-match is unknown, not "non-acidic."
  const desc = (details.description || "").toLowerCase();
  const triggerMatch =
    /tomato|coffee|citrus|orange|lemon|lime|grapefruit|vinegar|cola|soda|chocolate|pepper|spicy/.test(
      desc
    );

  return {
    calories_kcal,
    protein_g: byId(1003),
    carbs_g: byId(1005),
    fat_g: byId(1004),

    sodium_mg: byId(1093),
    potassium_mg: byId(1092),
    phosphorus_mg: byId(1091),

    fiber_g: byId(1079),
    total_sugars_g: byId(2000),
    added_sugars_g: byId(1235),
    saturated_fat_g: byId(1258),
    cholesterol_mg: byId(1253),
    calcium_mg: byId(1087),
    iron_mg: byId(1089),
    vitamin_d_mcg: byId(1114),

    acidic: triggerMatch ? true : null,
  };
}
