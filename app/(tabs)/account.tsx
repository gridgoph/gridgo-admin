import { useClerk, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import { ScrollView, Text, View } from "react-native";

import { GridgoLogo } from "@/components/GridgoLogo";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/hooks/useTheme";
import { roleLabel } from "@/lib/access";
import { useScan } from "@/store/scan";
import { useSession } from "@/store/session";

const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

/** Who is signed in, with which access, plus theme and sign-out. */
export default function AccountScreen() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const access = useSession((state) => state.access);
  const preference = useThemePreference();
  const granted = access?.kind === "granted" ? access : null;

  return (
    <Screen edges={["top", "left", "right"]}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4">
        <Text className="text-h1 text-text-primary" accessibilityRole="header">
          Account
        </Text>

        <View className="gg-card gap-4">
          <View className="gap-1">
            <Text className="text-h3 text-text-primary">{granted?.name ?? "GRIDGO staff"}</Text>
            {user?.primaryEmailAddress?.emailAddress ? (
              <Text className="text-body text-text-secondary">{user.primaryEmailAddress.emailAddress}</Text>
            ) : null}
          </View>
          <View className="gap-2 border-t border-outline-subtle pt-4">
            {granted?.staff && granted.staffRole === "staff" ? (
              <Row
                label="Staff role"
                value={`${roleLabel(granted.staff.role)}${granted.staff.canHandout ? ", can hand out orders" : ""}`}
              />
            ) : null}
            {granted?.adminRole ? (
              <Row
                label="Admin access"
                value={`${roleLabel(granted.adminRole)}${
                  granted.staffRole === granted.adminRole && granted.staff?.canHandout ? ", can hand out orders" : ""
                }`}
              />
            ) : null}
          </View>
        </View>

        <SegmentedControl<ThemePreference>
          label="Theme"
          segments={THEMES}
          value={preference}
          onChange={setThemePreference}
        />

        <SecondaryButton
          label="Sign out"
          onPress={() => {
            useScan.getState().reset();
            void signOut();
          }}
          size="large"
        />

        <View className="items-center gap-2 pt-4">
          <GridgoLogo role="admin" size={16} />
          <Text className="text-caption text-text-muted">Version {Constants.expoConfig?.version ?? "–"}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-caption text-text-muted">{label}</Text>
      <Text className="text-body-lg text-text-primary">{value}</Text>
    </View>
  );
}
