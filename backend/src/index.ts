import express from "express";
import type { Request } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

import { pool } from "./database";
import {
  findCachedFoodsByName,
  findFoodByFdcId,
  upsertFoodFromFdc,
  upsertFoodNutrients,
  getFoodWithNutrients,
} from "./foodsRepo";
import {
  scoreFoodForConditionsDb,
  scaleFoodNutrients,
  ConditionId as DbConditionId,
} from "./scoreDb";
import {
  fdcSearchFoods,
  fdcGetFoodDetails,
  mapFdcNutrientsToColumns,
  buildServingOptions,
  servingOptionsNeedRefresh,
  expandedFoodQueries,
  groupFoodSearchMatches,
} from "./fdcClient";
import { edamamSmartSearch, edamamTrialEnabled } from "./edamamClient";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const foodSearchCache = new Map<
  string,
  {
    expiresAt: number;
    general: { fdcId: number; name: string; brand: string | null; dataType: string | null }[];
    other: { fdcId: number; name: string; brand: string | null; dataType: string | null }[];
  }
>();
const FOOD_SEARCH_TTL_MS = 5 * 60 * 1000;
const ALLOWED_CONDITIONS: DbConditionId[] = [
  "KidneyDisease",
  "IC",
  "IBS",
  "Crohns",
  "GERD",
  "Diabetes",
  "Hypertension",
  "HeartHealth",
];

// --------------------
// Password helpers
// --------------------
function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return Promise.resolve(false);
  const salt = parts[1];
  const hashHex = parts[2];

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const a = Buffer.from(hashHex, "hex");
      const b = Buffer.from(derivedKey);
      if (a.length !== b.length) return resolve(false);
      resolve(crypto.timingSafeEqual(a, b));
    });
  });
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sessionSecret() {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production");
  }
  return process.env.JWT_SECRET || "nouri-development-only-change-me";
}

function createSessionToken(userId: string | number) {
  const payload = Buffer.from(
    JSON.stringify({ userId: String(userId), expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authenticatedUserId(req: Request): string | null {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || Number(decoded.expiresAt) <= Math.floor(Date.now() / 1000)) return null;
    return String(decoded.userId);
  } catch {
    return null;
  }
}

// --------------------
// Health
// --------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Nouri API is running" });
});

// --------------------
// Auth
// --------------------
app.post("/auth/signup", async (req, res) => {
  try {
    const { username, password, name } = req.body as {
      username?: string;
      password?: string;
      name?: string;
    };

    const u = String(username ?? "").trim();
    const p = String(password ?? "");
    const n = String(name ?? "").trim();

    if (!n) return res.status(400).json({ error: "name is required" });
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(u)) {
      return res.status(400).json({ error: "invalid username" });
    }
    if (p.length < 6) return res.status(400).json({ error: "password too short" });

    const pwHash = await hashPassword(p);

    const r = await pool.query(
      `INSERT INTO users (username, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, name`,
      [u, n, pwHash]
    );

    const user = r.rows[0];
    res.json({ ...user, token: createSessionToken(user.id) });
  } catch (err: any) {
    if (String(err?.code) === "23505") {
      return res.status(409).json({ error: "username already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    const u = String(username ?? "").trim();
    const p = String(password ?? "");

    const r = await pool.query(
      `SELECT id, username, name, password_hash
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [u]
    );

    const row = r.rows[0];
    if (!row) return res.status(401).json({ error: "invalid credentials" });

    const ok = await verifyPassword(p, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    res.json({ id: row.id, username: row.username, name: row.name, token: createSessionToken(row.id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// --------------------
// Demo user creation (for Guest / quick testing)
// --------------------
app.post("/demo/create-user", async (_req, res) => {
  try {
    const suffix = crypto.randomBytes(3).toString("hex");
    const username = `demo_${suffix}`;
    const name = "Demo User";

    const randomPassword = crypto.randomBytes(12).toString("hex");
    const password_hash = await hashPassword(randomPassword);

    const r = await pool.query(
      `INSERT INTO users (username, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, name`,
      [username, name, password_hash]
    );

    const row = r.rows[0];
    res.json({ user_id: row.id, id: row.id, username: row.username, name: row.name, token: createSessionToken(row.id) });
  } catch (err: any) {
    // If username collides, retry once
    if (String(err?.code) === "23505") {
      try {
        const suffix = crypto.randomBytes(4).toString("hex");
        const username = `demo_${suffix}`;
        const name = "Demo User";

        const randomPassword = crypto.randomBytes(12).toString("hex");
        const password_hash = await hashPassword(randomPassword);

        const r = await pool.query(
          `INSERT INTO users (username, name, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, username, name`,
          [username, name, password_hash]
        );

        const row = r.rows[0];
        return res.json({ user_id: row.id, id: row.id, username: row.username, name: row.name, token: createSessionToken(row.id) });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }

    res.status(500).json({ error: err.message });
  }
});

// --------------------
// User conditions
// --------------------
app.get("/user/conditions", async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });

    const [conditionsResult, profileResult] = await Promise.all([
      pool.query(
        `SELECT user_id, condition_id, kidney_stage, kidney_limit_potassium,
                kidney_limit_phosphorus, crohns_state, ibs_mode
         FROM user_conditions
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(`SELECT doctor_recommendations FROM users WHERE id = $1`, [userId]),
    ]);

    res.json({
      conditions: conditionsResult.rows,
      doctorRecommendations: profileResult.rows[0]?.doctor_recommendations ?? "",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/user/conditions", async (req, res) => {
  const client = await pool.connect();
  try {
    const { conditions, settings, doctorRecommendations } = req.body as {
      conditions?: string[];
      doctorRecommendations?: string;
      settings?: {
        kidneyStage?: number;
        kidneyLimitPotassium?: boolean;
        kidneyLimitPhosphorus?: boolean;
        crohnsState?: string;
        ibsMode?: string;
      };
    };

    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });
    const careNote = String(doctorRecommendations ?? "").trim();
    if (careNote.length > 2000) {
      return res.status(400).json({ error: "Doctor recommendations must be 2,000 characters or fewer" });
    }

    const list = Array.isArray(conditions)
      ? conditions.map(String).filter((condition) => ALLOWED_CONDITIONS.includes(condition as DbConditionId))
      : [];

    await client.query("BEGIN");
    await client.query(`DELETE FROM user_conditions WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE users SET doctor_recommendations = $1 WHERE id = $2`, [careNote || null, userId]);

    for (const c of list) {
      await client.query(
        `INSERT INTO user_conditions
          (user_id, condition_id, kidney_stage, kidney_limit_potassium,
           kidney_limit_phosphorus, crohns_state, ibs_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, condition_id) DO NOTHING`,
        [
          userId,
          c,
          c === "KidneyDisease" ? settings?.kidneyStage ?? null : null,
          c === "KidneyDisease" ? settings?.kidneyLimitPotassium ?? false : null,
          c === "KidneyDisease" ? settings?.kidneyLimitPhosphorus ?? false : null,
          c === "Crohns" ? settings?.crohnsState ?? null : null,
          c === "IBS" ? settings?.ibsMode ?? null : null,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --------------------
// Food search + import
// --------------------
app.get("/foods/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "q is required" });
    if (q.length > 80) return res.status(400).json({ error: "Search is too long" });

    const smartSearchEnabled = edamamTrialEnabled();
    const smartSearchPromise = smartSearchEnabled
      ? edamamSmartSearch(q)
          .then((matches) => ({ matches, warning: undefined as string | undefined }))
          .catch(() => ({
            matches: [],
            warning: "The optional smart-search preview is unavailable, but USDA search still works.",
          }))
      : Promise.resolve({ matches: [], warning: undefined as string | undefined });

    const cachedMatches = await findCachedFoodsByName(q);
    // Do not send legacy portion choices to the app. The matching USDA result
    // will be imported again and repaired as soon as the user selects it.
    const usableCachedMatches = cachedMatches.filter(
      (food) => food.source !== "fdc" || !servingOptionsNeedRefresh(food.name, food.serving_options)
    );
    const familyQueries = expandedFoodQueries(q);
    const canonicalSearchWords = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
          if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
          if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
          if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
          return word;
        })
        .join(" ");
    const normalizedQuery = canonicalSearchWords(q);
    const exactCached = usableCachedMatches.find((food) => {
      const name = canonicalSearchWords(food.name);
      return (
        familyQueries.length === 0 &&
        food.source === "fdc" &&
        food.serving_options?.length > 0 &&
        (name === normalizedQuery || name.startsWith(`${normalizedQuery} `))
      );
    });
    let cached = (exactCached ? [exactCached] : usableCachedMatches.slice(0, 1));

    let fdcGeneral: { fdcId: number; name: string; brand: string | null; dataType: string | null }[] = [];
    let otherFdc: { fdcId: number; name: string; brand: string | null; dataType: string | null }[] = [];
    let sourceWarning: string | undefined;
    const cacheKey = canonicalSearchWords(q);
    const cachedSearch = foodSearchCache.get(cacheKey);
    if (cachedSearch && cachedSearch.expiresAt > Date.now()) {
      fdcGeneral = cachedSearch.general;
      otherFdc = cachedSearch.other;
    } else {
      try {
        const queries = [q, ...familyQueries];
        let foods = (
          await Promise.all(
            queries.map((query, index) =>
              fdcSearchFoods(query, index === 0 ? 50 : 14, ["Foundation", "SR Legacy", "Survey (FNDDS)"])
            )
          )
        ).flat();
        if (!foods.length) foods = await fdcSearchFoods(q, 30);
        const grouped = groupFoodSearchMatches(q, foods);
        const toResult = (food: (typeof foods)[number]) => ({
          fdcId: food.fdcId,
          name: food.description,
          brand: food.brandName ?? null,
          dataType: food.dataType ?? null,
        });
        fdcGeneral = grouped.general.map(toResult);
        otherFdc = grouped.other.map(toResult);
        foodSearchCache.set(cacheKey, {
          expiresAt: Date.now() + FOOD_SEARCH_TTL_MS,
          general: fdcGeneral,
          other: otherFdc,
        });
      } catch (error) {
        if (!cached.length) throw error;
        sourceWarning = "USDA search is temporarily unavailable, so these are saved matches.";
      }
    }

    // A generic USDA result is preferable to an approximate demo fallback.
    if (
      fdcGeneral.length &&
      (cached[0]?.source !== "fdc" || !cached[0]?.serving_options?.length)
    ) cached = [];

    const cachedFdcIds = new Set(cached.map((food) => Number(food.fdc_id)).filter(Number.isFinite));
    const remainingSlots = Math.max(0, 4 - cached.length);
    const fdc = fdcGeneral.filter((food) => !cachedFdcIds.has(food.fdcId)).slice(0, remainingSlots);
    const generalFdcIds = new Set(fdc.map((food) => food.fdcId));
    const otherForms = otherFdc.filter(
      (food) => !cachedFdcIds.has(food.fdcId) && !generalFdcIds.has(food.fdcId)
    );
    const smartSearch = await smartSearchPromise;
    res.json({
      cached,
      fdc,
      otherFdc: otherForms,
      smartSearch: {
        enabled: smartSearchEnabled,
        provider: "edamam",
        matches: smartSearch.matches,
        ...(smartSearch.warning ? { warning: smartSearch.warning } : {}),
      },
      generalized: true,
      message: "Showing the most useful general choices first. Additional forms are available separately.",
      ...(sourceWarning ? { sourceWarning } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/foods/import", async (req, res) => {
  try {
    const { fdcId, forceRefresh } = req.body as { fdcId?: number; forceRefresh?: boolean };
    if (typeof fdcId !== "number") {
      return res.status(400).json({ error: "fdcId (number) is required" });
    }

    const existing = await findFoodByFdcId(fdcId);
    if (
      existing &&
      !forceRefresh &&
      !servingOptionsNeedRefresh(existing.name, existing.serving_options)
    ) {
      return res.json({ food: existing, cached: true, refreshed: false });
    }

    const details = await fdcGetFoodDetails(fdcId);

    const foodRow = await upsertFoodFromFdc({
      name: details.description,
      brand: details.brandName ?? null,
      fdcId: details.fdcId,
      dataType: details.dataType ?? null,
      servingOptions: buildServingOptions(details),
    });

    const mapped = mapFdcNutrientsToColumns(details);
    await upsertFoodNutrients(foodRow.food_id, mapped);

    res.json({ food: foodRow, cached: !!existing, refreshed: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Feedback + history
// --------------------
app.post("/user/feedback", async (req, res) => {
  try {
    const { foodId, conditionId, feedback, note } = req.body as {
      foodId?: string;
      conditionId?: string;
      feedback?: "safe" | "trigger";
      note?: string;
    };

    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });
    if (!foodId || !conditionId) {
      return res.status(400).json({ error: "foodId and conditionId are required" });
    }
    if (!ALLOWED_CONDITIONS.includes(conditionId as DbConditionId)) {
      return res.status(400).json({ error: "conditionId is not supported" });
    }

    const fb = String(feedback ?? "").toLowerCase();
    if (!["safe", "trigger"].includes(fb)) {
      return res.status(400).json({ error: "feedback must be safe or trigger" });
    }

    const r = await pool.query(
      `INSERT INTO user_food_feedback (user_id, food_id, condition_id, feedback, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, food_id, condition_id)
       DO UPDATE SET feedback = EXCLUDED.feedback,
                     note = EXCLUDED.note
       RETURNING user_id, food_id, condition_id, feedback, note`,
      [userId, foodId, conditionId, fb, note ?? null]
    );

    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/user/feedback", async (req, res) => {
  try {
    const { foodId, conditionId } = req.body as {
      foodId?: string;
      conditionId?: string;
    };
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });
    if (!foodId || !conditionId) {
      return res.status(400).json({ error: "foodId and conditionId are required" });
    }
    if (!ALLOWED_CONDITIONS.includes(conditionId as DbConditionId)) {
      return res.status(400).json({ error: "conditionId is not supported" });
    }

    await pool.query(
      `DELETE FROM user_food_feedback
       WHERE user_id = $1 AND food_id = $2 AND condition_id = $3`,
      [userId, foodId, conditionId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/user/history", async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });

    const r = await pool.query(
      `SELECT uf.food_id,
              f.name AS food_name,
              MAX(uf.created_at) AS last_seen
       FROM user_food_feedback uf
       JOIN foods f ON f.id = uf.food_id
       WHERE uf.user_id = $1
       GROUP BY uf.food_id, f.name
       ORDER BY last_seen DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ items: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/user/account", async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "A valid login is required" });

    const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
    if (!result.rows[0]) return res.status(404).json({ error: "Account not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Scoring
// --------------------
app.post("/score-food", async (req, res) => {
  try {
    const { foodId, conditions, settings, servingGrams, servingLabel } = req.body as {
      foodId?: string;
      conditions?: string[];
      settings?: any;
      servingGrams?: number;
      servingLabel?: string;
    };

    if (!foodId) return res.status(400).json({ error: "foodId is required" });

    const conditionIds: DbConditionId[] = Array.isArray(conditions)
      ? (conditions as string[]).filter((c): c is DbConditionId =>
          ALLOWED_CONDITIONS.includes(c as DbConditionId)
        )
      : [];

    const food = await getFoodWithNutrients(foodId);
    if (!food) return res.status(404).json({ error: `No food found for id ${foodId}` });

    const grams = Math.min(2000, Math.max(1, Number(servingGrams) || 100));
    const selectedServingLabel = String(servingLabel || `${Math.round(grams)} g`).slice(0, 80);
    const servingFood = scaleFoodNutrients(food, grams);

    const score = await scoreFoodForConditionsDb(
      servingFood,
      conditionIds,
      settings ?? {},
      authenticatedUserId(req) ?? undefined
    );

    res.json({
      food: {
        food_id: food.food_id,
        name: food.name,
        brand: food.brand,
        fdc_id: food.fdc_id,
        source: food.source,
        data_type: food.data_type,
        serving_options: food.serving_options,
      },
      conditions: conditionIds,
      rating: score.rating,
      reasons: score.reasons,
      condition_results: score.condition_results,
      serving: { label: selectedServingLabel, grams },
      nutrition_basis:
        food.source === "fdc"
          ? `Estimated for ${selectedServingLabel} (${Math.round(grams)} g) from USDA per-100-g data`
          : `Estimated for ${selectedServingLabel} (${Math.round(grams)} g) from approximate per-100-g data`,
      ibs_guidance: score.ibs_guidance,
      nutrients: {
        calories_kcal: servingFood.calories_kcal,
        protein_g: servingFood.protein_g,
        carbs_g: servingFood.carbs_g,
        fat_g: servingFood.fat_g,
        sodium_mg: servingFood.sodium_mg,
        potassium_mg: servingFood.potassium_mg,
        phosphorus_mg: servingFood.phosphorus_mg,
        fiber_g: servingFood.fiber_g,
        total_sugars_g: servingFood.total_sugars_g,
        added_sugars_g: servingFood.added_sugars_g,
        saturated_fat_g: servingFood.saturated_fat_g,
        cholesterol_mg: servingFood.cholesterol_mg,
        calcium_mg: servingFood.calcium_mg,
        iron_mg: servingFood.iron_mg,
        vitamin_d_mcg: servingFood.vitamin_d_mcg,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}
