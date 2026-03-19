// src/rules.ts

import type { NutrientInfo } from "./nutritionData";

export type ConditionId = "ckd" | "bladder";

export type Rating = "eat" | "limit" | "avoid";

export type ScoreResult = {
  rating: Rating;
  reasons: string[];
};

type MutableScore = {
  rating: Rating;
  reasons: string[];
};

// Helper: rating severity order
const RATING_ORDER: Rating[] = ["eat", "limit", "avoid"];

function worsenRating(current: Rating, next: Rating): Rating {
  return RATING_ORDER[
    Math.max(RATING_ORDER.indexOf(current), RATING_ORDER.indexOf(next))
  ];
}

// --- CKD rules (very simplified demo) ---
// We'll treat potassium > 300 mg as "high" and sodium > 300 mg as "high" for now.

function applyCkdRules(score: MutableScore, nutrients: NutrientInfo) {
  const { potassiumMg, sodiumMg } = nutrients;

  if (potassiumMg > 300) {
    score.rating = worsenRating(score.rating, "avoid");
    score.reasons.push(
      `High potassium (${potassiumMg} mg) is not ideal for CKD in this demo logic.`
    );
  } else if (potassiumMg > 200) {
    score.rating = worsenRating(score.rating, "limit");
    score.reasons.push(
      `Moderate potassium (${potassiumMg} mg); may need to limit for CKD.`
    );
  } else {
    score.reasons.push(
      `Potassium (${potassiumMg} mg) is in a lower range for CKD in this demo logic.`
    );
  }

  if (sodiumMg > 300) {
    score.rating = worsenRating(score.rating, "avoid");
    score.reasons.push(
      `High sodium (${sodiumMg} mg); sodium restriction is common in CKD.`
    );
  } else if (sodiumMg > 150) {
    score.rating = worsenRating(score.rating, "limit");
    score.reasons.push(
      `Moderate sodium (${sodiumMg} mg); consider limiting intake.`
    );
  }
}

// --- Bladder / IC rules (simplified) ---

function applyBladderRules(score: MutableScore, nutrients: NutrientInfo) {
  if (nutrients.acidic) {
    score.rating = worsenRating(score.rating, "limit");
    score.reasons.push(
      "Marked as acidic; acidic foods can be bothersome for sensitive bladders."
    );
  } else {
    score.reasons.push(
      "Not marked as acidic in this demo logic; may be more bladder-friendly."
    );
  }
}

// Main scoring function

export function scoreFoodForConditions(
  nutrients: NutrientInfo,
  conditions: ConditionId[]
): ScoreResult {
  const score: MutableScore = {
    rating: "eat",
    reasons: [],
  };

  if (conditions.includes("ckd")) {
    applyCkdRules(score, nutrients);
  }

  if (conditions.includes("bladder")) {
    applyBladderRules(score, nutrients);
  }

  if (conditions.length === 0) {
    score.reasons.push("No conditions provided; treating as a general food.");
  }

  return score;
}
