import { getPhCategoryForFoodName } from "./src/PHLocal";

describe("PHLocal: getPhCategoryForFoodName", () => {
  test("Exact match: broccoli returns category and no note", () => {
    // Assumes you have "broccoli" in Highly Alkaline in PHLocal.ts
    const r = getPhCategoryForFoodName("broccoli");
    expect(r).not.toBeNull();
    expect(r?.ph_category).toBe("Highly Alkaline");
    expect(r?.ph_note).toBeNull();
  });

  test("Contains match: long USDA name still matches", () => {
    // "broccoli" should match within a longer string
    const r = getPhCategoryForFoodName("Broccoli, cooked, boiled, drained, without salt");
    expect(r).not.toBeNull();
    expect(r?.ph_category).toBe("Highly Alkaline");
  });

  test("Moderately Acidic returns the 20% acid note", () => {
    // Assumes you have "banana" in Moderately Acidic in PHLocal.ts
    const r = getPhCategoryForFoodName("banana");
    expect(r).not.toBeNull();
    expect(r?.ph_category).toBe("Moderately Acidic");
    expect(r?.ph_note).toBe("CAN BE INCLUDED IN YOUR 20% ACID");
  });

  test("Neutral / Mildly Acidic returns the 20% acid note", () => {
    // Pick a food you placed under Neutral / Mildly Acidic
    // Example: "rice" if you put it there
    const r = getPhCategoryForFoodName("white rice");
    // If "white rice" isn't in your list, change this test to one that is.
    expect(r).not.toBeNull();
    expect(r?.ph_category).toBe("Neutral / Mildly Acidic");
    expect(r?.ph_note).toBe("CAN BE INCLUDED IN YOUR 20% ACID");
  });

  test("Food not in local DB returns null", () => {
    const r = getPhCategoryForFoodName("some totally made up food name");
    expect(r).toBeNull();
  });
});