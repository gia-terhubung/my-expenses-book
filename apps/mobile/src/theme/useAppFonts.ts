import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { useFonts } from "expo-font";

import { FONTS } from "./fonts";

/**
 * True once the fonts are ready or failed to load (system font is the fallback), so the app is
 * never held on a blank screen. Kept apart from fonts.ts so tokens stay importable in node tests.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [FONTS.bold]: BricolageGrotesque_700Bold,
    [FONTS.extraBold]: BricolageGrotesque_800ExtraBold,
  });
  return loaded || error !== null;
}
