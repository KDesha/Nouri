import React, { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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

type AuthResult = { id: string; username: string; name: string; token: string };

function Segmented({
  value,
  onChange,
}: {
  value: "login" | "signup";
  onChange: (value: "login" | "signup") => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {([
        ["login", "Log in"],
        ["signup", "Sign up"],
      ] as const).map(([key, label]) => {
        const selected = value === key;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={key}
            onPress={() => onChange(key)}
            style={[styles.segmentItem, selected && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AuthScreen({
  onAuthed,
  onGuest,
}: {
  onAuthed: (user: AuthResult) => void;
  onGuest: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim()) || password.length < 6) return false;
    return mode === "login" || !!name.trim();
  }, [mode, name, username, password]);

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError("");
  }

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const body =
        mode === "login"
          ? { username: username.trim(), password }
          : { username: username.trim(), password, name: name.trim() };

      const user = await apiRequest<AuthResult>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onAuthed(user);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image source={require("./assets/nouri-icon.png")} style={styles.logo} />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>FOOD THAT FITS YOU</Text>
              <Text style={styles.title}>Meet Nouri</Text>
              <Text style={styles.subtitle}>
                Clearer nutrition guidance, shaped around your body and your goals.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Segmented value={mode} onChange={switchMode} />

            {mode === "signup" ? (
              <View style={styles.field}>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  autoCapitalize="words"
                  autoComplete="name"
                  onChangeText={setName}
                  placeholder="Kayla"
                  placeholderTextColor={COLORS.muted}
                  returnKeyType="next"
                  style={styles.input}
                  value={name}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoComplete="username"
                onChangeText={setUsername}
                placeholder="3–30 letters or numbers"
                placeholderTextColor={COLORS.muted}
                returnKeyType="next"
                style={styles.input}
                value={username}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.muted}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit || loading}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryButton,
                (!canSubmit || loading) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "One moment…" : mode === "login" ? "Log in" : "Create my account"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onGuest}
              style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
            >
              <Text style={styles.guestButtonText}>Explore as a guest</Text>
            </Pressable>
          </View>

          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>🥕</Text>
            <Text style={styles.tipText}>
              Search USDA nutrition data, compare it with your needs, and remember what works for you.
            </Text>
          </View>

          <Text style={styles.disclaimer}>
            Nouri offers educational guidance, not medical diagnosis or treatment.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 28 },
  hero: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
  logo: { width: 92, height: 92, borderRadius: 28, marginRight: 16 },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: COLORS.coral,
    fontFamily: TYPE.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: COLORS.green,
    fontFamily: TYPE.display,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 3,
  },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    ...SHADOW,
  },
  segment: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 18,
    padding: 4,
  },
  segmentItem: { alignItems: "center", borderRadius: 13, flex: 1, paddingVertical: 10 },
  segmentItemActive: { backgroundColor: COLORS.green },
  segmentText: { color: COLORS.greenSoft, fontSize: 14, fontWeight: "800" },
  segmentTextActive: { color: COLORS.white },
  field: { marginBottom: 14 },
  label: { color: COLORS.ink, fontSize: 13, fontWeight: "800", marginBottom: 7 },
  input: {
    backgroundColor: COLORS.canvas,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    color: COLORS.ink,
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  errorText: { color: COLORS.danger, fontSize: 13, lineHeight: 18 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.coral,
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  guestButton: {
    alignItems: "center",
    borderColor: COLORS.green,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 10,
    paddingVertical: 13,
  },
  guestButtonText: { color: COLORS.green, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  tipRow: {
    alignItems: "center",
    backgroundColor: COLORS.mint,
    borderRadius: 20,
    flexDirection: "row",
    marginTop: 18,
    padding: 15,
  },
  tipIcon: { fontSize: 24, marginRight: 12 },
  tipText: { color: COLORS.green, flex: 1, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 18, textAlign: "center" },
});
