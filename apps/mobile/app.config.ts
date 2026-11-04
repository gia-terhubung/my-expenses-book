import type { ExpoConfig } from "expo/config";

// iOS deployment target = max(16.0, Expo SDK 58 minimum 16.4) = 16.4
const config: ExpoConfig = {
  name: "My Expenses Book",
  slug: "my-expenses-book",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "myexpensesbook",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: "com.terhubung.myexpensesbook",
    supportsTablet: true,
  },
  android: {
    package: "com.terhubung.myexpensesbook",
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "server",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "react-native-quick-crypto",
    "expo-localization",
    ["expo-sqlite", { useSQLCipher: true }],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
    [
      "expo-build-properties",
      {
        android: { minSdkVersion: 26 },
        ios: { deploymentTarget: "16.4" },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
