import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { HandoutRow } from "@/components/HandoutRow";
import { InlineNotice } from "@/components/InlineNotice";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useThemeColors } from "@/hooks/useTheme";
import { usePagedFeed } from "@/hooks/usePagedFeed";
import { roleLabel, staffRequestRole } from "@/lib/access";
import { listMyHandouts, type Handout, type StaffTotal } from "@/lib/api";
import { countToday, groupByDay, ownTotal } from "@/lib/handoutLog";
import { useSession } from "@/store/session";

/**
 * The staff member's own running log: who (their name), how many, when.
 * Every row is a handover the API recorded under this account.
 */
export default function HandoversScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const access = useSession((state) => state.access);
  const staff = access?.kind === "granted" ? access.staff : null;
  const role = staffRequestRole(access);
  const feed = usePagedFeed<Handout, StaffTotal[]>(async (before) => {
    const page = await listMyHandouts(role, before);
    return { items: page.handouts, meta: page.staffTotals, nextCursor: page.nextCursor };
  }, Boolean(staff));

  const total = ownTotal(feed.meta, staff?.id ?? null);
  const today = countToday(feed.items);
  const sections = groupByDay(feed.items);

  return (
    <Screen edges={["top", "left", "right"]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HandoutRow handout={item} />}
        renderSectionHeader={({ section }) => (
          <View className="bg-canvas px-4 pb-2 pt-5">
            <Text className="text-body font-bold text-text-secondary">{section.title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={() => void feed.refresh()}
            tintColor={colors.textPrimary}
          />
        }
        ListHeaderComponent={
          <View className="gap-5 px-4 pb-2 pt-4">
            <View className="gap-1">
              <Text className="text-h1 text-text-primary" accessibilityRole="header">
                My handovers
              </Text>
              {staff ? (
                <Text className="text-body-lg text-text-secondary">
                  {staff.name}, {roleLabel(staff.role, staff.roleName)}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-3">
              <Tally label="Today" value={feed.loading ? null : today} />
              <Tally label="All time" value={feed.loading ? null : total} />
            </View>
            {feed.error ? (
              <InlineNotice tone="error" icon="circle-x" title="Log not loaded" body={feed.error} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          feed.loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.textPrimary} accessibilityLabel="Loading handovers" />
            </View>
          ) : feed.error ? null : (
            <EmptyState
              icon="handovers"
              title="No handovers yet"
              body="Each pick-up you hand over after a matching QR and code is logged here with its time."
              actionLabel={staff?.canHandout ? "Scan a pick-up QR" : undefined}
              onAction={staff?.canHandout ? () => router.navigate("/scan") : undefined}
              secondaryAction
            />
          )
        }
        ListFooterComponent={
          feed.hasMore ? (
            <View className="p-4">
              <SecondaryButton
                label={feed.loadingMore ? "Loading…" : "Show older handovers"}
                onPress={() => void feed.loadMore()}
                disabled={feed.loadingMore}
              />
            </View>
          ) : (
            <View className="h-6" />
          )
        }
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: colors.canvas }}
      />
    </Screen>
  );
}

/** A count staff read at arm's length. */
function Tally({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-1 gap-1 rounded-card border border-outline bg-surface p-4" accessibilityLabel={`${label}: ${value ?? "loading"}`}>
      <Text className="text-body text-text-secondary">{label}</Text>
      <Text className="text-display text-text-primary">{value ?? "–"}</Text>
    </View>
  );
}
