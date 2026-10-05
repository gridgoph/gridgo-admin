import { useClerk } from "@clerk/expo";
import { ActivityIndicator, Text, View } from "react-native";

import { GridgoLogo } from "@/components/GridgoLogo";
import { InlineNotice } from "@/components/InlineNotice";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useThemeColors } from "@/hooks/useTheme";
import { useSession } from "@/store/session";

/** Signed in; GRIDGO has not answered yet, or could not be reached. */
export default function CheckingScreen() {
  const colors = useThemeColors();
  const { signOut } = useClerk();
  const phase = useSession((state) => state.phase);
  const error = useSession((state) => state.error);
  const refresh = useSession((state) => state.refresh);

  return (
    <Screen>
      <View className="gg-page flex-1 justify-center gap-8">
        <GridgoLogo role="admin" size={22} />
        {phase === "error" ? (
          <View className="gap-4">
            <InlineNotice
              tone="error"
              icon="circle-x"
              title="Could not check your access"
              body={error}
            />
            <PrimaryButton label="Try again" onPress={() => void refresh()} size="large" />
            <SecondaryButton label="Sign out" onPress={() => void signOut()} size="large" />
          </View>
        ) : (
          <View className="flex-row items-center gap-3" accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.textPrimary} />
            <Text className="text-body-lg text-text-secondary">Checking your staff access…</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
