import { Platform } from "react-native";

export const COLORS = {
  canvas: "#FFF8EA",
  surface: "#FFFFFF",
  surfaceSoft: "#F1F7EE",
  mint: "#D9EEDC",
  mintStrong: "#B9DDBF",
  green: "#174E3A",
  greenSoft: "#2E6A50",
  coral: "#F46F52",
  coralSoft: "#FFE2D9",
  gold: "#F4B942",
  ink: "#18332A",
  muted: "#66786F",
  border: "#DCE8DF",
  white: "#FFFFFF",
  danger: "#B7423A",
  dangerSoft: "#FDE8E5",
  warning: "#A86408",
  warningSoft: "#FFF0C9",
  success: "#25734B",
  successSoft: "#DCF2E4",
};

export const SHADOW = Platform.select({
  ios: {
    shadowColor: "#173D2F",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 2 },
  default: {},
});

export const TYPE = {
  display: Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "sans-serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "sans-serif" }),
};
