import { scoreFoodForConditionsDb } from "./src/scoreDb";

function makeFood(overrides: Partial<any> = {}) {
  return {
    food_id: "1",
    name: "Broccoli, cooked",
    brand: null,
    source: "local",
    fdc_id: null,

    calories_kcal: 50,
    protein_g: 4,
    carbs_g: 10,
    fat_g: 0,

    sodium_mg: 50,
    potassium_mg: 200,
    phosphorus_mg: 100,

    fiber_g: 3,
    saturated_fat_g: 0,
    added_sugars_g: 0,

    acidic: false,
    ...overrides,
  };
}

describe("scoreDb: scoring logic (no DB)", () => {
  test("Kidney stage 4 is stricter than stage 2 for potassium", async () => {
    const food = makeFood({ potassium_mg: 350 });

    const stage2 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 2 });
    const stage4 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 4 });

    const order = ["eat", "limit", "avoid"];
    expect(order.indexOf(stage4.rating)).toBeGreaterThanOrEqual(order.indexOf(stage2.rating));
  });

  test("IC: acidic=true returns limit or avoid", async () => {
    const food = makeFood({ acidic: true });
    const r = await scoreFoodForConditionsDb(food, ["IC"], {});
    expect(["limit", "avoid"]).toContain(r.rating);
  });

  test("Worst rating wins across multiple conditions", async () => {
    const food = makeFood({
      sodium_mg: 600, // kidney likely restrictive
      acidic: true,   // IC limits
    });

    const r = await scoreFoodForConditionsDb(food, ["KidneyDisease", "IC"], { kidneyStage: 3 });
    expect(["limit", "avoid"]).toContain(r.rating);
  });

  test("pH category comes back if food matches PHLocal list", async () => {
    const food = makeFood({ name: "Broccoli, cooked, boiled" });
    const r = await scoreFoodForConditionsDb(food, ["IC"], {});
    expect(r.ph_category).toBeTruthy(); // should be non-null if broccoli exists in PHLocal.ts
  });
});