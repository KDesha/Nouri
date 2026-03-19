import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";

const API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

type AuthResult = { id: string; username: string; name: string };

const COLORS = {
  bg: "#EFE6E0", // beige-white background
  card: "#E9DBD3", // light pink boxes
  text: "#2B1B1E",
  muted: "#6B4B52",
  border: "#D8C6C1",
  accentDark: "#7A1E2D", // darker red (dropdown/labels)
  berry: "#E35676", // lighter berry red (login button)
  berryDark: "#C84560",
  white: "#FFFFFF",
};

function PillButton({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === "primary" ? styles.btnPrimary : styles.btnOutline,
        disabled ? styles.btnDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === "primary" ? styles.btnTextPrimary : styles.btnTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.segmentItem,
              active ? styles.segmentItemActive : null,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                active ? styles.segmentTextActive : null,
              ]}
            >
              {opt.label}
            </Text>
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
  const [username, setUsername] = useState("kayla");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!username.trim() || password.length < 6) return false;
    if (mode === "signup" && !name.trim()) return false;
    return true;
  }, [mode, name, username, password]);

  async function submit() {
    setLoading(true);
    try {
      const url =
        mode === "login" ? `${API_BASE}/auth/login` : `${API_BASE}/auth/signup`;
      const body =
        mode === "login"
          ? { username: username.trim(), password }
          : { username: username.trim(), password, name: name.trim() };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Auth failed");

      onAuthed(data as AuthResult);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nouri</Text>
          <Text style={styles.subtitle}>Log in or continue as guest</Text>
        </View>

        <View style={styles.card}>
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as any)}
            options={[
              { key: "login", label: "Login" },
              { key: "signup", label: "Sign up" },
            ]}
          />

          {mode === "signup" ? (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                autoCapitalize="words"
              />
              <View style={{ height: 12 }} />
            </>
          ) : null}

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={{ height: 12 }} />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="min 6 characters"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            secureTextEntry
          />

          <View style={{ height: 14 }} />

          <PillButton
            title={
              loading
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Login"
                  : "Create Account"
            }
            onPress={submit}
            disabled={!canSubmit || loading}
            variant="primary"
          />

          <View style={{ height: 10 }} />

          <PillButton title="Continue as Guest" onPress={onGuest} variant="outline" />
        </View>

        <Text style={styles.footer}>
          API: <Text style={styles.mono}>{API_BASE}</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 30 },

  header: { marginTop: 10, marginBottom: 16 },
  title: { color: COLORS.accentDark, fontSize: 34, fontWeight: "900" },
  subtitle: { color: COLORS.muted, marginTop: 6, fontSize: 14 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentItemActive: { backgroundColor: COLORS.white },
  segmentText: { color: COLORS.accentDark, fontWeight: "800" },
  segmentTextActive: { color: COLORS.accentDark },

  label: { color: COLORS.accentDark, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
  },

  btn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: COLORS.berry },
  btnOutline: {
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    backgroundColor: "transparent",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontWeight: "900" },
  btnTextPrimary: { color: COLORS.white },
  btnTextOutline: { color: COLORS.accentDark },

  footer: { marginTop: 14, textAlign: "center", color: COLORS.muted },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: COLORS.accentDark,
  },
});