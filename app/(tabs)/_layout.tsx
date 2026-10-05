import { Tabs } from "expo-router";
import {
  ClipboardList,
  LayoutList,
  ScanLine,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";
import { accessTabs } from "@/lib/access";
import { useSession } from "@/store/session";

/**
 * Scan · My handovers · Hub duty · Admin · Account.
 *
 * Tabs follow access, not decoration: a role that cannot hand out orders has
 * no Scan tab, and only Operations / Super Admin see Admin. Guarded routes
 * cannot be reached at all, not merely hidden from the bar. The first
 * visible tab is where the app opens — Scan for hub staff.
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  const access = useSession((state) => state.access);
  const tabs = accessTabs(access);

  function icon(Icon: LucideIcon) {
    function TabIcon({ focused }: { focused: boolean }) {
      // The selected tab is one of the few places actionYellow is allowed.
      return (
        <View
          className={`h-8 w-14 items-center justify-center rounded-pill ${focused ? "bg-action-yellow" : ""}`}
        >
          <Icon
            size={22}
            color={focused ? colors.actionYellowOn : colors.textSecondary}
            strokeWidth={focused ? 2.25 : 1.75}
          />
        </View>
      );
    }
    return TabIcon;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
          minHeight: 64,
        },
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: {
          fontFamily: typography.caption.fontFamily,
          fontSize: typography.caption.fontSize,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: "below-icon",
      }}
    >
      <Tabs.Protected guard={tabs.scan}>
        <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: icon(ScanLine) }} />
      </Tabs.Protected>
      <Tabs.Protected guard={tabs.handovers}>
        <Tabs.Screen name="handovers" options={{ title: "My handovers", tabBarIcon: icon(LayoutList) }} />
      </Tabs.Protected>
      <Tabs.Protected guard={tabs.hub}>
        <Tabs.Screen name="hub" options={{ title: "Hub duty", tabBarIcon: icon(ClipboardList) }} />
      </Tabs.Protected>
      <Tabs.Protected guard={tabs.admin}>
        <Tabs.Screen name="admin" options={{ title: "Admin", tabBarIcon: icon(ShieldCheck) }} />
      </Tabs.Protected>
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}
