import { useFonts } from "expo-font";

import { fontAssets } from "@/constants/fonts";

/**
 * Loads the app's typefaces.
 *
 * Release/dev-client builds embed the files through the expo-font config
 * plugin, so `useFonts` resolves immediately (already loaded natively). Expo
 * Go has no plugin copy, so this is the path that actually fetches the `.otf`
 * files from Metro. Keep both: dropping either leaves one of those runtimes
 * on the system UI font.
 *
 * Returns true once the app may render. A font that fails to load resolves to
 * true as well: the platform system font is a usable fallback, and blocking on
 * a bad file would leave the user on a splash screen with no explanation.
 *
 * While `fontAssets` is empty this resolves immediately.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);

  if (__DEV__ && error) {
    // Worth saying out loud: Android renders text in an unloaded family as
    // nothing at all, so a swallowed font error looks like a blank screen
    // rather than like fallback type.
    console.warn(`[GRIDGO launch] fonts failed to load: ${String(error)}`);
  }

  return loaded || error !== null;
}
