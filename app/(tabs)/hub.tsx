import { useFocusEffect } from "expo-router";
import { Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { InlineNotice } from "@/components/InlineNotice";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusChip } from "@/components/StatusChip";
import { useThemeColors } from "@/hooks/useTheme";
import { hubReadRole } from "@/lib/access";
import { apiErrorMessage, getHub, type Hub } from "@/lib/api";
import { hubDayKey, hubDaysLabel, hubToday } from "@/lib/hubSchedule";
import { useSession } from "@/store/session";
import { useSop } from "@/store/sop";

/**
 * Hub duty: today's hours and the standard operating procedure as a
 * checklist. The steps are GRIDGO's (`GET /staff/hub`), never this app's copy.
 */
export default function HubScreen() {
  const colors = useThemeColors();
  const access = useSession((state) => state.access);
  const role = hubReadRole(access);
  const [hub, setHub] = useState<Hub | null>(null);
  const [sop, setSop] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = useSop((state) => state.checked);
  const toggle = useSop((state) => state.toggle);
  const clear = useSop((state) => state.clear);

  const read = useCallback(
    async (pulled: boolean) => {
      if (!role) return;
      if (pulled) setRefreshing(true);
      try {
        const result = await getHub(role);
        await useSop.getState().hydrate(hubDayKey(new Date(), result.hub.schedule.utcOffsetMinutes));
        setHub(result.hub);
        setSop(result.sop);
        setError(null);
      } catch (caught) {
        setError(apiErrorMessage(caught, "Hub details did not load. Pull down to try again."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role],
  );

  useFocusEffect(
    useCallback(() => {
      void read(false);
    }, [read]),
  );

  const today = hub ? hubToday(hub.schedule) : null;
  const done = sop.filter((item) => checked.includes(item)).length;
  const allDone = sop.length > 0 && done === sop.length;

  return (
    <Screen edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerClassName="gap-6 px-4 pb-8 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void read(true)} tintColor={colors.textPrimary} />
        }
      >
        <View className="gap-1">
          <Text className="text-h1 text-text-primary" accessibilityRole="header">
            Hub duty
          </Text>
          {hub ? <Text className="text-body-lg text-text-secondary">{hub.name}</Text> : null}
        </View>

        {error ? <InlineNotice tone="error" icon="circle-x" title="Not loaded" body={error} /> : null}
        {loading && !hub ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.textPrimary} accessibilityLabel="Loading hub duty" />
          </View>
        ) : null}

        {hub && today ? (
          <View className="gg-card gap-3">
            {today.kind === "open" ? (
              <StatusChip tone="success" icon="clock" label="Open today" />
            ) : (
              <StatusChip tone="neutral" icon="clock" label="Closed today" />
            )}
            <Text className="text-h2 text-text-primary">
              {today.kind === "open"
                ? today.label
                : today.reason === "closure"
                  ? "Hub closure"
                  : "Not a hub day"}
            </Text>
            <Text className="text-body text-text-secondary">
              Hub days: {hubDaysLabel(hub.schedule) || "none set"}
              {hub.point?.label ? `. ${hub.point.label}.` : "."}
            </Text>
          </View>
        ) : null}

        {sop.length ? (
          <View className="gap-3">
            <View className="flex-row items-end justify-between">
              <Text className="text-h3 text-text-primary">Before and during your shift</Text>
              <Text className="text-body text-text-secondary" accessibilityLiveRegion="polite">
                {done} of {sop.length}
              </Text>
            </View>
            <View className="gg-card-flush">
              {sop.map((item, index) => {
                const on = checked.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggle(item)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item}
                    className={`min-h-16 flex-row items-center gap-4 px-4 py-3 ${index ? "border-t border-outline-subtle" : ""}`}
                    style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
                    testID={`sop-${index}`}
                  >
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-sm border-2 ${on ? "border-accent bg-accent" : "border-outline bg-surface"}`}
                    >
                      {on ? <Check size={18} color={colors.accentOn} strokeWidth={3} /> : null}
                    </View>
                    <Text
                      className={`min-w-0 flex-1 text-body-lg ${on ? "text-text-muted" : "text-text-primary"}`}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {allDone ? (
              <InlineNotice
                tone="success"
                icon="circle-check"
                title="Checklist done"
                body="Keep following these steps for every handover this shift."
              />
            ) : null}
            {done > 0 ? <SecondaryButton label="Untick all" onPress={clear} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
