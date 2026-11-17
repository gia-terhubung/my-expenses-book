import type { ExpoConfig } from "expo/config";

// iOS deployment target = max(16.0, Expo SDK 58 minimum 16.4) = 16.4
const config: ExpoConfig = {
  name: "My Expenses Book",
  slug: "my-expenses-book",
  owner: "gia-terhubung",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "myexpensesbook",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: "com.terhubung.myexpensesbook",
    supportsTablet: true,
    // Standard OS/AES encryption only: exempt from export documentation (spec "Store prep").
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.terhubung.myexpensesbook",
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: "#FFD84A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "react-native-quick-crypto",
    "expo-localization",
    ["expo-local-authentication", { faceIDPermission: "Allow $(PRODUCT_NAME) to unlock your receipts with Face ID." }],
    ["expo-sqlite", { useSQLCipher: true }],
    "expo-iap",
    // Local StoreKit test prices for Xcode Debug runs (release builds use the real store).
    "./plugins/withStoreKitConfig",
    // Ruling V: the picker only reads the library; capture uses the document scanner, which needs
    // the iOS camera string. Listed first: the picker's `cameraPermission: false` would otherwise
    // strip NSCameraUsageDescription (the first plugin's Info.plist mod has the final say).
    [
      "react-native-document-scanner-plugin",
      { cameraPermission: "Allow $(PRODUCT_NAME) to use the camera to scan your receipts." },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to import receipt photos and screenshots from your library.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFD84A",
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
  extra: {
    eas: { projectId: "fd3b7771-9050-40f6-ad9f-3bf7a410d176" },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
