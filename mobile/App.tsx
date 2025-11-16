import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Switch,
  Button,
  ScrollView,
  StyleSheet,
} from "react-native";

type Rating = "eat" | "limit" | "avoid" | "";

interface ScoreResponse {
  food: string;
  conditions: string[];
  rating: Rating;
  reasons: string[];
}

export default function App() {
  const [foodName, setFoodName] = useState("banana");
  const [ckd, setCkd] = useState(true);
  const [bladder, setBladder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResponse | null>(null);

  const handleScoreFood = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const conditions: string[] = [];
      if (ckd) conditions.push("ckd");
      if (bladder) conditions.push("bladder");

      const response = await fetch("http://localhost:4000/score-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foodName,
          conditions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data: ScoreResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const ratingColor = (rating: Rating) => {
    switch (rating) {
      case "eat":
        return "#2e7d32"; // green-ish
      case "limit":
        return "#f9a825"; // yellow-ish
      case "avoid":
        return "#c62828"; // red-ish
      default:
        return "#333";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Condition Nutrition Demo</Text>
        <Text style={styles.subtitle}>
          Try scoring a food against CKD and bladder conditions.
        </Text>

        {/* Food input */}
        <View style={styles.section}>
          <Text style={styles.label}>Food name</Text>
          <TextInput
            style={styles.input}
            value={foodName}
            onChangeText={setFoodName}
            placeholder="e.g. banana"
          />
        </View>

        {/* Condition toggles */}
        <View style={styles.section}>
          <Text style={styles.label}>Conditions</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>CKD</Text>
            <Switch value={ckd} onValueChange={setCkd} />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Bladder</Text>
            <Switch value={bladder} onValueChange={setBladder} />
          </View>
        </View>

        {/* Score button */}
        <View style={styles.section}>
          <Button
            title={loading ? "Scoring..." : "Score Food"}
            onPress={handleScoreFood}
            disabled={loading || !foodName.trim()}
          />
        </View>

        {/* Error */}
        {error && (
          <View style={styles.section}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultFood}>{result.food}</Text>
            <Text
              style={[
                styles.resultRating,
                { color: ratingColor(result.rating) },
              ]}
            >
              Rating: {result.rating.toUpperCase()}
            </Text>
            <Text style={styles.resultConditions}>
              Conditions:{" "}
              {result.conditions.length > 0
                ? result.conditions.join(", ")
                : "none"}
            </Text>

            <View style={styles.reasonList}>
              {result.reasons.map((reason, index) => (
                <Text key={index} style={styles.reasonItem}>
                  • {reason}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827", // dark slate
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1f2933",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f9fafb",
    borderWidth: 1,
    borderColor: "#374151",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  toggleLabel: {
    fontSize: 15,
    color: "#e5e7eb",
  },
  errorText: {
    color: "#f87171",
  },
  resultCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  resultFood: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 4,
  },
  resultRating: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  resultConditions: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 8,
  },
  reasonList: {
    marginTop: 4,
  },
  reasonItem: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 2,
  },
});