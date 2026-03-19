// src/nutritionData.ts

export type NutrientInfo = {
  potassiumMg: number; // per serving
  sodiumMg: number;    // per serving
  acidic: boolean;     // rough flag for bladder sensitivity
};

export type FoodRecord = {
  name: string;
  nutrients: NutrientInfo;
};

// Simple local "database" for now.
// These are approximate demo numbers, not clinical-grade values.
const FOOD_TABLE: FoodRecord[] = [
  {
    name: "banana",
    nutrients: {
      potassiumMg: 420,
      sodiumMg: 1,
      acidic: false,
    },
  },
  {
    name: "grilled chicken breast",
    nutrients: {
      potassiumMg: 256,
      sodiumMg: 70,
      acidic: false,
    },
  },
  {
    name: "tomato",
    nutrients: {
      potassiumMg: 290,
      sodiumMg: 5,
      acidic: true,
    },
  },
  {
    name: "black coffee",
    nutrients: {
      potassiumMg: 116,
      sodiumMg: 5,
      acidic: true,
    },
  },
  {
    name: "white rice",
    nutrients: {
      potassiumMg: 35,
      sodiumMg: 0,
      acidic: false,
    },
  },
];

export function findFoodByName(query: string): FoodRecord | undefined {
  const q = query.trim().toLowerCase();

  // simple contains/startsWith matching
  return FOOD_TABLE.find((f) => {
    const name = f.name.toLowerCase();
    return name === q || name.includes(q) || q.includes(name);
  });
}
