import React, { useState } from "react";
import AuthScreen from "./AuthScreen";
import DemoScreen from "./DemoScreen";

type Session =
  | { kind: "guest" }
  | { kind: "user"; id: string; username: string; name: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <AuthScreen
        onGuest={() => setSession({ kind: "guest" })}
        onAuthed={(u) => setSession({ kind: "user", ...u })}
      />
    );
  }

  return (
    <DemoScreen
      initialUserId={session.kind === "user" ? session.id : ""}
      headerName={session.kind === "user" ? session.name : "Guest"}
      onLogout={() => setSession(null)}
    />
  );
}