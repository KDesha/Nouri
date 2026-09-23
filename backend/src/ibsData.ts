export type IbsMode = "general" | "lowFODMAP" | "reintroduction" | "personalization";
export type FodmapLevel = "low" | "high" | "unknown";

export type IbsAssessment = {
  phase: IbsMode;
  fodmap_level: FodmapLevel;
  fodmap_groups: string[];
  portion_sensitive: boolean;
  summary: string;
  common_triggers: string[];
};

type FoodRule = {
  pattern: RegExp;
  groups?: string[];
  portionSensitive?: boolean;
};

// Conservative name-based screening derived from examples published by NIDDK.
// It is intentionally not a substitute for laboratory-tested, serving-specific data.
// https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome/eating-diet-nutrition
const HIGH_FODMAP_RULES: FoodRule[] = [
  { pattern: /\b(apples?|apricots?|blackberr(?:y|ies)|cherr(?:y|ies)|mango(?:es)?|nectarines?|pears?|plums?|watermelons?)\b/i, groups: ["excess fructose / polyols"], portionSensitive: true },
  { pattern: /\b(artichokes?|asparagus|cauliflowers?|garlic|onions?|shallots?|leeks?)\b/i, groups: ["fructans"], portionSensitive: true },
  { pattern: /\b(bean|beans|lentil|lentils|chickpea|chickpeas|legume|legumes)\b/i, groups: ["GOS / fructans"], portionSensitive: true },
  { pattern: /\b(mushrooms?|snow peas?|snap peas?|cabbages?)\b/i, groups: ["polyols / fructans"], portionSensitive: true },
  { pattern: /\b(milk|yogurts?|yoghurts?|ice creams?|custards?|ricotta|soft cheeses?)\b/i, groups: ["lactose"], portionSensitive: true },
  { pattern: /\b(wheat|rye)\b/i, groups: ["fructans"], portionSensitive: true },
  { pattern: /\b(honey|agave|high[- ]fructose corn syrup|hfcs)\b/i, groups: ["excess fructose"], portionSensitive: true },
  { pattern: /\b(sorbitol|mannitol|xylitol|maltitol|isomalt)\b/i, groups: ["polyols"], portionSensitive: true },
];

const LIKELY_LOW_FODMAP_RULES: FoodRule[] = [
  { pattern: /\b(rice|quinoa|oats?|oatmeal|potato(?:es)?|polenta)\b/i },
  { pattern: /\b(carrots?|spinach|cucumbers?|eggplants?|aubergines?|zucchinis?|courgettes?|bell peppers?|tomato(?:es)?)\b/i },
  { pattern: /\b(oranges?|kiwis?|grapes?|strawberr(?:y|ies)|blueberr(?:y|ies)|pineapples?)\b/i, portionSensitive: true },
  { pattern: /\b(chickens?|turkeys?|beef|pork|lamb|fish|salmon|tuna|shrimp|eggs?)\b/i },
  { pattern: /\b(firm tofu|lactose[- ]free|cheddar|parmesan)\b/i, portionSensitive: true },
];

const PORTION_SENSITIVE_RULES = [/\bbananas?\b/i, /\bavocados?\b/i, /\bsweet potatoes?\b/i];
const MIXED_FOOD = /\b(soup|stew|sauce|pizza|sandwich|wrap|meal|bowl|salad|casserole|seasoned|flavored|dressing)\b/i;

const COMMON_TRIGGER_RULES: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(coffee|espresso|energy drinks?|caffeinated|cola)\b/i, label: "caffeine" },
  { pattern: /\b(beer|wine|cider|vodka|whiskey|whisky|rum|alcohol)\b/i, label: "alcohol" },
  { pattern: /\b(spicy|hot sauce|chili|chilli|jalapeño|jalapeno)\b/i, label: "spice" },
  { pattern: /\b(fried|deep fried)\b/i, label: "fried food" },
];

function unique(values: string[]) {
  return [...new Set(values)];
}

export function assessFoodForIbs(name: string, mode: IbsMode = "general"): IbsAssessment {
  const foodName = String(name || "").trim().toLowerCase();
  const highMatches = HIGH_FODMAP_RULES.filter((rule) => rule.pattern.test(foodName));
  const lowMatches = LIKELY_LOW_FODMAP_RULES.filter((rule) => rule.pattern.test(foodName));
  const commonTriggers = COMMON_TRIGGER_RULES
    .filter((rule) => rule.pattern.test(foodName))
    .map((rule) => rule.label);
  const explicitPortionSensitivity = PORTION_SENSITIVE_RULES.some((rule) => rule.test(foodName));
  const portionSensitive =
    explicitPortionSensitivity ||
    highMatches.some((rule) => rule.portionSensitive) ||
    lowMatches.some((rule) => rule.portionSensitive);

  let fodmapLevel: FodmapLevel = "unknown";
  if (highMatches.length) fodmapLevel = "high";
  else if (lowMatches.length && !MIXED_FOOD.test(foodName)) fodmapLevel = "low";

  const fodmapGroups = unique(highMatches.flatMap((rule) => rule.groups ?? []));
  let summary: string;

  if (fodmapLevel === "high") {
    summary =
      mode === "reintroduction"
        ? "This name matches a higher-FODMAP food. During reintroduction, test one FODMAP group at a time and record symptoms."
        : mode === "personalization"
          ? "This name matches a higher-FODMAP food, but your own tested tolerance should guide the personalized phase."
          : "This name matches a food commonly limited during the short low-FODMAP swap phase. Serving size still matters.";
  } else if (fodmapLevel === "low") {
    summary = "No common high-FODMAP ingredient was identified in this single-food name. Check the portion and any added ingredients.";
  } else if (explicitPortionSensitivity) {
    summary = "FODMAP content for this food can change substantially with portion size or ripeness, so a name alone is not enough to rate it.";
  } else {
    summary = "Nouri cannot reliably infer FODMAP content from this name alone. Check ingredients and a tested serving-size source.";
  }

  return {
    phase: mode,
    fodmap_level: fodmapLevel,
    fodmap_groups: fodmapGroups,
    portion_sensitive: portionSensitive || fodmapLevel !== "low",
    summary,
    common_triggers: unique(commonTriggers),
  };
}
