import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthScreen from "./AuthScreen";
import DemoScreen from "./DemoScreen";
import { COLORS } from "./theme";

type Session =
  | { kind: "guest" }
  | { kind: "user"; id: string; username: string; name: string; token: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
          <StatusBar style="dark" />
          <AuthScreen
            onGuest={() => setSession({ kind: "guest" })}
            onAuthed={(u) => setSession({ kind: "user", ...u })}
          />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <StatusBar style="dark" />
        <DemoScreen
          initialUserId={session.kind === "user" ? session.id : ""}
          headerName={session.kind === "user" ? session.name : "Guest"}
          sessionToken={session.kind === "user" ? session.token : ""}
          onLogout={() => setSession(null)}
        />
      </View>
    </SafeAreaProvider>
  );
}
