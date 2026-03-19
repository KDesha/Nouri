// backend/src/fdcClient.ts
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

// Use header auth (recommended by api.data.gov pattern)
function fdcHeaders() {
  return { "Content-Type": "application/json", "X-Api-Key": requireKey() };
}

export async function fdcSearchFoods(query: string, pageSize = 10) {
  const res = await fetch(`${FDC_BASE}/foods/search`, {
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
  const res = await fetch(`${FDC_BASE}/food/${fdcId}`, {
    method: "GET",
    headers: fdcHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC details failed: ${res.status} ${text}`);
  }

  return (await res.json()) as FdcFoodDetails;
}

// Helper: map FDC nutrients -> your columns
// We match by nutrient name; this is pragmatic and works well enough for class projects.
export function mapFdcNutrientsToColumns(details: FdcFoodDetails) {
  const nutrients = details.foodNutrients || [];

  const get = (name: string) => {
    const n = nutrients.find((x) => x.nutrient?.name?.toLowerCase() === name.toLowerCase());
    return n?.amount ?? null;
  };

  // Common FDC nutrient names:
  // "Energy" (kcal), "Protein", "Carbohydrate, by difference", "Total lipid (fat)",
  // "Sodium, Na", "Potassium, K", "Phosphorus, P", "Fiber, total dietary",
  // "Sugars, added", "Fatty acids, total saturated"
  return {
    calories_kcal: get("Energy"),
    protein_g: get("Protein"),
    carbs_g: get("Carbohydrate, by difference"),
    fat_g: get("Total lipid (fat)"),

    sodium_mg: get("Sodium, Na"),
    potassium_mg: get("Potassium, K"),
    phosphorus_mg: get("Phosphorus, P"),

    fiber_g: get("Fiber, total dietary"),
    added_sugars_g: get("Sugars, added"),
    saturated_fat_g: get("Fatty acids, total saturated"),
  };
}
