import { scaleFoodNutrients, scoreFoodForConditionsDb } from "./src/scoreDb";

function makeFood(overrides: Partial<any> = {}) {
  return {
    food_id: "1",
    name: "Broccoli, cooked",
    brand: null,
    source: "fdc",
    fdc_id: 1,
    calories_kcal: 50,
    protein_g: 4,
    carbs_g: 10,
    fat_g: 0,
    sodium_mg: 50,
    potassium_mg: 200,
    phosphorus_mg: 100,
    fiber_g: 3,
    total_sugars_g: 2,
    saturated_fat_g: 0,
    added_sugars_g: 0,
    cholesterol_mg: 0,
    calcium_mg: 40,
    iron_mg: 1,
    vitamin_d_mcg: 0,
    acidic: null,
    ...overrides,
  };
}

describe("serving-aware condition scoring", () => {
  test("scales per-100-g nutrients to a selected serving", () => {
    const scaled = scaleFoodNutrients(makeFood({ carbs_g: 25, potassium_mg: 350 }), 118);
    expect(scaled.carbs_g).toBeCloseTo(29.5);
    expect(scaled.potassium_mg).toBeCloseTo(413);
  });

  test("kidney stage alone does not impose a potassium restriction", async () => {
    const food = makeFood({ potassium_mg: 500, sodium_mg: 40 });
    const stage2 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 2 });
    const stage5 = await scoreFoodForConditionsDb(food, ["KidneyDisease"], { kidneyStage: 5 });
    expect(stage2.rating).toBe(stage5.rating);

    const carePlan = await scoreFoodForConditionsDb(food, ["KidneyDisease"], {
      kidneyStage: 5,
      kidneyLimitPotassium: true,
    });
    expect(carePlan.rating).toBe("limit");
  });

  test("IC uses documented trigger categories and does not call unmatched foods safe", async () => {
    const tomato = await scoreFoodForConditionsDb(makeFood({ name: "Tomatoes, raw" }), ["IC"], {});
    const broccoli = await scoreFoodForConditionsDb(makeFood(), ["IC"], {});
    expect(tomato.rating).toBe("limit");
    expect(broccoli.rating).toBe("unknown");
    expect(broccoli.reasons.join(" ")).toMatch(/does not prove/i);
  });

  test("GERD flags common symptom triggers", async () => {
    const result = await scoreFoodForConditionsDb(makeFood({ name: "Peppermint chocolate" }), ["GERD"], {});
    expect(result.rating).toBe("limit");
  });

  test("diabetes distinguishes carbohydrate amount, added sugar, and fiber", async () => {
    const result = await scoreFoodForConditionsDb(
      makeFood({ name: "sweetened cereal", carbs_g: 55, added_sugars_g: 14, fiber_g: 1 }),
      ["Diabetes"],
      {}
    );
    expect(result.rating).toBe("limit");
    expect(result.reasons.join(" ")).toMatch(/total carbohydrate/i);
    expect(result.reasons.join(" ")).toMatch(/added sugar/i);
  });

  test("hypertension uses the FDA high-sodium threshold per serving", async () => {
    const result = await scoreFoodForConditionsDb(makeFood({ sodium_mg: 460 }), ["Hypertension"], {});
    expect(result.rating).toBe("limit");
    expect(result.condition_results[0].confidence).toBe("high");
  });

  test("keeps sodium between the FDA low and high points uncertain", async () => {
    const result = await scoreFoodForConditionsDb(makeFood({ sodium_mg: 230 }), ["Hypertension"], {});
    expect(result.rating).toBe("unknown");
  });

  test("heart health flags a high saturated-fat serving", async () => {
    const result = await scoreFoodForConditionsDb(makeFood({ saturated_fat_g: 4 }), ["HeartHealth"], {});
    expect(result.rating).toBe("limit");
  });

  test("Crohn's stays uncertainty-aware instead of declaring a food universally safe", async () => {
    const result = await scoreFoodForConditionsDb(makeFood({ fiber_g: 8 }), ["Crohns"], { crohnsState: "flare" });
    expect(result.rating).toBe("unknown");
  });
});
