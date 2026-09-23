import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiErrorMessage, apiRequest } from "./api";
import { COLORS, SHADOW, TYPE } from "./theme";

type ConditionId =
  | "KidneyDisease"
  | "IC"
  | "IBS"
  | "Crohns"
  | "GERD"
  | "Diabetes"
  | "Hypertension"
  | "HeartHealth";
type Rating = "eat" | "limit" | "avoid" | "unknown";
type IbsMode = "general" | "lowFODMAP" | "reintroduction" | "personalization";

type ServingOption = { id: string; label: string; grams: number };

type FoodItem = {
  food_id: string;
  name: string;
  brand: string | null;
  source: string;
  fdc_id: string | number | null;
  data_type?: string | null;
  serving_options?: ServingOption[];
};

type SearchResponse = {
  cached: FoodItem[];
  fdc: {
    fdcId: number;
    name: string;
    brand: string | null;
    dataType: string | null;
  }[];
  otherFdc: {
    fdcId: number;
    name: string;
    brand: string | null;
    dataType: string | null;
  }[];
  smartSearch?: {
    enabled: boolean;
    provider: "edamam";
    warning?: string;
    matches: {
      foodId: string;
      label: string;
      knownAs: string | null;
      brand: string | null;
      category: string | null;
      categoryLabel: string | null;
      parsedQuantity: number | null;
      parsedMeasure: string | null;
      portions: { label: string; grams: number }[];
    }[];
  };
  sourceWarning?: string;
  generalized?: boolean;
  message?: string;
};

type Nutrients = {
  calories_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sodium_mg?: number | null;
  potassium_mg?: number | null;
  phosphorus_mg?: number | null;
  fiber_g?: number | null;
  total_sugars_g?: number | null;
  added_sugars_g?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_d_mcg?: number | null;
};

type IbsGuidance = {
  phase: IbsMode;
  fodmap_level: "low" | "high" | "unknown";
  fodmap_groups: string[];
  portion_sensitive: boolean;
  summary: string;
};

type ScoreResponse = {
  food: FoodItem;
  conditions: ConditionId[];
  rating: Rating;
  reasons: string[];
  condition_results: {
    condition: ConditionId;
    rating: Rating;
    confidence: "low" | "moderate" | "high";
    reasons: string[];
  }[];
  serving: { label: string; grams: number };
  nutrients: Nutrients;
  nutrition_basis?: string;
  ibs_guidance?: IbsGuidance | null;
};

type SavedCondition = {
  condition_id: ConditionId;
  kidney_stage?: number | null;
  kidney_limit_potassium?: boolean | null;
  kidney_limit_phosphorus?: boolean | null;
  crohns_state?: "stable" | "flare" | null;
  ibs_mode?: IbsMode | null;
};

type AccountPreferences = {
  conditions: SavedCondition[];
  doctorRecommendations?: string;
};

const CONDITIONS: { id: ConditionId; label: string; icon: string }[] = [
  { id: "IBS", label: "IBS", icon: "🌿" },
  { id: "IC", label: "Bladder / IC", icon: "💧" },
  { id: "KidneyDisease", label: "Kidney health", icon: "🫘" },
  { id: "Crohns", label: "Crohn’s", icon: "☀️" },
  { id: "GERD", label: "GERD / reflux", icon: "🔥" },
  { id: "Diabetes", label: "Diabetes", icon: "🩸" },
  { id: "Hypertension", label: "Blood pressure", icon: "❤️" },
  { id: "HeartHealth", label: "Heart health", icon: "🫀" },
];

const IBS_PHASES: { id: IbsMode; label: string; description: string }[] = [
  { id: "general", label: "Everyday", description: "Notice common triggers and fiber." },
  { id: "lowFODMAP", label: "Step 1 · Swap", description: "Short-term low-FODMAP swaps." },
  { id: "reintroduction", label: "Step 2 · Test", description: "Reintroduce one FODMAP group at a time." },
  { id: "personalization", label: "Step 3 · Personalize", description: "Use your own safe and trigger history." },
];

const QUICK_SEARCHES = ["banana", "chicken", "oatmeal", "tomato"];

function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  compact = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger" | "quiet";
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === "primary" && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "danger" && styles.buttonDanger,
        variant === "quiet" && styles.buttonQuiet,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && styles.buttonTextLight,
          variant === "danger" && styles.buttonTextLight,
          variant === "outline" && styles.buttonTextGreen,
          variant === "quiet" && styles.buttonTextMuted,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}>
        <Text style={styles.sectionIconText}>{icon}</Text>
      </View>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FoodRow({
  name,
  detail,
  action,
  onPress,
  disabled,
}: {
  name: string;
  detail: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.foodRow, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.foodAvatar}>
        <Text style={styles.foodAvatarText}>🍽️</Text>
      </View>
      <View style={styles.foodCopy}>
        <Text numberOfLines={2} style={styles.foodName}>{name}</Text>
        <Text numberOfLines={1} style={styles.foodDetail}>{detail}</Text>
      </View>
      <Text style={styles.foodAction}>{action}</Text>
    </Pressable>
  );
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return decimals === 0 ? String(Math.round(Number(value))) : Number(value).toFixed(decimals);
}

function decimalInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  return decimalParts.length ? `${whole}.${decimalParts.join("").slice(0, 2)}` : whole;
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function displayQuantity(value: number) {
  if (value === 0.25) return "¼";
  if (value === 0.5) return "½";
  if (value === 0.75) return "¾";
  if (value === 1.5) return "1½";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function smartMatchDetail(match: NonNullable<SearchResponse["smartSearch"]>["matches"][number]) {
  const interpretation =
    match.parsedQuantity && match.parsedMeasure
      ? `Understood ${displayQuantity(match.parsedQuantity)} ${match.parsedMeasure}`
      : null;
  const type = match.brand || match.categoryLabel || match.category;
  const portion = match.portions.find((item) => !/^1 gram$/i.test(item.label));
  return [interpretation, type, portion ? `${portion.label} ≈ ${Math.round(portion.grams)} g` : null]
    .filter(Boolean)
    .join(" · ");
}

function labelForQuantity(portion: ServingOption, quantity: number) {
  if (quantity === 1) return portion.label;
  const simpleUnit = portion.label.match(
    /^1\s+(cup|serving|slice|piece|tablespoon|teaspoon|ounce|bowl|container|package)(\b.*)$/i
  );
  if (!simpleUnit) return `${displayQuantity(quantity)} × ${portion.label}`;

  const pluralUnits: Record<string, string> = {
    bowl: "bowls",
    container: "containers",
    cup: "cups",
    ounce: "ounces",
    package: "packages",
    piece: "pieces",
    serving: "servings",
    slice: "slices",
    tablespoon: "tablespoons",
    teaspoon: "teaspoons",
  };
  const unit = simpleUnit[1].toLowerCase();
  return `${displayQuantity(quantity)} ${pluralUnits[unit]}${simpleUnit[2]}`;
}

function NutrientRow({
  label,
  value,
  unit,
  decimals = 1,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  decimals?: number;
}) {
  const shown = formatNumber(value, decimals);
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={[styles.nutrientValue, shown === "—" && styles.missingValue]}>
        {shown}{shown === "—" ? "" : ` ${unit}`}
      </Text>
    </View>
  );
}

function MacroTile({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <View style={styles.macroTile}>
      <Text style={styles.macroValue}>{formatNumber(value, label === "Calories" ? 0 : 1)}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function ratingContent(rating: Rating) {
  if (rating === "eat") {
    return { label: "No major flags found", emoji: "🌱", bg: COLORS.successSoft, color: COLORS.success };
  }
  if (rating === "limit") {
    return { label: "Worth a closer look", emoji: "👀", bg: COLORS.warningSoft, color: COLORS.warning };
  }
  if (rating === "avoid") {
    return { label: "Strong flag or personal trigger", emoji: "✋", bg: COLORS.dangerSoft, color: COLORS.danger };
  }
  return { label: "More detail needed", emoji: "🔎", bg: COLORS.surfaceSoft, color: COLORS.greenSoft };
}

export default function DemoScreen({
  initialUserId,
  headerName,
  sessionToken,
  onLogout,
}: {
  initialUserId?: string;
  headerName?: string;
  sessionToken?: string;
  onLogout?: () => void;
}) {
  const userId = initialUserId ?? "";
  const isSignedIn = !!userId && !!sessionToken;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [otherFormsVisible, setOtherFormsVisible] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServing, setSelectedServing] = useState<ServingOption | null>(null);
  const [servingQuantity, setServingQuantity] = useState("1");
  const [usingCustomGrams, setUsingCustomGrams] = useState(false);
  const [customGrams, setCustomGrams] = useState("");
  const [conditions, setConditions] = useState<ConditionId[]>(isSignedIn ? [] : ["IBS"]);
  const [kidneyStage, setKidneyStage] = useState(3);
  const [kidneyLimitPotassium, setKidneyLimitPotassium] = useState(false);
  const [kidneyLimitPhosphorus, setKidneyLimitPhosphorus] = useState(false);
  const [crohnsState, setCrohnsState] = useState<"stable" | "flare">("stable");
  const [ibsMode, setIbsMode] = useState<IbsMode>("general");
  const [feedbackCondition, setFeedbackCondition] = useState<ConditionId>("IBS");
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [scoring, setScoring] = useState(false);
  const [savingReaction, setSavingReaction] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(isSignedIn);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [doctorRecommendations, setDoctorRecommendations] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const settings = useMemo(
    () => ({ kidneyStage, kidneyLimitPotassium, kidneyLimitPhosphorus, crohnsState, ibsMode }),
    [kidneyStage, kidneyLimitPotassium, kidneyLimitPhosphorus, crohnsState, ibsMode]
  );

  const hasIBS = conditions.includes("IBS");
  const hasKidney = conditions.includes("KidneyDisease");
  const hasCrohns = conditions.includes("Crohns");
  const quantity = positiveNumber(servingQuantity);
  const enteredGrams = positiveNumber(customGrams);
  const effectiveServingGrams = selectedServing
    ? usingCustomGrams
      ? enteredGrams
      : quantity
        ? selectedServing.grams * quantity
        : null
    : null;
  const effectiveServingLabel = selectedServing
    ? usingCustomGrams && enteredGrams
      ? `${displayQuantity(enteredGrams)} g`
      : quantity
        ? labelForQuantity(selectedServing, quantity)
        : selectedServing.label
    : "";
  const hasValidServingAmount =
    effectiveServingGrams !== null && effectiveServingGrams > 0 && effectiveServingGrams <= 2000;

  function resetServingAmount() {
    setSelectedServing(null);
    setServingQuantity("1");
    setUsingCustomGrams(false);
    setCustomGrams("");
  }

  function chooseServing(portion: ServingOption) {
    setSelectedServing(portion);
    setServingQuantity("1");
    setUsingCustomGrams(false);
    setCustomGrams("");
    setScore(null);
  }

  function adjustServingQuantity(change: number) {
    const current = quantity ?? 1;
    const next = Math.max(0.25, Math.min(20, Math.round((current + change) * 100) / 100));
    setServingQuantity(String(next));
    setScore(null);
  }

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    setLoadingPreferences(true);

    apiRequest<AccountPreferences>("/user/conditions", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((data) => {
        if (!active) return;
        const saved = data.conditions || [];
        setConditions(saved.map((item) => item.condition_id));
        setDoctorRecommendations(data.doctorRecommendations || "");

        const kidney = saved.find((item) => item.condition_id === "KidneyDisease");
        const ibs = saved.find((item) => item.condition_id === "IBS");
        const crohns = saved.find((item) => item.condition_id === "Crohns");
        if (kidney?.kidney_stage) setKidneyStage(Number(kidney.kidney_stage));
        setKidneyLimitPotassium(!!kidney?.kidney_limit_potassium);
        setKidneyLimitPhosphorus(!!kidney?.kidney_limit_phosphorus);
        if (ibs?.ibs_mode) setIbsMode(ibs.ibs_mode);
        if (crohns?.crohns_state) setCrohnsState(crohns.crohns_state);
        if (!saved.length) setSettingsVisible(true);
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoadingPreferences(false);
      });

    return () => {
      active = false;
    };
  }, [isSignedIn, sessionToken]);

  useEffect(() => {
    if (!conditions.includes(feedbackCondition) && conditions[0]) {
      setFeedbackCondition(conditions[0]);
    }
  }, [conditions, feedbackCondition]);

  function resetMessages() {
    setError("");
    setNotice("");
  }

  function toggleCondition(condition: ConditionId) {
    resetMessages();
    setSettingsError("");
    setScore(null);
    setConditions((current) =>
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition]
    );
  }

  async function search(nextQuery?: string) {
    const term = (nextQuery ?? query).trim();
    if (!term || searching) return;
    if (nextQuery) setQuery(nextQuery);
    resetMessages();
    setSearching(true);
    setScore(null);
    setSelectedFood(null);
    resetServingAmount();
    setOtherFormsVisible(false);

    try {
      const data = await apiRequest<SearchResponse>(`/foods/search?q=${encodeURIComponent(term)}`);
      setSearchResult({ ...data, otherFdc: data.otherFdc || [] });
      if (!data.cached.length && !data.fdc.length && !data.otherFdc?.length) {
        setNotice("No matches yet. Try a simpler food name or check the spelling.");
      } else if (data.sourceWarning) {
        setNotice(data.sourceWarning);
      }
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSearching(false);
    }
  }

  function chooseCached(food: FoodItem) {
    resetMessages();
    setSelectedFood(food);
    resetServingAmount();
    setScore(null);
    setNotice("Now choose the amount you plan to eat.");
  }

  async function importFood(fdcId: number) {
    if (importingId !== null) return;
    resetMessages();
    setImportingId(fdcId);
    setScore(null);

    try {
      const data = await apiRequest<{ food: FoodItem }>("/foods/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fdcId }),
      });
      setSelectedFood(data.food);
      resetServingAmount();
      setOtherFormsVisible(false);
      setNotice("Food selected. Choose the amount you plan to eat, then review it.");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setImportingId(null);
    }
  }

  async function runScore() {
    if (!selectedFood?.food_id || !selectedServing || !hasValidServingAmount || scoring) return;
    resetMessages();
    setScoring(true);

    try {
      const data = await apiRequest<ScoreResponse>("/score-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          foodId: selectedFood.food_id,
          conditions,
          settings,
          servingGrams: effectiveServingGrams,
          servingLabel: effectiveServingLabel,
        }),
      });
      setScore(data);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setScoring(false);
    }
  }

  async function saveAccountPreferences() {
    if (!isSignedIn || savingPreferences) return;
    if (!conditions.length) {
      setSettingsError("Choose at least one health area before saving.");
      return;
    }
    setSavingPreferences(true);
    setSettingsError("");

    try {
      await apiRequest("/user/conditions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ conditions, settings, doctorRecommendations }),
      });
      setSettingsVisible(false);
      setScore(null);
      setNotice("Your health settings were saved.");
    } catch (caught) {
      setSettingsError(apiErrorMessage(caught));
    } finally {
      setSavingPreferences(false);
    }
  }

  async function saveReaction(reaction: "safe" | "trigger" | "clear") {
    if (!userId) {
      setNotice("Log in to save your personal safe foods and triggers.");
      return;
    }
    if (!selectedFood?.food_id || !feedbackCondition || savingReaction) return;
    resetMessages();
    setSavingReaction(true);

    try {
      await apiRequest("/user/feedback", {
        method: reaction === "clear" ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          foodId: selectedFood.food_id,
          conditionId: feedbackCondition,
          ...(reaction === "clear" ? {} : { feedback: reaction }),
        }),
      });
      setNotice(reaction === "clear" ? "Reaction cleared." : "Your reaction was saved.");
      await runScore();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSavingReaction(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete your Nouri account?",
      "This permanently deletes your account, saved conditions, and food reactions. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            resetMessages();
            try {
              await apiRequest("/user/account", {
                method: "DELETE",
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              onLogout?.();
            } catch (caught) {
              setError(apiErrorMessage(caught));
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  }

  function renderHealthPreferences() {
    return (
      <>
        <SectionHeading icon="✨" title="What matters most to you?" subtitle="Pick one or more areas for tailored guidance" />
        <View style={styles.conditionGrid}>
          {CONDITIONS.map((condition) => {
            const selected = conditions.includes(condition.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={condition.id}
                onPress={() => toggleCondition(condition.id)}
                style={({ pressed }) => [
                  styles.conditionCard,
                  selected && styles.conditionCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.conditionIcon}>{condition.icon}</Text>
                <Text style={[styles.conditionLabel, selected && styles.conditionLabelSelected]}>
                  {condition.label}
                </Text>
                <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
                  {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {hasIBS ? (
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>Your IBS journey</Text>
            <Text style={styles.settingsIntro}>
              Low-FODMAP eating is a short three-step process—not a forever restriction. A GI dietitian can help with portions and nutrition.
            </Text>
            {IBS_PHASES.map((phase) => {
              const selected = ibsMode === phase.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={phase.id}
                  onPress={() => {
                    setIbsMode(phase.id);
                    setScore(null);
                  }}
                  style={[styles.phaseRow, selected && styles.phaseRowSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                  <View style={styles.phaseCopy}>
                    <Text style={[styles.phaseLabel, selected && styles.phaseLabelSelected]}>{phase.label}</Text>
                    <Text style={styles.phaseDescription}>{phase.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {hasKidney ? (
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>Kidney stage</Text>
            <Text style={styles.settingsIntro}>
              Stage is context only. Potassium and phosphorus limits should follow your labs and care team—not stage alone.
            </Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5].map((stage) => (
                <Chip
                  key={stage}
                  label={String(stage)}
                  onPress={() => {
                    setKidneyStage(stage);
                    setScore(null);
                  }}
                  selected={kidneyStage === stage}
                />
              ))}
            </View>
            <Text style={styles.carePlanLabel}>Only turn these on if your care team told you to limit them:</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Limit potassium"
                onPress={() => {
                  setKidneyLimitPotassium((value) => !value);
                  setScore(null);
                }}
                selected={kidneyLimitPotassium}
              />
              <Chip
                label="Limit phosphorus"
                onPress={() => {
                  setKidneyLimitPhosphorus((value) => !value);
                  setScore(null);
                }}
                selected={kidneyLimitPhosphorus}
              />
            </View>
          </View>
        ) : null}

        {hasCrohns ? (
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>How are you feeling?</Text>
            <View style={styles.chipRow}>
              <Chip label="Stable" onPress={() => setCrohnsState("stable")} selected={crohnsState === "stable"} />
              <Chip label="In a flare" onPress={() => setCrohnsState("flare")} selected={crohnsState === "flare"} />
            </View>
          </View>
        ) : null}

        {!conditions.length ? (
          <Text style={styles.emptyText}>Choose at least one area for personalized guidance.</Text>
        ) : null}
      </>
    );
  }

  const rating = score ? ratingContent(score.rating) : null;
  const nutrients = score?.nutrients ?? {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={require("./assets/nouri-icon.png")} style={styles.logo} />
            <View>
              <Text style={styles.brand}>Nouri</Text>
              <Text style={styles.greeting}>
                Hi, {headerName && headerName !== "Guest" ? headerName : "food explorer"}!
              </Text>
            </View>
          </View>
          <View style={styles.topBarActions}>
            {isSignedIn ? (
              <Button
                title="Settings"
                onPress={() => {
                  setSettingsError("");
                  setSettingsVisible(true);
                }}
                variant="outline"
                compact
              />
            ) : null}
            {onLogout ? <Button title="Log out" onPress={onLogout} variant="quiet" compact /> : null}
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBlob} />
          <Text style={styles.heroEyebrow}>A LITTLE CLARITY AT EVERY BITE</Text>
          <Text style={styles.heroTitle}>Find food that feels good.</Text>
          <Text style={styles.heroText}>
            {isSignedIn
              ? "Search a food and Nouri will use the health preferences saved in your account."
              : "Search a food, choose what matters to you, and get simple guidance you can discuss with your care team."}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorTitle}>We hit a snag</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <Card>
          <SectionHeading icon="🔎" title="Find a food" subtitle="Start with a general food or cut; detailed forms stay out of the way" />
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Search foods"
              autoCapitalize="none"
              onChangeText={setQuery}
              onSubmitEditing={() => search()}
              placeholder="Try oatmeal, avocado, soup…"
              placeholderTextColor={COLORS.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            <Pressable
              accessibilityLabel="Search"
              accessibilityRole="button"
              disabled={!query.trim() || searching}
              onPress={() => search()}
              style={({ pressed }) => [
                styles.searchButton,
                (!query.trim() || searching) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.searchButtonText}>{searching ? "…" : "Go"}</Text>
            </Pressable>
          </View>
          <View style={styles.quickRow}>
            {QUICK_SEARCHES.map((item) => (
              <Pressable key={item} onPress={() => search(item)} style={styles.quickPill}>
                <Text style={styles.quickPillText}>{item}</Text>
              </Pressable>
            ))}
          </View>

          {searchResult ? (
            <View style={styles.results}>
              {searchResult.smartSearch?.enabled ? (
                <View style={styles.smartSearchBox}>
                  <Text style={styles.smartSearchEyebrow}>OPTIONAL SEARCH TRIAL</Text>
                  <Text style={styles.smartSearchTitle}>
                    {searchResult.smartSearch.matches.length
                      ? "Edamam understood your search as"
                      : "Edamam did not find a clear match"}
                  </Text>
                  {searchResult.smartSearch.warning ? (
                    <Text style={styles.smartSearchText}>{searchResult.smartSearch.warning}</Text>
                  ) : null}
                  {searchResult.smartSearch.matches.map((item) => (
                    <FoodRow
                      action="Find nutrition"
                      detail={smartMatchDetail(item) || "Live search interpretation"}
                      key={`smart-${item.foodId}`}
                      name={item.label}
                      onPress={() => search(item.label)}
                    />
                  ))}
                  <Text style={styles.smartSearchFootnote}>
                    This tests wording and portion recognition only. Nouri still uses USDA nutrition for the health review.
                  </Text>
                  <Pressable
                    accessibilityLabel="Powered by Edamam"
                    accessibilityRole="link"
                    onPress={() => Linking.openURL("https://developer.edamam.com")}
                    style={({ pressed }) => [styles.edamamBadgeLink, pressed && styles.pressed]}
                  >
                    <Image
                      resizeMode="contain"
                      source={{ uri: "https://developer.edamam.com/images/transparent.png" }}
                      style={styles.edamamBadge}
                    />
                  </Pressable>
                </View>
              ) : null}

              {searchResult.cached.length || searchResult.fdc.length ? (
                <View style={styles.resultGroup}>
                  <Text style={styles.resultGroupTitle}>
                    {searchResult.cached.length + searchResult.fdc.length > 1
                      ? "Recommended general choices"
                      : "Recommended general match"}
                  </Text>
                  {searchResult.cached.map((item) => (
                    <FoodRow
                      action="Use this"
                      detail={item.brand || item.data_type || "General nutrition data"}
                      key={`cached-${item.food_id}`}
                      name={item.name}
                      onPress={() => chooseCached(item)}
                    />
                  ))}
                  {searchResult.fdc.map((item) => (
                    <FoodRow
                      action={importingId === item.fdcId ? "Adding…" : "Use this"}
                      detail={[item.brand, item.dataType].filter(Boolean).join(" · ") || "Generic USDA food"}
                      disabled={importingId !== null}
                      key={`fdc-${item.fdcId}`}
                      name={item.name}
                      onPress={() => importFood(item.fdcId)}
                    />
                  ))}
                </View>
              ) : null}

              {searchResult.otherFdc.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOtherFormsVisible(true)}
                  style={({ pressed }) => [styles.otherFormsButton, pressed && styles.pressed]}
                >
                  <View style={styles.otherFormsCopy}>
                    <Text style={styles.otherFormsTitle}>Not what you meant?</Text>
                    <Text style={styles.otherFormsSubtitle}>
                      See {searchResult.otherFdc.length} more preparations, products, and forms
                    </Text>
                  </View>
                  <Text style={styles.otherFormsArrow}>›</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>

        <Card accent={!!selectedFood}>
          <SectionHeading icon="🥗" title="Food and amount" subtitle="Choose the household portion closest to what you will eat" />
          {selectedFood ? (
            <View>
              <View style={styles.selectedFood}>
                <View style={styles.selectedFoodIcon}>
                  <Text style={styles.selectedFoodEmoji}>✓</Text>
                </View>
                <View style={styles.foodCopy}>
                  <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
                  <Text style={styles.foodDetail}>{selectedFood.brand || selectedFood.data_type || "General nutrition data"}</Text>
                </View>
              </View>
              <Text style={styles.portionHeading}>How much?</Text>
              {!selectedServing ? <Text style={styles.portionPrompt}>Pick one before Nouri estimates nutrition.</Text> : null}
              <View style={styles.portionGrid}>
                {(selectedFood.serving_options?.length
                  ? selectedFood.serving_options
                  : [{ id: "grams-100", label: "100 g", grams: 100 }]
                ).map((portion) => {
                  const selected = selectedServing?.id === portion.id;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={portion.id}
                      onPress={() => chooseServing(portion)}
                      style={({ pressed }) => [
                        styles.portionOption,
                        selected && styles.portionOptionSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.portionLabel, selected && styles.portionLabelSelected]}>{portion.label}</Text>
                      <Text style={[styles.portionGrams, selected && styles.portionLabelSelected]}>{Math.round(portion.grams)} g</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedServing ? (
                <View style={styles.amountBox}>
                  <View style={styles.amountHeader}>
                    <View style={styles.amountHeadingCopy}>
                      <Text style={styles.amountTitle}>{usingCustomGrams ? "Enter the amount" : "How many?"}</Text>
                      <Text style={styles.amountSubtitle}>
                        {usingCustomGrams
                          ? "Use the weight from a label or kitchen scale"
                          : `Start with ${selectedServing.label}, then adjust the amount you ate`}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setUsingCustomGrams((current) => !current);
                        setScore(null);
                      }}
                      style={({ pressed }) => [styles.amountModeButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.amountModeButtonText}>
                        {usingCustomGrams ? "Use portions" : "Enter grams"}
                      </Text>
                    </Pressable>
                  </View>

                  {usingCustomGrams ? (
                    <View>
                      <View style={styles.gramInputRow}>
                        <TextInput
                          accessibilityLabel="Amount in grams"
                          keyboardType="decimal-pad"
                          maxLength={7}
                          onChangeText={(value) => {
                            setCustomGrams(decimalInput(value));
                            setScore(null);
                          }}
                          placeholder="Example: 190"
                          placeholderTextColor={COLORS.muted}
                          style={styles.gramInput}
                          value={customGrams}
                        />
                        <Text style={styles.gramUnit}>grams</Text>
                      </View>
                      {customGrams && !hasValidServingAmount ? (
                        <Text style={styles.amountError}>Enter an amount between 1 and 2,000 grams.</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View>
                      <View style={styles.quantityRow}>
                        <Pressable
                          accessibilityLabel="Decrease amount"
                          accessibilityRole="button"
                          onPress={() => adjustServingQuantity(-0.5)}
                          style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.quantityButtonText}>−</Text>
                        </Pressable>
                        <TextInput
                          accessibilityLabel="Number of portions"
                          keyboardType="decimal-pad"
                          maxLength={5}
                          onBlur={() => {
                            if (!quantity) setServingQuantity("1");
                          }}
                          onChangeText={(value) => {
                            setServingQuantity(decimalInput(value));
                            setScore(null);
                          }}
                          selectTextOnFocus
                          style={styles.quantityInput}
                          value={servingQuantity}
                        />
                        <Pressable
                          accessibilityLabel="Increase amount"
                          accessibilityRole="button"
                          onPress={() => adjustServingQuantity(0.5)}
                          style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </Pressable>
                      </View>
                      <View style={styles.quantityQuickRow}>
                        {[0.5, 1, 1.5, 2].map((quickQuantity) => {
                          const active = quantity === quickQuantity;
                          return (
                            <Pressable
                              accessibilityRole="button"
                              key={quickQuantity}
                              onPress={() => {
                                setServingQuantity(String(quickQuantity));
                                setScore(null);
                              }}
                              style={({ pressed }) => [
                                styles.quantityQuickButton,
                                active && styles.quantityQuickButtonActive,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={[styles.quantityQuickText, active && styles.quantityQuickTextActive]}>
                                {displayQuantity(quickQuantity)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {hasValidServingAmount ? (
                    <Text style={styles.amountSummary}>
                      {effectiveServingLabel} · about {Math.round(effectiveServingGrams || 0)} g total
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {isSignedIn ? (
                <View style={styles.savedPreferencesBox}>
                  <Text style={styles.savedPreferencesTitle}>Using your saved health settings</Text>
                  <Text style={styles.savedPreferencesText}>
                    {loadingPreferences
                      ? "Loading your account preferences…"
                      : conditions.length
                        ? conditions.map((condition) => CONDITIONS.find((item) => item.id === condition)?.label || condition).join(" · ")
                        : "Choose what matters to you in Settings before reviewing this food."}
                  </Text>
                  {conditions.length ? (
                    <Button
                      disabled={!hasValidServingAmount || scoring || loadingPreferences}
                      onPress={runScore}
                      title={scoring ? "Reviewing…" : "Review this food"}
                    />
                  ) : (
                    <Button onPress={() => setSettingsVisible(true)} title="Open health settings" variant="outline" />
                  )}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyText}>Choose a food from your search results to get started.</Text>
          )}
        </Card>

        {!isSignedIn ? (
          <Card>
            {renderHealthPreferences()}
            <Button
              disabled={!selectedFood || !hasValidServingAmount || !conditions.length || scoring}
              onPress={runScore}
              title={scoring ? "Reviewing…" : "Review this food"}
            />
          </Card>
        ) : null}

        {score && rating ? (
          <>
            <View style={[styles.ratingCard, { backgroundColor: rating.bg }]}>
              <Text style={styles.ratingEmoji}>{rating.emoji}</Text>
              <View style={styles.ratingCopy}>
                <Text style={[styles.ratingLabel, { color: rating.color }]}>{rating.label}</Text>
                <Text style={styles.ratingFood}>{score.food.name}</Text>
              </View>
            </View>

            <Card>
              <SectionHeading icon="💡" title="Condition-by-condition" subtitle="Each result shows how certain the available data can be" />
              {score.condition_results.map((result) => {
                const resultRating = ratingContent(result.rating);
                const label = CONDITIONS.find((item) => item.id === result.condition)?.label || result.condition;
                return (
                  <View style={styles.conditionResult} key={result.condition}>
                    <View style={styles.conditionResultHeader}>
                      <Text style={styles.conditionResultTitle}>{label}</Text>
                      <View style={[styles.resultBadge, { backgroundColor: resultRating.bg }]}>
                        <Text style={[styles.resultBadgeText, { color: resultRating.color }]}>
                          {result.rating === "eat" ? "No flag" : result.rating === "limit" ? "Review" : result.rating === "avoid" ? "Trigger" : "Uncertain"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.confidenceText}>{result.confidence} confidence</Text>
                    {result.reasons.map((reason, index) => (
                      <View style={styles.reasonRow} key={`${result.condition}-${reason}-${index}`}>
                        <View style={styles.reasonDot} />
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}

              {score.ibs_guidance ? (
                <View style={styles.ibsResult}>
                  <View style={styles.ibsResultTop}>
                    <Text style={styles.ibsResultTitle}>IBS & FODMAP check</Text>
                    <View style={styles.fodmapBadge}>
                      <Text style={styles.fodmapBadgeText}>{score.ibs_guidance.fodmap_level.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.ibsResultText}>{score.ibs_guidance.summary}</Text>
                  {score.ibs_guidance.fodmap_groups.length ? (
                    <Text style={styles.ibsGroups}>
                      FODMAP groups to notice: {score.ibs_guidance.fodmap_groups.join(", ")}
                    </Text>
                  ) : null}
                  {score.ibs_guidance.portion_sensitive ? (
                    <Text style={styles.portionNote}>Portion size and preparation can change the result.</Text>
                  ) : null}
                </View>
              ) : null}
            </Card>

            <Card>
              <SectionHeading icon="📊" title="Nutrition at a glance" subtitle={score.nutrition_basis || "Values use the source’s available basis"} />
              <View style={styles.macroGrid}>
                <MacroTile label="Calories" unit="kcal" value={nutrients.calories_kcal} />
                <MacroTile label="Protein" unit="g" value={nutrients.protein_g} />
                <MacroTile label="Carbs" unit="g" value={nutrients.carbs_g} />
                <MacroTile label="Fat" unit="g" value={nutrients.fat_g} />
              </View>

              <Text style={styles.nutrientGroupTitle}>Label nutrients</Text>
              <NutrientRow label="Fiber" unit="g" value={nutrients.fiber_g} />
              <NutrientRow label="Total sugars" unit="g" value={nutrients.total_sugars_g} />
              <NutrientRow label="Added sugars" unit="g" value={nutrients.added_sugars_g} />
              <NutrientRow label="Saturated fat" unit="g" value={nutrients.saturated_fat_g} />
              <NutrientRow label="Cholesterol" unit="mg" value={nutrients.cholesterol_mg} decimals={0} />

              <Text style={styles.nutrientGroupTitle}>Minerals & vitamins</Text>
              <NutrientRow label="Sodium" unit="mg" value={nutrients.sodium_mg} decimals={0} />
              <NutrientRow label="Potassium" unit="mg" value={nutrients.potassium_mg} decimals={0} />
              <NutrientRow label="Phosphorus" unit="mg" value={nutrients.phosphorus_mg} decimals={0} />
              <NutrientRow label="Calcium" unit="mg" value={nutrients.calcium_mg} decimals={0} />
              <NutrientRow label="Iron" unit="mg" value={nutrients.iron_mg} />
              <NutrientRow label="Vitamin D" unit="mcg" value={nutrients.vitamin_d_mcg} />

              <Text style={styles.missingNote}>A dash means the source did not report that nutrient—it does not mean zero.</Text>
            </Card>

            <Card>
              <SectionHeading icon="🫶" title="Remember your reaction" subtitle={userId ? "Personal history can make future guidance more useful" : "Log in to save what works for your body"} />
              {conditions.length > 1 ? (
                <View style={styles.chipRow}>
                  {conditions.map((condition) => (
                    <Chip
                      key={condition}
                      label={CONDITIONS.find((item) => item.id === condition)?.label || condition}
                      onPress={() => setFeedbackCondition(condition)}
                      selected={feedbackCondition === condition}
                    />
                  ))}
                </View>
              ) : null}
              <View style={styles.reactionRow}>
                <View style={styles.reactionButton}>
                  <Button disabled={savingReaction} onPress={() => saveReaction("safe")} title="Felt okay" variant="outline" />
                </View>
                <View style={styles.reactionButton}>
                  <Button disabled={savingReaction} onPress={() => saveReaction("trigger")} title="Triggered me" variant="danger" />
                </View>
              </View>
              {userId ? <Button disabled={savingReaction} onPress={() => saveReaction("clear")} title="Clear saved reaction" variant="quiet" compact /> : null}
            </Card>
          </>
        ) : null}

        {score && isSignedIn && doctorRecommendations.trim() ? (
          <Card>
            <SectionHeading icon="🩺" title="Your care-team notes" subtitle="Saved in Settings for your reference" />
            <Text style={styles.doctorNoteText}>{doctorRecommendations}</Text>
            <Text style={styles.doctorNoteDisclaimer}>These notes are not automatically converted into rating rules.</Text>
          </Card>
        ) : null}

        {userId ? (
          <Card>
            <SectionHeading icon="⚙️" title="Account" subtitle="Manage your Nouri account and saved data" />
            <Button
              onPress={() => {
                setSettingsError("");
                setSettingsVisible(true);
              }}
              title="Edit health settings"
              variant="outline"
            />
            <View style={styles.accountActionSpacer} />
            <Button
              disabled={deletingAccount}
              onPress={confirmDeleteAccount}
              title={deletingAccount ? "Deleting…" : "Delete my account and data"}
              variant="danger"
            />
          </Card>
        ) : null}

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Nouri is a guide, not a diagnosis.</Text>
          <Text style={styles.footerText}>
            Food tolerance is personal. Nutrition values can vary by brand, recipe, serving size, and preparation. Work with a doctor or registered dietitian for medical decisions.
          </Text>
          <Text style={styles.footerSource}>Nutrition data: USDA FoodData Central</Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setOtherFormsVisible(false)}
        presentationStyle="pageSheet"
        visible={otherFormsVisible}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>MORE RESULTS</Text>
              <Text style={styles.modalTitle}>Other forms of {query.trim() || "this food"}</Text>
            </View>
            <Button title="Close" onPress={() => setOtherFormsVisible(false)} variant="quiet" compact />
          </View>
          <Text style={styles.modalIntro}>
            These include different preparations and specialty products. Choose one only if it better matches what you ate.
          </Text>
          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {(searchResult?.otherFdc || []).map((item) => (
              <FoodRow
                action={importingId === item.fdcId ? "Adding…" : "Choose"}
                detail={[item.brand, item.dataType].filter(Boolean).join(" · ") || "USDA food"}
                disabled={importingId !== null}
                key={`other-${item.fdcId}`}
                name={item.name}
                onPress={() => importFood(item.fdcId)}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
        presentationStyle="pageSheet"
        visible={settingsVisible}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>ACCOUNT SETTINGS</Text>
              <Text style={styles.modalTitle}>Your health preferences</Text>
            </View>
            <Button title="Close" onPress={() => setSettingsVisible(false)} variant="quiet" compact />
          </View>
          <ScrollView
            contentContainerStyle={styles.settingsModalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>{renderHealthPreferences()}</View>

            <View style={styles.modalCard}>
              <SectionHeading
                icon="🩺"
                title="Doctor or dietitian recommendations"
                subtitle="Keep care-plan notes with your account"
              />
              <TextInput
                accessibilityLabel="Doctor or dietitian recommendations"
                maxLength={2000}
                multiline
                onChangeText={setDoctorRecommendations}
                placeholder="Example: Keep sodium under my prescribed daily target. My dietitian asked me to monitor potassium."
                placeholderTextColor={COLORS.muted}
                style={styles.doctorInput}
                textAlignVertical="top"
                value={doctorRecommendations}
              />
              <Text style={styles.doctorInputHelp}>
                Saved for your reference. Nouri will not turn free-text medical notes into automatic rules; use the structured choices above when available.
              </Text>
            </View>

            {settingsError ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{settingsError}</Text>
              </View>
            ) : null}

            <Button
              disabled={savingPreferences || loadingPreferences}
              onPress={saveAccountPreferences}
              title={savingPreferences ? "Saving…" : "Save health settings"}
            />
            <View style={styles.modalBottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brandRow: { alignItems: "center", flexDirection: "row", flex: 1 },
  topBarActions: { alignItems: "center", flexDirection: "row" },
  logo: { borderRadius: 16, height: 52, marginRight: 10, width: 52 },
  brand: { color: COLORS.green, fontFamily: TYPE.display, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  greeting: { color: COLORS.muted, fontSize: 12, marginTop: 1 },
  heroCard: {
    backgroundColor: COLORS.green,
    borderRadius: 28,
    marginBottom: 14,
    overflow: "hidden",
    padding: 22,
    position: "relative",
  },
  heroBlob: {
    backgroundColor: COLORS.coral,
    borderRadius: 90,
    height: 150,
    opacity: 0.22,
    position: "absolute",
    right: -42,
    top: -60,
    width: 150,
  },
  heroEyebrow: { color: COLORS.mintStrong, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: COLORS.white, fontFamily: TYPE.display, fontSize: 29, fontWeight: "800", letterSpacing: -0.5, marginTop: 7 },
  heroText: { color: "#E5F1E8", fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 330 },
  errorBox: { backgroundColor: COLORS.dangerSoft, borderRadius: 18, marginBottom: 14, padding: 14 },
  errorTitle: { color: COLORS.danger, fontSize: 14, fontWeight: "900" },
  errorText: { color: COLORS.danger, fontSize: 13, lineHeight: 18, marginTop: 2 },
  noticeBox: { backgroundColor: COLORS.warningSoft, borderRadius: 18, marginBottom: 14, padding: 14 },
  noticeText: { color: COLORS.warning, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 17,
    ...SHADOW,
  },
  cardAccent: { borderColor: COLORS.mintStrong, borderWidth: 2 },
  sectionHeading: { alignItems: "center", flexDirection: "row", marginBottom: 15 },
  sectionIcon: { alignItems: "center", backgroundColor: COLORS.surfaceSoft, borderRadius: 14, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  sectionIconText: { fontSize: 20 },
  sectionHeadingCopy: { flex: 1 },
  cardTitle: { color: COLORS.ink, fontFamily: TYPE.display, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  cardSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  searchRow: { alignItems: "center", flexDirection: "row" },
  searchInput: { backgroundColor: COLORS.canvas, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, color: COLORS.ink, flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 },
  searchButton: { alignItems: "center", backgroundColor: COLORS.coral, borderRadius: 16, justifyContent: "center", marginLeft: 8, minHeight: 48, width: 52 },
  searchButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  quickPill: { backgroundColor: COLORS.surfaceSoft, borderRadius: 999, marginBottom: 7, marginRight: 7, paddingHorizontal: 11, paddingVertical: 7 },
  quickPillText: { color: COLORS.greenSoft, fontSize: 12, fontWeight: "700" },
  results: { borderTopColor: COLORS.border, borderTopWidth: 1, marginTop: 9, paddingTop: 4 },
  smartSearchBox: { backgroundColor: COLORS.mint, borderColor: COLORS.mintStrong, borderRadius: 17, borderWidth: 1, marginTop: 11, padding: 12 },
  smartSearchEyebrow: { color: COLORS.coral, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  smartSearchTitle: { color: COLORS.green, fontSize: 13, fontWeight: "900", marginTop: 3 },
  smartSearchText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  smartSearchFootnote: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 9 },
  edamamBadgeLink: { alignSelf: "flex-start", marginTop: 8 },
  edamamBadge: { height: 24, width: 110 },
  resultGroup: { marginTop: 11 },
  resultGroupTitle: { color: COLORS.green, fontSize: 12, fontWeight: "900", letterSpacing: 0.4, marginBottom: 4, textTransform: "uppercase" },
  foodRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", minHeight: 66, paddingVertical: 9 },
  foodAvatar: { alignItems: "center", backgroundColor: COLORS.canvas, borderRadius: 13, height: 40, justifyContent: "center", marginRight: 10, width: 40 },
  foodAvatarText: { fontSize: 19 },
  foodCopy: { flex: 1, paddingRight: 8 },
  foodName: { color: COLORS.ink, fontSize: 14, fontWeight: "800", lineHeight: 18, textTransform: "capitalize" },
  foodDetail: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  foodAction: { color: COLORS.coral, fontSize: 12, fontWeight: "900" },
  otherFormsButton: { alignItems: "center", backgroundColor: COLORS.surfaceSoft, borderRadius: 17, flexDirection: "row", marginTop: 12, padding: 13 },
  otherFormsCopy: { flex: 1, paddingRight: 10 },
  otherFormsTitle: { color: COLORS.green, fontSize: 13, fontWeight: "900" },
  otherFormsSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  otherFormsArrow: { color: COLORS.coral, fontSize: 28, fontWeight: "700", lineHeight: 28 },
  selectedFood: { alignItems: "center", backgroundColor: COLORS.surfaceSoft, borderRadius: 18, flexDirection: "row", padding: 13 },
  selectedFoodIcon: { alignItems: "center", backgroundColor: COLORS.green, borderRadius: 999, height: 32, justifyContent: "center", marginRight: 11, width: 32 },
  selectedFoodEmoji: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  selectedFoodName: { color: COLORS.ink, fontSize: 16, fontWeight: "900", textTransform: "capitalize" },
  portionHeading: { color: COLORS.green, fontSize: 13, fontWeight: "900", marginBottom: 8, marginTop: 14 },
  portionPrompt: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginBottom: 9, marginTop: -3 },
  portionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  portionOption: { backgroundColor: COLORS.canvas, borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, marginBottom: 8, minHeight: 60, padding: 10, width: "48.5%" },
  portionOptionSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  portionLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  portionLabelSelected: { color: COLORS.white },
  portionGrams: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  amountBox: { backgroundColor: COLORS.surfaceSoft, borderRadius: 17, marginTop: 3, padding: 13 },
  amountHeader: { alignItems: "flex-start", flexDirection: "row" },
  amountHeadingCopy: { flex: 1, paddingRight: 8 },
  amountTitle: { color: COLORS.green, fontSize: 13, fontWeight: "900" },
  amountSubtitle: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  amountModeButton: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  amountModeButtonText: { color: COLORS.green, fontSize: 10, fontWeight: "900" },
  quantityRow: { alignItems: "center", flexDirection: "row", marginTop: 11 },
  quantityButton: { alignItems: "center", backgroundColor: COLORS.green, borderRadius: 13, flexShrink: 0, height: 43, justifyContent: "center", width: 43 },
  quantityButtonText: { color: COLORS.white, fontSize: 23, fontWeight: "700", lineHeight: 25 },
  quantityInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, color: COLORS.ink, flex: 1, fontSize: 18, fontWeight: "900", height: 43, marginHorizontal: 8, minWidth: 0, paddingHorizontal: 12, textAlign: "center", width: 0 },
  quantityQuickRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  quantityQuickButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 999, borderWidth: 1, minWidth: "22%", paddingHorizontal: 10, paddingVertical: 7 },
  quantityQuickButtonActive: { backgroundColor: COLORS.mint, borderColor: COLORS.green },
  quantityQuickText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  quantityQuickTextActive: { fontWeight: "900" },
  gramInputRow: { alignItems: "center", flexDirection: "row", marginTop: 11 },
  gramInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, color: COLORS.ink, flex: 1, fontSize: 16, fontWeight: "800", height: 45, paddingHorizontal: 13 },
  gramUnit: { color: COLORS.ink, fontSize: 12, fontWeight: "800", marginLeft: 9 },
  amountError: { color: COLORS.danger, fontSize: 10, lineHeight: 14, marginTop: 6 },
  amountSummary: { color: COLORS.green, fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 9, textAlign: "center" },
  savedPreferencesBox: { backgroundColor: COLORS.surfaceSoft, borderRadius: 17, marginTop: 9, padding: 13 },
  savedPreferencesTitle: { color: COLORS.green, fontSize: 13, fontWeight: "900" },
  savedPreferencesText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginBottom: 11, marginTop: 3 },
  emptyText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  conditionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 3 },
  conditionCard: { backgroundColor: COLORS.canvas, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, marginBottom: 10, minHeight: 98, padding: 12, position: "relative", width: "48.5%" },
  conditionCardSelected: { backgroundColor: COLORS.mint, borderColor: COLORS.green },
  conditionIcon: { fontSize: 24 },
  conditionLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "800", marginTop: 9, paddingRight: 20 },
  conditionLabelSelected: { color: COLORS.green },
  checkDot: { borderColor: COLORS.border, borderRadius: 999, borderWidth: 1.5, height: 21, position: "absolute", right: 10, top: 10, width: 21 },
  checkDotSelected: { alignItems: "center", backgroundColor: COLORS.green, borderColor: COLORS.green, justifyContent: "center" },
  checkMark: { color: COLORS.white, fontSize: 12, fontWeight: "900" },
  settingsBox: { backgroundColor: COLORS.canvas, borderRadius: 18, marginBottom: 13, padding: 14 },
  settingsTitle: { color: COLORS.green, fontSize: 15, fontWeight: "900" },
  settingsIntro: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 10, marginTop: 4 },
  carePlanLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "700", lineHeight: 16, marginTop: 5 },
  phaseRow: { alignItems: "center", borderRadius: 14, flexDirection: "row", marginTop: 5, paddingHorizontal: 9, paddingVertical: 8 },
  phaseRowSelected: { backgroundColor: COLORS.surface },
  radio: { borderColor: COLORS.muted, borderRadius: 999, borderWidth: 1.5, height: 17, marginRight: 10, width: 17 },
  radioSelected: { backgroundColor: COLORS.coral, borderColor: COLORS.coral, borderWidth: 4 },
  phaseCopy: { flex: 1 },
  phaseLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  phaseLabelSelected: { color: COLORS.green },
  phaseDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 9 },
  chip: { borderColor: COLORS.green, borderRadius: 999, borderWidth: 1, marginBottom: 8, marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: COLORS.green },
  chipText: { color: COLORS.green, fontSize: 12, fontWeight: "800" },
  chipTextSelected: { color: COLORS.white },
  button: { alignItems: "center", borderRadius: 16, justifyContent: "center", minHeight: 48, paddingHorizontal: 15, paddingVertical: 12 },
  buttonCompact: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 8 },
  buttonPrimary: { backgroundColor: COLORS.coral },
  buttonOutline: { borderColor: COLORS.green, borderWidth: 1.5 },
  buttonDanger: { backgroundColor: COLORS.danger },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonText: { fontSize: 14, fontWeight: "900" },
  buttonTextLight: { color: COLORS.white },
  buttonTextGreen: { color: COLORS.green },
  buttonTextMuted: { color: COLORS.muted },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.75 },
  ratingCard: { alignItems: "center", borderRadius: 24, flexDirection: "row", marginBottom: 14, padding: 18 },
  ratingEmoji: { fontSize: 34, marginRight: 13 },
  ratingCopy: { flex: 1 },
  ratingLabel: { fontFamily: TYPE.display, fontSize: 19, fontWeight: "900" },
  ratingFood: { color: COLORS.ink, fontSize: 13, marginTop: 3, textTransform: "capitalize" },
  reasonRow: { alignItems: "flex-start", flexDirection: "row", marginBottom: 10 },
  reasonDot: { backgroundColor: COLORS.coral, borderRadius: 999, height: 7, marginRight: 9, marginTop: 6, width: 7 },
  reasonText: { color: COLORS.ink, flex: 1, fontSize: 13, lineHeight: 19 },
  conditionResult: { borderBottomColor: COLORS.border, borderBottomWidth: 1, marginBottom: 14, paddingBottom: 5 },
  conditionResultHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  conditionResultTitle: { color: COLORS.green, flex: 1, fontSize: 15, fontWeight: "900" },
  resultBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  resultBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  confidenceText: { color: COLORS.muted, fontSize: 10, marginBottom: 9, marginTop: 2, textTransform: "capitalize" },
  ibsResult: { backgroundColor: COLORS.mint, borderRadius: 18, marginTop: 6, padding: 14 },
  ibsResultTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  ibsResultTitle: { color: COLORS.green, fontSize: 14, fontWeight: "900" },
  fodmapBadge: { backgroundColor: COLORS.surface, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  fodmapBadgeText: { color: COLORS.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  ibsResultText: { color: COLORS.ink, fontSize: 12, lineHeight: 18, marginTop: 8 },
  ibsGroups: { color: COLORS.green, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 7 },
  portionNote: { color: COLORS.muted, fontSize: 11, fontStyle: "italic", marginTop: 7 },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  macroTile: { alignItems: "center", backgroundColor: COLORS.surfaceSoft, borderRadius: 16, marginBottom: 9, paddingHorizontal: 5, paddingVertical: 12, width: "23%" },
  macroValue: { color: COLORS.green, fontFamily: TYPE.display, fontSize: 18, fontWeight: "900" },
  macroUnit: { color: COLORS.muted, fontSize: 9, marginTop: -1 },
  macroLabel: { color: COLORS.ink, fontSize: 10, fontWeight: "700", marginTop: 5 },
  nutrientGroupTitle: { color: COLORS.green, fontSize: 12, fontWeight: "900", letterSpacing: 0.4, marginBottom: 4, marginTop: 12, textTransform: "uppercase" },
  nutrientRow: { borderBottomColor: COLORS.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 },
  nutrientLabel: { color: COLORS.ink, fontSize: 13 },
  nutrientValue: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  missingValue: { color: COLORS.muted },
  acidityBox: { backgroundColor: COLORS.coralSoft, borderRadius: 15, marginTop: 14, padding: 12 },
  acidityTitle: { color: COLORS.danger, fontSize: 12, fontWeight: "900" },
  acidityText: { color: COLORS.ink, fontSize: 12, lineHeight: 17, marginTop: 4 },
  missingNote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  reactionRow: { flexDirection: "row", marginHorizontal: -4 },
  reactionButton: { flex: 1, marginHorizontal: 4 },
  doctorNoteText: { color: COLORS.ink, fontSize: 13, lineHeight: 20 },
  doctorNoteDisclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  accountActionSpacer: { height: 9 },
  modalSafeArea: { backgroundColor: COLORS.canvas, flex: 1 },
  modalHeader: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 14 },
  modalHeaderCopy: { flex: 1, paddingRight: 10 },
  modalEyebrow: { color: COLORS.coral, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  modalTitle: { color: COLORS.green, fontFamily: TYPE.display, fontSize: 22, fontWeight: "900", marginTop: 2, textTransform: "capitalize" },
  modalIntro: { color: COLORS.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 18, paddingTop: 14 },
  modalList: { paddingBottom: 36, paddingHorizontal: 18 },
  settingsModalContent: { padding: 16 },
  modalCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 22, borderWidth: 1, marginBottom: 14, padding: 16 },
  doctorInput: { backgroundColor: COLORS.canvas, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, color: COLORS.ink, fontSize: 13, lineHeight: 19, minHeight: 130, padding: 13 },
  doctorInputHelp: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  modalBottomSpacer: { height: 28 },
  footerCard: { backgroundColor: COLORS.green, borderRadius: 22, marginTop: 2, padding: 18 },
  footerTitle: { color: COLORS.white, fontSize: 14, fontWeight: "900" },
  footerText: { color: "#DDEBE1", fontSize: 11, lineHeight: 17, marginTop: 5 },
  footerSource: { color: COLORS.mintStrong, fontSize: 10, fontWeight: "800", marginTop: 9 },
});
