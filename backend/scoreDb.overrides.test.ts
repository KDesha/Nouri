// Mock DB BEFORE importing scoreDb
jest.mock("./src/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "./src/database";
import { scoreFoodForConditionsDb } from "./src/scoreDb";

function makeFood(overrides: Partial<any> = {}) {
  return {
    food_id: "123",
    name: "banana",
    brand: null,
    source: "local",
    fdc_id: null,

    calories_kcal: 100,
    protein_g: 1,
    carbs_g: 25,
    fat_g: 0,

    sodium_mg: 1,
    potassium_mg: 350,
    phosphorus_mg: 20,

    fiber_g: 3,
    saturated_fat_g: 0,
    added_sugars_g: 0,

    acidic: false,
    ...overrides,
  };
}

describe("scoreDb: user overrides (mocked DB)", () => {
  beforeEach(() => {
    (pool.query as jest.Mock).mockReset();
  });

  test("TRIGGER override forces rating to avoid", async () => {
    // Simulate DB returning a trigger override
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ feedback: "trigger", note: "Causes flares" }],
    });

    const food = makeFood();
    const r = await scoreFoodForConditionsDb(food, ["IC"], {}, "user_1");

    expect(r.rating).toBe("avoid");
    expect(r.reasons.join(" ")).toMatch(/TRIGGER/i);
    expect(r.reasons.join(" ")).toMatch(/Causes flares/i);
  });

  test("SAFE override adds context (does not have to change rating)", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ feedback: "safe", note: "Works for me" }],
    });

    const food = makeFood({ name: "black coffee" }); // common IC trigger category
    const r = await scoreFoodForConditionsDb(food, ["IC"], {}, "user_2");

    expect(r.reasons.join(" ")).toMatch(/SAFE/i);
    expect(r.reasons.join(" ")).toMatch(/Works for me/i);
  });

  test("No override row returns normal scoring", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const food = makeFood({ name: "black coffee" });
    const r = await scoreFoodForConditionsDb(food, ["IC"], {}, "user_3");

    expect(["limit", "avoid"]).toContain(r.rating);
  });
});
