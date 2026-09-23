export type EdamamSmartPortion = {
  label: string;
  grams: number;
};

export type EdamamSmartMatch = {
  foodId: string;
  label: string;
  knownAs: string | null;
  brand: string | null;
  category: string | null;
  categoryLabel: string | null;
  parsedQuantity: number | null;
  parsedMeasure: string | null;
  portions: EdamamSmartPortion[];
};

type EdamamFood = {
  foodId?: string;
  label?: string;
  knownAs?: string;
  brand?: string;
  category?: string;
  categoryLabel?: string;
};

type EdamamMeasure = {
  label?: string;
  weight?: number;
};

type EdamamParsed = {
  food?: EdamamFood;
  quantity?: number;
  measure?: EdamamMeasure;
};

type EdamamHint = {
  food?: EdamamFood;
  measures?: EdamamMeasure[];
};

type EdamamParserResponse = {
  parsed?: EdamamParsed[];
  hints?: EdamamHint[];
};

const EDAMAM_PARSER_URL = "https://api.edamam.com/api/food-database/v2/parser";

export function edamamEnabled(env: NodeJS.ProcessEnv = process.env) {
  // EDAMAM_TRIAL_ENABLED is accepted temporarily so existing local setups
  // continue working after the integration was moved to a paid plan.
  const enabled = env.EDAMAM_ENABLED ?? env.EDAMAM_TRIAL_ENABLED;
  return (
    enabled === "true" &&
    Boolean(env.EDAMAM_APP_ID?.trim()) &&
    Boolean(env.EDAMAM_APP_KEY?.trim())
  );
}

function friendlyMeasureLabel(value: string) {
  const label = value.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!label) return "serving";
  return label === "unit" ? "item" : label;
}

function portionsFromMeasures(measures: EdamamMeasure[] | undefined) {
  const seen = new Set<string>();
  return (measures || [])
    .map((measure) => ({
      label: `1 ${friendlyMeasureLabel(measure.label || "serving")}`,
      grams: Number(measure.weight),
    }))
    .filter((portion) => Number.isFinite(portion.grams) && portion.grams > 0 && portion.grams <= 2000)
    .filter((portion) => {
      const key = `${portion.label}-${Math.round(portion.grams)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function matchFromFood(
  food: EdamamFood | undefined,
  options: {
    parsedQuantity?: number;
    parsedMeasure?: EdamamMeasure;
    measures?: EdamamMeasure[];
  } = {}
): EdamamSmartMatch | null {
  const foodId = food?.foodId?.trim();
  const label = food?.label?.trim();
  if (!foodId || !label) return null;

  const quantity = Number(options.parsedQuantity);
  return {
    foodId,
    label,
    knownAs: food?.knownAs?.trim() || null,
    brand: food?.brand?.trim() || null,
    category: food?.category?.trim() || null,
    categoryLabel: food?.categoryLabel?.trim() || null,
    parsedQuantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    parsedMeasure: options.parsedMeasure?.label
      ? friendlyMeasureLabel(options.parsedMeasure.label)
      : null,
    portions: portionsFromMeasures(options.measures),
  };
}

/**
 * Turn Edamam's parser response into a short, stable preview. Nothing returned
 * here is written to Nouri's database; Edamam is used only as a live search aid.
 */
export function normalizeEdamamMatches(data: EdamamParserResponse, limit = 2) {
  const hintsByFoodId = new Map(
    (data.hints || [])
      .filter((hint) => hint.food?.foodId)
      .map((hint) => [hint.food!.foodId!, hint] as const)
  );
  const candidates: EdamamSmartMatch[] = [];

  for (const parsed of data.parsed || []) {
    const matchingHint = parsed.food?.foodId ? hintsByFoodId.get(parsed.food.foodId) : undefined;
    const match = matchFromFood(parsed.food, {
      parsedQuantity: parsed.quantity,
      parsedMeasure: parsed.measure,
      measures: matchingHint?.measures,
    });
    if (match) candidates.push(match);
  }

  for (const hint of data.hints || []) {
    const match = matchFromFood(hint.food, { measures: hint.measures });
    if (match) candidates.push(match);
  }

  const seen = new Set<string>();
  const uniqueMatches = candidates
    .filter((match) => {
      if (seen.has(match.foodId)) return false;
      seen.add(match.foodId);
      return true;
    });

  // When Edamam finds a general food first, do not clutter the short preview
  // with branded products that merely contain the same word (for example, a
  // restaurant banana shake after a search for a banana). Branded searches
  // still keep branded alternatives because the leading match has a brand.
  const leadingMatch = uniqueMatches[0];
  return uniqueMatches
    .filter((match, index) => index === 0 || Boolean(leadingMatch?.brand) || !match.brand)
    .slice(0, limit);
}

export async function edamamSmartSearch(query: string): Promise<EdamamSmartMatch[]> {
  if (!edamamEnabled()) return [];

  const params = new URLSearchParams({
    app_id: process.env.EDAMAM_APP_ID!.trim(),
    app_key: process.env.EDAMAM_APP_KEY!.trim(),
    ingr: query,
    "nutrition-type": "logging",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${EDAMAM_PARSER_URL}?${params.toString()}`, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Edamam search failed with status ${response.status}`);
    return normalizeEdamamMatches((await response.json()) as EdamamParserResponse);
  } finally {
    clearTimeout(timeout);
  }
}
