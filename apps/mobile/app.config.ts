import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blessed Ave Admin",
  slug: "blessed-ave-admin",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "blessedave",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1c1917",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.blessedave.admin",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1c1917",
    },
    package: "com.blessedave.admin",
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
    eas: { projectId: "your-eas-project-id" },
  },
  plugins: ["expo-router", "expo-secure-store"],
});
