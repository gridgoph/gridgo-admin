import { ActivityIndicator, View } from "react-native";

import { Screen } from "@/components/Screen";
import { useThemeColors } from "@/hooks/useTheme";

/**
 * Native Google return. Clerk finishes the session here; the root guards then
 * move on to the access check, so this screen only has to wait.
 */
export default function SsoCallbackScreen() {
  const colors = useThemeColors();
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.textPrimary} accessibilityLabel="Signing in" />
      </View>
    </Screen>
  );
}
