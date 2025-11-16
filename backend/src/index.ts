import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware: allow CORS and JSON bodies
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Condition Nutrition API is running" });
});

// Mock scoring endpoint
app.post("/score-food", (req, res) => {
  const { foodName, conditions } = req.body;

  const food: string = foodName || "banana";
  const userConditions: string[] = conditions || [];

  let rating: "eat" | "limit" | "avoid" = "eat";
  const reasons: string[] = [];

  // Mock CKD logic
  if (userConditions.includes("ckd")) {
    if (food.toLowerCase().includes("banana")) {
      rating = "avoid";
      reasons.push("High potassium content is not ideal for CKD (mock logic).");
    } else {
      reasons.push("Food seems okay for CKD in this mock logic.");
    }
  }

  // Mock bladder logic
  if (userConditions.includes("bladder")) {
    if (food.toLowerCase().includes("banana")) {
      reasons.push("Generally bladder-friendly, non-acidic fruit (mock logic).");
    } else {
      reasons.push("No major bladder triggers detected in this mock logic.");
    }
  }

  if (userConditions.length === 0) {
    reasons.push("No conditions provided, treating as neutral food (mock logic).");
  }

  res.json({
    food,
    conditions: userConditions,
    rating,
    reasons,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});