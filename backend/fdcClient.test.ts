import {
  buildServingOptions,
  expandedFoodQueries,
  groupFoodSearchMatches,
  rankGeneralFoodMatches,
  servingOptionsNeedRefresh,
} from "./src/fdcClient";

describe("generalized USDA search", () => {
  test("prefers a generic banana over branded banana products", () => {
    const ranked = rankGeneralFoodMatches("banana", [
      { fdcId: 1, description: "BANANA CHOCOLATE SNACK", brandName: "Snack Co", dataType: "Branded" },
      { fdcId: 2, description: "Bananas, raw", dataType: "SR Legacy" },
      { fdcId: 3, description: "Banana pudding", dataType: "Survey (FNDDS)" },
    ]);
    expect(ranked[0].fdcId).toBe(2);
    expect(ranked).toHaveLength(3);
  });

  test("deduplicates singular and plural versions of the same generic match", () => {
    const ranked = rankGeneralFoodMatches("banana", [
      { fdcId: 1, description: "Bananas, raw", dataType: "SR Legacy" },
      { fdcId: 2, description: "Banana, raw", dataType: "Foundation" },
      { fdcId: 3, description: "Banana, baked", dataType: "Survey (FNDDS)" },
    ]);
    expect(ranked.map((food) => food.description)).toEqual(["Banana, raw", "Banana, baked"]);
  });

  test("provides simple banana size choices with gram weights", () => {
    const options = buildServingOptions({ fdcId: 2, description: "Bananas, raw" });
    expect(options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["1 small banana", "1 medium banana", "1 large banana"])
    );
    expect(options.find((option) => option.id === "medium")?.grams).toBe(118);
  });

  test("uses USDA household portions for other foods", () => {
    const options = buildServingOptions({
      fdcId: 9,
      description: "Rice, cooked",
      foodPortions: [{ gramWeight: 158, portionDescription: "1 cup cooked" }],
    });
    expect(options[0]).toMatchObject({ label: "1 cup cooked", grams: 158 });
  });

  test("does not give banana pudding whole-banana size choices", () => {
    const options = buildServingOptions({
      fdcId: 10,
      description: "Banana pudding",
      foodPortions: [{ gramWeight: 190, portionDescription: "1 cup" }],
    });
    expect(options).toEqual([{ id: "1-cup-190", label: "1 cup", grams: 190 }]);
  });

  test("replaces the technical RACC abbreviation with a simple serving label", () => {
    const options = buildServingOptions({
      fdcId: 11,
      description: "Tomato, roma",
      foodPortions: [{ gramWeight: 85, portionDescription: "1 RACC" }],
    });
    expect(options[0]).toMatchObject({ label: "1 serving", grams: 85 });
    expect(servingOptionsNeedRefresh("Tomato, roma", [{ id: "old", label: "1 RACC", grams: 85 }])).toBe(true);
  });

  test("refreshes cached banana presets that leaked onto prepared foods", () => {
    expect(
      servingOptionsNeedRefresh("Banana pudding", [{ id: "medium", label: "1 medium banana", grams: 118 }])
    ).toBe(true);
    expect(
      servingOptionsNeedRefresh("Bananas, raw", [{ id: "medium", label: "1 medium banana", grams: 118 }])
    ).toBe(false);
  });

  test("groups broad chicken searches by useful cuts", () => {
    const grouped = groupFoodSearchMatches("chicken", [
      { fdcId: 1, description: "Chicken spread", dataType: "SR Legacy" },
      { fdcId: 2, description: "Chicken, breast, boneless, skinless, raw", dataType: "Foundation" },
      { fdcId: 3, description: "Chicken, thigh, boneless, skinless, raw", dataType: "Foundation" },
      { fdcId: 4, description: "Chicken, broilers or fryers, leg, meat only, raw", dataType: "SR Legacy" },
      { fdcId: 5, description: "Chicken wing, rotisserie", dataType: "Survey (FNDDS)" },
      { fdcId: 6, description: "Chicken feet", dataType: "Survey (FNDDS)" },
    ]);
    expect(grouped.general.map((food) => food.fdcId)).toEqual([2, 3, 4, 5]);
    expect(grouped.other.map((food) => food.fdcId)).toEqual(expect.arrayContaining([1, 6]));
    expect(expandedFoodQueries("chicken")).toContain("chicken breast raw");
  });

  test("groups tomato varieties while keeping prepared products in other forms", () => {
    const grouped = groupFoodSearchMatches("tomato", [
      { fdcId: 1, description: "Tomatoes, raw", dataType: "Survey (FNDDS)" },
      { fdcId: 2, description: "Tomato, roma", dataType: "Foundation" },
      { fdcId: 3, description: "Tomatoes, grape, raw", dataType: "Foundation" },
      { fdcId: 4, description: "Tomatoes, green, raw", dataType: "SR Legacy" },
      { fdcId: 5, description: "Soup, tomato", dataType: "Survey (FNDDS)" },
    ]);
    expect(grouped.general.map((food) => food.fdcId)).toEqual([1, 2, 3, 4]);
    expect(grouped.other.map((food) => food.fdcId)).toContain(5);
  });
});
