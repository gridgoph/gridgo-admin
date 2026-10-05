import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import { colorScheme as cssColorScheme } from "react-native-css";

import { colors, type ThemeName } from "@/constants/theme";

/**
 * Theme preference and resolved theme colours.
 *
 * Light and Dark are the same product with different presentation. Follow the
 * system preference by default, with an in-app override persisted to
 * AsyncStorage so the choice survives restarts.
 *
 * Screens should style with NativeWind classes — `bg-canvas`, `text-text-primary`
 * — which already resolve per theme. Use `useThemeColors` only where a class
 * cannot go: navigation themes, the status bar, map styles.
 */

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "gridgo.themePreference";

let preference: ThemePreference = "system";
let hydrated = false;
const listeners = new Set<() => void>();

function applyPreference(next: ThemePreference) {
  // `setColorScheme` is native-only: react-native-web has no writable
  // appearance, so calling it there throws and takes the whole toggle down —
  // which is what an in-app theme switch did on Expo web, the one target this
  // project screenshots from. The CSS layer below is what actually repaints,
  // so losing the native echo costs nothing on the platform that lacks it.
  Appearance.setColorScheme?.(next === "system" ? "unspecified" : next);

  // react-native-css keeps its own colour-scheme observable, seeded from
  // Appearance and updated by its change listener. Push the value directly so
  // the CSS layer switches on the same frame rather than waiting for the
  // native echo, which platforms deliver at different times.
  cssColorScheme.set(
    next === "system" ? (Appearance.getColorScheme() ?? "unspecified") : next,
  );
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setThemePreference(next: ThemePreference) {
  if (next === preference) return;
  preference = next;
  applyPreference(next);
  notify();
  void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
    // Preference still applies in-memory if persistence fails.
  });
}

/** Load the stored preference once at app start. Safe to call repeatedly. */
export async function hydrateThemePreference(): Promise<void> {
  if (hydrated) return;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "system" || stored === "light" || stored === "dark") {
      preference = stored;
      applyPreference(stored);
      notify();
    }
  } catch {
    // Keep default "system".
  } finally {
    hydrated = true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPreference() {
  return preference;
}

/** The user's choice: follow the system, or a pinned theme. */
export function useThemePreference() {
  return useSyncExternalStore(subscribe, getPreference, getPreference);
}

/** The theme actually in effect, after the preference is applied. */
export function useThemeName(): ThemeName {
  const scheme = useSyncExternalStore(
    (listener) => {
      const subscription = Appearance.addChangeListener(listener);
      return () => subscription.remove();
    },
    () => Appearance.getColorScheme(),
    () => Appearance.getColorScheme(),
  );

  return scheme === "dark" ? "dark" : "light";
}

/** Token values for the theme in effect. */
export function useThemeColors() {
  return colors[useThemeName()];
}

/** Kick hydration from a layout component. */
export function useHydrateTheme() {
  useEffect(() => {
    void hydrateThemePreference();
  }, []);
}
