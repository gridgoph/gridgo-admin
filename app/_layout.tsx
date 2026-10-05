import "../global.css";

import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import { colors, type ThemeName, typography } from "@/constants/theme";
import { useAccessBridge } from "@/hooks/useAccessBridge";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useHydrateTheme, useThemeColors, useThemeName } from "@/hooks/useTheme";
import { resolveClerkPublishableKey } from "@/lib/clerkAuth";
import { bounceToIsolatedDevWebHost, GRIDGO_DEV_WEB_HOST } from "@/lib/devWebHost";
import { useSession } from "@/store/session";

// Nothing may throw out of the launch path, including this.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/** React Navigation reads plain colours, so it gets them from the token file. */
function navigationTheme(scheme: ThemeName): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const token = colors[scheme];
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      background: token.canvas,
      card: token.surface,
      text: token.textPrimary,
      border: token.outline,
      primary: token.accent,
      notification: token.error,
    },
  };
}

function AppShell() {
  const scheme = useThemeName();
  const token = useThemeColors();
  const fontsReady = useAppFonts();
  const clerkLoaded = useAccessBridge();
  useHydrateTheme();

  const ready = fontsReady && clerkLoaded;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(token.canvas).catch(() => {});
  }, [token.canvas]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <ThemeProvider value={navigationTheme(scheme)}>
            {ready ? <RootStack /> : <View style={{ flex: 1, backgroundColor: token.canvas }} />}
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Routes are guarded, not merely hidden: a screen outside the account's
 * guard cannot be reached even by a deep link. Signed out → sign in. Signed in
 * while GRIDGO is still answering → the checking screen. Signed in with no
 * staff or admin access → the invite screen and nothing else.
 */
function RootStack() {
  const { isSignedIn } = useAuth();
  const phase = useSession((state) => state.phase);
  const access = useSession((state) => state.access);
  const token = useThemeColors();

  const signedIn = Boolean(isSignedIn);
  const resolved = signedIn && phase === "ready";
  const granted = resolved && access?.kind === "granted";

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: token.surface },
        headerTintColor: token.textPrimary,
        headerTitleStyle: {
          fontSize: typography.h3.fontSize,
          fontFamily: typography.h3.fontFamily,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: token.canvas },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sso-callback" options={{ headerShown: false, title: "Signing in" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !resolved}>
        <Stack.Screen name="checking" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={resolved && !granted}>
        <Stack.Screen name="invite" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={granted}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "GRIDGO" }} />
        <Stack.Screen name="escalate" options={{ title: "Escalate to Operations" }} />
      </Stack.Protected>
      {/* Invite links land here in any state; it hands the code on and leaves. */}
      <Stack.Screen name="redeem" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  if (bounceToIsolatedDevWebHost(GRIDGO_DEV_WEB_HOST)) return null;

  const publishableKey = resolveClerkPublishableKey(
    Constants.expoConfig?.extra?.clerkPublishableKey,
    __DEV__,
  );

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppShell />
    </ClerkProvider>
  );
}
