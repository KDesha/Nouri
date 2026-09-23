import {
  edamamSmartSearch,
  edamamTrialEnabled,
  normalizeEdamamMatches,
} from "./src/edamamClient";

describe("Edamam trial search", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("stays off unless the explicit trial flag and both credentials are present", () => {
    process.env.EDAMAM_TRIAL_ENABLED = "true";
    delete process.env.EDAMAM_APP_ID;
    delete process.env.EDAMAM_APP_KEY;
    expect(edamamTrialEnabled()).toBe(false);

    process.env.EDAMAM_APP_ID = "demo-id";
    process.env.EDAMAM_APP_KEY = "demo-key";
    expect(edamamTrialEnabled()).toBe(true);
  });

  test("puts the parsed match first and keeps only simple live preview data", () => {
    const matches = normalizeEdamamMatches({
      parsed: [
        {
          food: { foodId: "food_banana_pudding", label: "Banana pudding", category: "Generic meals" },
          quantity: 2,
          measure: { label: "Cup" },
        },
      ],
      hints: [
        {
          food: { foodId: "food_banana_pudding", label: "Banana pudding", category: "Generic meals" },
          measures: [
            { label: "Cup", weight: 190 },
            { label: "Gram", weight: 1 },
          ],
        },
        {
          food: { foodId: "food_banana", label: "Banana", category: "Generic foods" },
          measures: [{ label: "Whole", weight: 118 }],
        },
      ],
    });

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      foodId: "food_banana_pudding",
      label: "Banana pudding",
      parsedQuantity: 2,
      parsedMeasure: "cup",
      portions: [
        { label: "1 cup", grams: 190 },
        { label: "1 gram", grams: 1 },
      ],
    });
  });

  test("sends credentials only from the backend and returns normalized results", async () => {
    process.env.EDAMAM_TRIAL_ENABLED = "true";
    process.env.EDAMAM_APP_ID = "demo-id";
    process.env.EDAMAM_APP_KEY = "demo-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        parsed: [
          {
            food: { foodId: "food_chicken", label: "Chicken" },
            quantity: 1,
            measure: { label: "Whole" },
          },
        ],
        hints: [],
      }),
    } as any);

    const matches = await edamamSmartSearch("1 whole chicken");
    expect(matches[0]).toMatchObject({ label: "Chicken", parsedQuantity: 1, parsedMeasure: "whole" });

    const requestedUrl = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl).toContain("app_id=demo-id");
    expect(requestedUrl).toContain("app_key=demo-key");
    expect(requestedUrl).toContain("ingr=1+whole+chicken");
    expect(requestedUrl).toContain("nutrition-type=logging");
  });
});
