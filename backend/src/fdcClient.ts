
type FdcSearchFood = {
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

type FdcFoodDetails = {
  fdcId: number;
  description: string;
  brandName?: string;
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

export async function fdcSearchFoods(query: string, pageSize = 10) {
  const res = await fetch(withApiKey(`${FDC_BASE}/foods/search`), {
    method: "POST",
    headers: fdcHeaders(),
    body: JSON.stringify({
      query,
      pageSize,
      pageNumber: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as FdcSearchResponse;
  return data.foods || [];
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
 * 1258 saturated fat, 1235 added sugars (often missing).
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

  // Simple IC “acidic trigger” heuristic (editable later / user override exists)
  const desc = (details.description || "").toLowerCase();
  const acidic =
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
    added_sugars_g: byId(1235),
    saturated_fat_g: byId(1258),

    acidic,
  };
}
