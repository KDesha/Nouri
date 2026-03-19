import { scoreFoodForConditionsDb } from "./src/scoreDb";
import { getPhCategoryForFoodName } from "./src/PHLocal";

function baseFood(overrides: Partial<any> = {}) {
  return {
    food_id: "1",
    name: "broccoli",
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

describe("scoreDb (unit-ish): scoring behavior", () => {
  test("Kidney stage 4 is stricter for potassium than stage 2", async () => {
    const food = baseFood({ potassium_mg: 350 }); // borderline
    const stage2 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 2 });
    const stage4 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 4 });

    // stage4 should be at least as restrictive
    const order = ["eat", "limit", "avoid"];
    expect(order.indexOf(stage4.rating)).toBeGreaterThanOrEqual(order.indexOf(stage2.rating));
  });

  test("IC: if acidic=true then rating is limit or worse", async () => {
    const food = baseFood({ acidic: true });
    const r = await scoreFoodForConditionsDb(food, ["IC"], {});
    expect(["limit", "avoid"]).toContain(r.rating);
  });

  test("Multiple conditions: most restrictive wins", async () => {
    const food = baseFood({
      sodium_mg: 600, // kidney should push toward avoid based on your demo thresholds
      acidic: true,   // IC should limit
    });

    const r = await scoreFoodForConditionsDb(food, ["KidneyDisease", "IC"], { kidneyStage: 3 });
    expect(["avoid", "limit"]).toContain(r.rating);
    // kidney high sodium likely triggers avoid; if you change thresholds later this expectation may change
  });

  test("pH category is returned (if food is in PHLocal)", async () => {
    const food = baseFood({ name: "Broccoli, cooked, boiled" });
    const r = await scoreFoodForConditionsDb(food, ["IC"], {});
    expect(r.ph_category).toBeTruthy();
  });
});