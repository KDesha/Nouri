import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";

const API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

const COLORS = {
  bg: "#EFE6E0", // beige-white background
  card: "#E9DBD3", // light pink boxes
  text: "#2B1B1E",
  muted: "#6B4B52",
  border: "#D8C6C1",
  accentDark: "#7A1E2D",
  berry: "#E35676", // primary buttons
  berryDark: "#C84560", // danger buttons / emphasis
  white: "#FFFFFF",
};

type FoodItem = {
  food_id: string;
  name: string;
  brand: string | null;
  source: string;
  fdc_id: string | number | null;
};

type SearchResponse = {
  cached: FoodItem[];
  fdc: {
    fdcId: number;
    name: string;
    brand: string | null;
    dataType: string | null;
  }[];
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
  added_sugars_g?: number | null;
  saturated_fat_g?: number | null;

  acidic?: boolean | null;

  ph_category?: string | null;
  ph_note?: string | null;
};

type ScoreResponse = {
  food: FoodItem;
  conditions: string[];
  rating: "eat" | "limit" | "avoid";
  reasons: string[];
  nutrients: Nutrients;
};

function ratingColor(r: "eat" | "limit" | "avoid") {
  if (r === "eat") return "#22c55e";
  if (r === "limit") return "#f59e0b";
  return "#ef4444";
}

function formatNum(v: any, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  return decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals);
}

function PillButton({
  title,
  onPress,
  variant = "primary",
  disabled,
  full,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        full ? { alignSelf: "stretch" } : null,
        variant === "primary" ? styles.btnPrimary : null,
        variant === "outline" ? styles.btnOutline : null,
        variant === "danger" ? styles.btnDanger : null,
        disabled ? styles.btnDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === "primary" ? styles.btnTextPrimary : null,
          variant === "outline" ? styles.btnTextOutline : null,
          variant === "danger" ? styles.btnTextDanger : null,
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
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
      ]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Accordion({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.accordion}>
      <Pressable onPress={onToggle} style={styles.accordionHeader}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.accordionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.accordionSub}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.accordionChevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function NutrientRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: any;
  unit?: string;
}) {
  return (
    <View style={styles.nRow}>
      <Text style={styles.nLabel}>{label}</Text>
      <Text style={styles.nValue}>
        <Text style={styles.mono}>{value}</Text>
        {unit ? <Text style={styles.nUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function DemoScreen({
  initialUserId,
  headerName,
  onLogout,
}: {
  initialUserId?: string;
  headerName?: string;
  onLogout?: () => void;
}) {
  const [q, setQ] = useState("tomato");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);

  const [usdaOpen, setUsdaOpen] = useState(false);
  const [pastChoicesOpen, setPastChoicesOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  // User id comes from AuthScreen now (or stays blank for guest)
  const [userId] = useState<string>(initialUserId ?? "");

  const [conditions, setConditions] = useState<string[]>(["KidneyDisease", "IC"]);
  const [kidneyStage, setKidneyStage] = useState<number>(3);
  const [crohnsState, setCrohnsState] = useState<"stable" | "flare">("stable");
  const [ibsMode, setIbsMode] = useState<"general" | "lowFODMAP">("general");

  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState<ScoreResponse | null>(null);

  const [savingReaction, setSavingReaction] = useState(false);

  const settings = useMemo(
    () => ({ kidneyStage, crohnsState, ibsMode }),
    [kidneyStage, crohnsState, ibsMode]
  );

  const cached = searchResult?.cached ?? [];
  const fdc = searchResult?.fdc ?? [];

  const canScore = !!selectedFood?.food_id;

  const hasKidney = conditions.includes("KidneyDisease");
  const hasIC = conditions.includes("IC");
  const hasIBS = conditions.includes("IBS");
  const hasCrohns = conditions.includes("Crohns");

  const conditionsSubtitle = conditions.length
    ? `${conditions.length} selected: ${conditions.join(", ")}`
    : "none selected";

  function toggleCondition(c: string) {
    setScore(null);
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function doSearch() {
    setSearching(true);
    setScore(null);
    setSelectedFood(null);
    try {
      const res = await fetch(
        `${API_BASE}/foods/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setSearchResult(data as SearchResponse);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSearching(false);
    }
  }

  async function importFromFdc(fdcId: number, forceRefresh = false) {
    setScore(null);
    try {
      const res = await fetch(`${API_BASE}/foods/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fdcId, forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      setSelectedFood(data.food);
      setUsdaOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function runScore() {
    if (!selectedFood?.food_id) return;
    setScoring(true);
    try {
      const res = await fetch(`${API_BASE}/score-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || undefined,
          foodId: selectedFood.food_id,
          conditions,
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Scoring failed");
      setScore(data as ScoreResponse);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setScoring(false);
    }
  }

  async function saveReaction(reaction: "safe" | "trigger" | "unknown") {
    if (!userId) {
      alert("Please log in first to save reactions.");
      return;
    }
    if (!selectedFood?.food_id) {
      alert("Pick/import a food first.");
      return;
    }

    setSavingReaction(true);
    try {
      const res = await fetch(`${API_BASE}/user/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          foodId: selectedFood.food_id,
          conditionId: conditions[0] ?? "IC",
          feedback: reaction === "unknown" ? "safe" : reaction,
          note:
            reaction === "trigger"
              ? "Demo: this food flares me"
              : reaction === "safe"
              ? "Demo: safe for me"
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save reaction failed");
      await runScore();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingReaction(false);
    }
  }

  useEffect(() => {
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = score?.nutrients ?? {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>Nouri</Text>

          </View>

          {onLogout ? (
            <PillButton title="Log out" onPress={onLogout} variant="outline" />
          ) : null}
        </View>

        {/* User */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Hi {headerName && headerName !== "Guest" ? headerName : "there"} :)
          </Text>
        </View>

        {/* Search */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search Foods</Text>

          <Text style={styles.label}>Search query</Text>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="e.g., tomato, coffee, rice"
            placeholderTextColor={COLORS.muted}
          />

          <View style={{ height: 12 }} />

          <PillButton
            title={searching ? "Searching..." : "Search"}
            onPress={doSearch}
            variant="primary"
            disabled={searching || !q.trim()}
            full
          />

          <Accordion
            title="Past Choices"
            subtitle={`${cached.length} cached match(es)`}
            open={pastChoicesOpen}
            onToggle={() => setPastChoicesOpen((v) => !v)}
          >
            {cached.length === 0 ? (
              <Text style={styles.muted}>No cached matches yet.</Text>
            ) : (
              <View>
                {cached.map((item) => {
                  const active = item.food_id === selectedFood?.food_id;
                  return (
                    <Pressable
                      key={item.food_id}
                      onPress={() => {
                        setSelectedFood(item);
                        setPastChoicesOpen(false);
                      }}
                      style={[styles.row, active ? styles.rowActive : null]}
                    >
                      <Text style={styles.rowTitle}>
                        {item.name} {item.brand ? `(${item.brand})` : ""}
                      </Text>
                      <Text style={styles.rowSub}>
                        source: {item.source} • fdc_id:{" "}
                        {String(item.fdc_id ?? "-")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Accordion>

          <Accordion
            title="USDA (FDC) Results"
            subtitle={`${fdc.length} result(s)`}
            open={usdaOpen}
            onToggle={() => setUsdaOpen((v) => !v)}
          >
            {fdc.length === 0 ? (
              <Text style={styles.muted}>No USDA results.</Text>
            ) : (
              <View>
                {fdc.map((item) => (
                  <View key={String(item.fdcId)} style={styles.usdaItem}>
                    <Text style={styles.rowTitle}>
                      {item.name} {item.brand ? `(${item.brand})` : ""}
                    </Text>
                    <Text style={styles.rowSub}>
                      fdcId: {item.fdcId} • {item.dataType ?? ""}
                    </Text>

                    <View style={{ height: 10 }} />

                    <View style={styles.btnRow}>
                      <View style={styles.btnRowItem}>
                        <PillButton
                          title="Import"
                          onPress={() => importFromFdc(item.fdcId, false)}
                          variant="primary"
                        />
                      </View>
                      <View style={styles.btnRowItem}>
                        <PillButton
                          title="Force Refresh"
                          onPress={() => importFromFdc(item.fdcId, true)}
                          variant="outline"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Accordion>
        </View>

        {/* Selected food */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected Food</Text>
          {selectedFood ? (
            <>
              <Text style={styles.selectedTitle}>
                {selectedFood.name}{" "}
                {selectedFood.brand ? `(${selectedFood.brand})` : ""}
              </Text>
              <Text style={styles.muted}>
                food_id: <Text style={styles.mono}>{selectedFood.food_id}</Text>
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>
              Pick a past choice or import from USDA.
            </Text>
          )}
        </View>

        {/* Conditions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conditions & Settings</Text>

          <Accordion
            title="Conditions"
            subtitle={conditionsSubtitle}
            open={conditionsOpen}
            onToggle={() => setConditionsOpen((v) => !v)}
          >
            <View style={styles.chipWrap}>
              <Chip
                label="KidneyDisease"
                selected={hasKidney}
                onPress={() => toggleCondition("KidneyDisease")}
              />
              <Chip
                label="IC"
                selected={hasIC}
                onPress={() => toggleCondition("IC")}
              />
              <Chip
                label="IBS"
                selected={hasIBS}
                onPress={() => toggleCondition("IBS")}
              />
              <Chip
                label="Crohns"
                selected={hasCrohns}
                onPress={() => toggleCondition("Crohns")}
              />
            </View>
          </Accordion>

          {hasKidney ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                Kidney Settings
              </Text>
              <Text style={styles.label}>Kidney stage (1–5): {kidneyStage}</Text>
              <View style={styles.chipWrap}>
                {[1, 2, 3, 4, 5].map((st) => (
                  <Chip
                    key={st}
                    label={String(st)}
                    selected={kidneyStage === st}
                    onPress={() => setKidneyStage(st)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {hasCrohns ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                Crohn’s Settings
              </Text>
              <Text style={styles.label}>Crohn’s state: {crohnsState}</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="stable"
                  selected={crohnsState === "stable"}
                  onPress={() => setCrohnsState("stable")}
                />
                <Chip
                  label="flare"
                  selected={crohnsState === "flare"}
                  onPress={() => setCrohnsState("flare")}
                />
              </View>
            </>
          ) : null}

          {hasIBS ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                IBS Settings
              </Text>
              <Text style={styles.label}>IBS mode: {ibsMode}</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="general"
                  selected={ibsMode === "general"}
                  onPress={() => setIbsMode("general")}
                />
                <Chip
                  label="lowFODMAP"
                  selected={ibsMode === "lowFODMAP"}
                  onPress={() => setIbsMode("lowFODMAP")}
                />
              </View>
            </>
          ) : null}
        </View>

        {/* Score */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score</Text>

          <PillButton
            title={scoring ? "Scoring..." : "Score Food"}
            onPress={runScore}
            variant="primary"
            disabled={!canScore || scoring}
            full
          />

          <View style={{ height: 14 }} />

          <Text style={styles.sectionTitle}>User Override</Text>
          <Text style={styles.muted}>(Requires login + selected food)</Text>

          <View style={{ height: 10 }} />

          <View style={styles.btnRow}>
            <View style={styles.btnRowItem}>
              <PillButton
                title={savingReaction ? "Saving..." : "Mark TRIGGER"}
                onPress={() => saveReaction("trigger")}
                variant="danger"
                disabled={savingReaction}
              />
            </View>
            <View style={styles.btnRowItem}>
              <PillButton
                title="Mark SAFE"
                onPress={() => saveReaction("safe")}
                variant="outline"
                disabled={savingReaction}
              />
            </View>
            <View style={styles.btnRowItem}>
              <PillButton
                title="Clear (unknown)"
                onPress={() => saveReaction("unknown")}
                variant="outline"
                disabled={savingReaction}
              />
            </View>
          </View>

          {score ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultFood}>
                {score.food.name} {score.food.brand ? `(${score.food.brand})` : ""}
              </Text>

              <Text style={[styles.resultRating, { color: ratingColor(score.rating) }]}>
                Rating: {score.rating.toUpperCase()}
              </Text>

              <Text style={styles.muted}>
                Conditions: {score.conditions?.length ? score.conditions.join(", ") : "none"}
              </Text>

              <Text style={[styles.label, { marginTop: 12 }]}>Reasons</Text>
              {score.reasons.map((r, idx) => (
                <Text key={idx} style={styles.reason}>
                  • {r}
                </Text>
              ))}

              <Text style={[styles.label, { marginTop: 14 }]}>Nutrition Facts</Text>

              <NutrientRow label="Calories" value={formatNum(n.calories_kcal, 0)} unit="kcal" />
              <NutrientRow label="Protein" value={formatNum(n.protein_g, 1)} unit="g" />
              <NutrientRow label="Carbs" value={formatNum(n.carbs_g, 1)} unit="g" />
              <NutrientRow label="Fat" value={formatNum(n.fat_g, 1)} unit="g" />

              <View style={styles.divider} />

              <NutrientRow label="Sodium" value={formatNum(n.sodium_mg, 0)} unit="mg" />
              <NutrientRow label="Potassium" value={formatNum(n.potassium_mg, 0)} unit="mg" />
              <NutrientRow label="Phosphorus" value={formatNum(n.phosphorus_mg, 0)} unit="mg" />
              <NutrientRow label="Fiber" value={formatNum(n.fiber_g, 1)} unit="g" />
              <NutrientRow label="Added sugars" value={formatNum(n.added_sugars_g, 1)} unit="g" />
              <NutrientRow label="Saturated fat" value={formatNum(n.saturated_fat_g, 1)} unit="g" />

              <View style={styles.divider} />

              <NutrientRow label="pH / Acidity Category" value={n.ph_category ?? "-"} />
              {n.ph_note ? <Text style={styles.note}>{n.ph_note}</Text> : null}
              <NutrientRow label="Acidic flag" value={String(n.acidic ?? false)} />
            </View>
          ) : null}
        </View>

        <Text style={styles.footer}>
          API Base: <Text style={styles.mono}>{API_BASE}</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30, paddingTop: 10 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  title: { fontSize: 28, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 4 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: COLORS.berryDark },

  label: { fontSize: 13, fontWeight: "900", color: COLORS.berryDark, marginBottom: 6 },
  muted: { color: COLORS.muted, fontSize: 13 },
  mono: {
    color: COLORS.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  inlineRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },

  btn: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.berry },
  btnOutline: { borderWidth: 1, borderColor: COLORS.berryDark, backgroundColor: "transparent" },
  btnDanger: { backgroundColor: COLORS.berryDark },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontWeight: "900" },
  btnTextPrimary: { color: COLORS.white },
  btnTextOutline: { color: COLORS.berryDark },
  btnTextDanger: { color: COLORS.white },

  btnRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  btnRowItem: { marginRight: 10, marginBottom: 10 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 10,
  },
  chipSelected: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  chipUnselected: { backgroundColor: "transparent", borderColor: COLORS.berryDark },
  chipText: { fontSize: 13, fontWeight: "900", color: COLORS.berryDark },
  chipTextSelected: { color: COLORS.berryDark },

  row: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
    backgroundColor: COLORS.bg,
  },
  rowActive: { borderColor: COLORS.berryDark },
  rowTitle: { color: COLORS.text, fontWeight: "900" },
  rowSub: { color: COLORS.muted, marginTop: 4, fontSize: 12 },

  selectedTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },

  accordion: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    marginTop: 14,
    overflow: "hidden",
    backgroundColor: COLORS.bg,
  },
  accordionHeader: {
    padding: 12,
    backgroundColor: COLORS.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accordionTitle: { color: COLORS.berryDark, fontWeight: "900", fontSize: 14 },
  accordionSub: { color: COLORS.muted, marginTop: 2, fontSize: 12 },
  accordionChevron: { color: COLORS.berryDark, fontSize: 18, fontWeight: "900" },
  accordionBody: { padding: 12 },

  usdaItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },

  resultCard: {
    marginTop: 14,
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultFood: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginBottom: 4 },
  resultRating: { fontSize: 15, fontWeight: "900", marginBottom: 6 },
  reason: { color: COLORS.text, marginTop: 6, fontSize: 13, lineHeight: 18 },

  divider: { marginVertical: 10, height: 1, backgroundColor: COLORS.border },

  nRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  nLabel: { color: COLORS.berryDark, fontSize: 13, fontWeight: "800" },
  nValue: { color: COLORS.text, fontSize: 13 },
  nUnit: { color: COLORS.muted, fontSize: 12 },

  note: { marginTop: 6, color: COLORS.berryDark, fontWeight: "900" },

  footer: { textAlign: "center", color: COLORS.muted, marginTop: 6 },
});