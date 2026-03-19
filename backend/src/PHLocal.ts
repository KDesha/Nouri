// phlocal.ts

export type PhCategory =
  | "Highly Alkaline"
  | "Moderately Alkaline"
  | "Mildly Alkaline"
  | "Neutral / Mildly Acidic"
  | "Moderately Acidic"
  | "Highly Acidic";

export type PhResult = {
  ph_category: PhCategory;
  ph_note: string | null; // only for Neutral/Mildly Acidic + Moderately Acidic
};

const NOTE_20_PERCENT = "CAN BE INCLUDED IN YOUR 20% ACID";

function normalize(s: string) {
  return s.toLowerCase().trim();
}

/**
 * Names only — no pH numbers.
 * Put a food name under ONE category.
 * Matching:
 *  - exact match first
 *  - then "includes" match for long USDA names
 */
const PH_BY_CATEGORY: Record<PhCategory, string[]> = {
  "Highly Alkaline": [
    "alkaline water",
    "broccoli",
    "cucumber",
    "kale",
    "spinach",
    "himalayan pink salt",
    "cucumber",
    "kelp",
    "parsley",
    "sprouts",
    "soy",
    "alfalfa",
    "Sea vegetables",
    "sprouted beans",

  ],
  "Moderately Alkaline": [
    "avocado",
    "beetroot",
    "cabbage",
    "celery",
    "green beans",
    "lettuce",
    "Capsicum/peper",
    "endive",
    "garlic",
    "ginger",
    "collard spring greens",
    "mustard greens",
    "okra",
    "onion",
    "radish",
    "red onion",
    "rocket/arugula",
    "tomato",
    "lemon",
    "lime",
    "butter beans",
    "soy beans",
    "white haricot beans",
    "chia/saiba",
    "quinoa",
    // add more...
  ],
  "Mildly Alkaline": [
    "asparagus",
    "cauliflower",
    "carrot",
    "peas",
    "quinoa",
    // add more...
  ],
  "Neutral / Mildly Acidic": [
    "black beans",
    "chickpeas",
    "kidney beans",
    "rice",
    "soybeans",
    "watermelon",
    // add more...
  ],
  "Moderately Acidic": [
    "apple",
    "banana",
    "blueberry",
    "mango",
    "orange",
    "pineapple",
    "strawberry",
    // add more...
  ],
  "Highly Acidic": [
    "alcohol",
    "black tea",
    "coffee",
    "vinegar",
    "soy sauce",
    "cheese",
    "beef",
    "pork",
    // add more...
  ],
};

function noteForCategory(cat: PhCategory): string | null {
  return cat === "Neutral / Mildly Acidic" || cat === "Moderately Acidic"
    ? NOTE_20_PERCENT
    : null;
}

export function getPhCategoryForFoodName(foodName: string): PhResult | null {
  const name = normalize(foodName);

  // 1) exact match
  for (const [category, items] of Object.entries(PH_BY_CATEGORY) as [
    PhCategory,
    string[]
  ][]) {
    for (const key of items) {
      if (name === normalize(key)) {
        return { ph_category: category, ph_note: noteForCategory(category) };
      }
    }
  }

  // 2) contains match (handles long USDA names)
  for (const [category, items] of Object.entries(PH_BY_CATEGORY) as [
    PhCategory,
    string[]
  ][]) {
    for (const key of items) {
      const k = normalize(key);
      if (k.length >= 3 && name.includes(k)) {
        return { ph_category: category, ph_note: noteForCategory(category) };
      }
    }
  }

  return null;
}