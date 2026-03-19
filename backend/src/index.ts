import express from "express";
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
import { scoreFoodForConditionsDb, ConditionId as DbConditionId } from "./scoreDb";
import { fdcSearchFoods, fdcGetFoodDetails, mapFdcNutrientsToColumns } from "./fdcClient";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

    res.json(r.rows[0]);
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

    res.json({ id: row.id, username: row.username, name: row.name });
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
    res.json({ user_id: row.id, id: row.id, username: row.username, name: row.name });
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
        return res.json({ user_id: row.id, id: row.id, username: row.username, name: row.name });
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
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const r = await pool.query(
      `SELECT user_id, condition_id, kidney_stage, crohns_state, ibs_mode
       FROM user_conditions
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ conditions: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/user/conditions", async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, conditions, settings } = req.body as {
      userId?: string;
      conditions?: string[];
      settings?: { kidneyStage?: number; crohnsState?: string; ibsMode?: string };
    };

    if (!userId) return res.status(400).json({ error: "userId is required" });

    const list = Array.isArray(conditions) ? conditions.map(String) : [];

    await client.query("BEGIN");
    await client.query(`DELETE FROM user_conditions WHERE user_id = $1`, [userId]);

    for (const c of list) {
      await client.query(
        `INSERT INTO user_conditions (user_id, condition_id, kidney_stage, crohns_state, ibs_mode)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, condition_id) DO NOTHING`,
        [
          userId,
          c,
          c === "KidneyDisease" ? settings?.kidneyStage ?? null : null,
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

    const cached = await findCachedFoodsByName(q);

    let fdcResults: any[] = [];
    if (cached.length < 10) {
      const foods = await fdcSearchFoods(q, 10);
      fdcResults = foods.map((f) => ({
        fdcId: f.fdcId,
        name: f.description,
        brand: f.brandName ?? null,
        dataType: f.dataType ?? null,
      }));
    }

    res.json({ cached, fdc: fdcResults });
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
    if (existing && !forceRefresh) {
      return res.json({ food: existing, cached: true, refreshed: false });
    }

    const details = await fdcGetFoodDetails(fdcId);

    const foodRow = await upsertFoodFromFdc({
      name: details.description,
      brand: details.brandName ?? null,
      fdcId: details.fdcId,
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
    const { userId, foodId, conditionId, feedback, note } = req.body as {
      userId?: string;
      foodId?: string;
      conditionId?: string;
      feedback?: "safe" | "trigger";
      note?: string;
    };

    if (!userId || !foodId || !conditionId) {
      return res.status(400).json({ error: "userId, foodId, conditionId are required" });
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

app.get("/user/history", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ error: "userId is required" });

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

// --------------------
// Scoring
// --------------------
const ALLOWED_CONDITIONS: DbConditionId[] = ["KidneyDisease", "IC", "IBS", "Crohns"];

app.post("/score-food", async (req, res) => {
  try {
    const { foodId, conditions, settings, userId } = req.body as {
      foodId?: string;
      conditions?: string[];
      settings?: any;
      userId?: string;
    };

    if (!foodId) return res.status(400).json({ error: "foodId is required" });

    const conditionIds: DbConditionId[] = Array.isArray(conditions)
      ? (conditions as string[]).filter((c): c is DbConditionId =>
          ALLOWED_CONDITIONS.includes(c as DbConditionId)
        )
      : [];

    const food = await getFoodWithNutrients(foodId);
    if (!food) return res.status(404).json({ error: `No food found for id ${foodId}` });

    const score = await scoreFoodForConditionsDb(
      food as any,
      conditionIds,
      settings ?? {},
      userId
    );

    res.json({
      food: {
        food_id: food.food_id,
        name: food.name,
        brand: food.brand,
        fdc_id: food.fdc_id,
        source: food.source,
      },
      conditions: conditionIds,
      rating: score.rating,
      reasons: score.reasons,
      nutrients: {
        calories_kcal: (food as any).calories_kcal,
        protein_g: (food as any).protein_g,
        carbs_g: (food as any).carbs_g,
        fat_g: (food as any).fat_g,
        sodium_mg: (food as any).sodium_mg,
        potassium_mg: (food as any).potassium_mg,
        phosphorus_mg: (food as any).phosphorus_mg,
        fiber_g: (food as any).fiber_g,
        added_sugars_g: (food as any).added_sugars_g,
        saturated_fat_g: (food as any).saturated_fat_g,
        acidic: (food as any).acidic,

        // ✅ Local pH category + note
        ph_category: score.ph_category ?? null,
        ph_note: score.ph_note ?? null,
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