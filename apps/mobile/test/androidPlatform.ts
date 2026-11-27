import { Platform } from "react-native";

/**
 * Runs a suite as Android. Screens draw their own page header there; on iOS (jest-expo's default)
 * they hand it to the native stack header instead, which the suite's own iOS tests cover.
 */
export function useAndroidPlatform() {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = "android";
  });
  afterAll(() => {
    Platform.OS = original;
  });
}
