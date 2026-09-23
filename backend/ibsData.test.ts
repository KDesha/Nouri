import { assessFoodForIbs } from "./src/ibsData";

describe("IBS and FODMAP name screening", () => {
  test("identifies a common high-FODMAP food and its group", () => {
    const result = assessFoodForIbs("Fresh garlic cloves", "lowFODMAP");
    expect(result.fodmap_level).toBe("high");
    expect(result.fodmap_groups).toContain("fructans");
    expect(result.portion_sensitive).toBe(true);
  });

  test("identifies a straightforward lower-FODMAP single food", () => {
    const result = assessFoodForIbs("plain white rice", "lowFODMAP");
    expect(result.fodmap_level).toBe("low");
  });

  test("does not overstate mixed-food certainty", () => {
    const result = assessFoodForIbs("seasoned chicken meal", "lowFODMAP");
    expect(result.fodmap_level).toBe("unknown");
  });

  test("flags portion-sensitive foods when a name is insufficient", () => {
    const result = assessFoodForIbs("Bananas, raw", "general");
    expect(result.fodmap_level).toBe("unknown");
    expect(result.portion_sensitive).toBe(true);
    expect(result.summary).toMatch(/portion size or ripeness/i);
  });

  test("keeps non-FODMAP triggers separate", () => {
    const result = assessFoodForIbs("black coffee", "general");
    expect(result.common_triggers).toContain("caffeine");
  });
});
