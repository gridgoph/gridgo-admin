import { ExternalLink } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { HandoutRow } from "@/components/HandoutRow";
import { InlineNotice } from "@/components/InlineNotice";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useThemeColors } from "@/hooks/useTheme";
import { usePagedFeed } from "@/hooks/usePagedFeed";
import {
  apiErrorMessage,
  getDownloadUrl,
  listAllHandouts,
  listReceiptScans,
  type Handout,
  type ReceiptScan,
  type RequestRole,
  type StaffTotal,
} from "@/lib/api";
import { orderRef } from "@/lib/handover";
import { dayTitle, rankTotals, timeLabel } from "@/lib/handoutLog";
import { useSession } from "@/store/session";

type View_ = "handovers" | "receipts";

const SEGMENTS = [
  { id: "handovers", label: "Staff handovers" },
  { id: "receipts", label: "Receipt scans" },
] as const;

/**
 * Operations / Super Admin: every staff member's handovers, and the
 * receipt-scan feed. Both are read with the admin membership, never staff.
 */
export default function AdminScreen() {
  const access = useSession((state) => state.access);
  const role = access?.kind === "granted" ? access.adminRole : null;
  const [view, setView] = useState<View_>("handovers");

  return (
    <Screen edges={["top", "left", "right"]}>
      <View className="gap-4 px-4 pb-3 pt-4">
        <Text className="text-h1 text-text-primary" accessibilityRole="header">
          Admin
        </Text>
        <SegmentedControl label="Show" segments={SEGMENTS} value={view} onChange={setView} hideLabel />
      </View>
      {role ? (
        view === "handovers" ? (
          <AllHandovers role={role} />
        ) : (
          <ReceiptScans role={role} />
        )
      ) : null}
    </Screen>
  );
}

function AllHandovers({ role }: { role: RequestRole }) {
  const colors = useThemeColors();
  const feed = usePagedFeed<Handout, StaffTotal[]>(async (before) => {
    const page = await listAllHandouts(role, before);
    return { items: page.handouts, meta: page.staffTotals, nextCursor: page.nextCursor };
  });
  const totals = rankTotals(feed.meta ?? []);

  return (
    <FlatList
      data={feed.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <HandoutRow handout={item} showName />}
      refreshControl={
        <RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.refresh()} tintColor={colors.textPrimary} />
      }
      ListHeaderComponent={
        <View className="gap-4 px-4 pb-4">
          {feed.error ? <InlineNotice tone="error" icon="circle-x" title="Not loaded" body={feed.error} /> : null}
          {totals.length ? (
            <View className="gg-card-flush" accessibilityLabel="Handovers per staff member">
              {totals.map((total, index) => (
                <View
                  key={total.staffId}
                  className={`min-h-14 flex-row items-center justify-between px-4 py-3 ${index ? "border-t border-outline-subtle" : ""}`}
                >
                  <Text className="min-w-0 flex-1 text-body-lg text-text-primary" numberOfLines={1}>
                    {total.name}
                  </Text>
                  <Text className="text-h3 text-text-primary">{total.count}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {feed.items.length ? (
            <Text className="pt-2 text-body font-bold text-text-secondary">Latest handovers</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        feed.loading ? (
          <Loading label="Loading handovers" />
        ) : feed.error ? null : (
          <EmptyState
            icon="handovers"
            title="No handovers yet"
            body="When hub staff hand over a pick-up order, it appears here with their name and the time."
          />
        )
      }
      ListFooterComponent={<More feed={feed} label="Show older handovers" />}
      contentContainerStyle={{ flexGrow: 1 }}
    />
  );
}

function ReceiptScans({ role }: { role: RequestRole }) {
  const colors = useThemeColors();
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const feed = usePagedFeed<ReceiptScan, null>(async (before) => {
    const page = await listReceiptScans(role, before);
    return { items: page.scans, meta: null, nextCursor: page.nextCursor };
  });

  async function open(scan: ReceiptScan) {
    if (opening) return;
    setOpening(scan.fileId);
    setOpenError(null);
    try {
      // A signed link lives minutes: fetch it at the tap, never keep it.
      const link = await getDownloadUrl(role, scan.fileId);
      await Linking.openURL(link.url);
    } catch (caught) {
      setOpenError(apiErrorMessage(caught, "The scan did not open. Try again."));
    } finally {
      setOpening(null);
    }
  }

  return (
    <FlatList
      data={feed.items}
      keyExtractor={(item) => `${item.fileId}:${item.orderId}`}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => void open(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open receipt scan for order ${orderRef(item.orderId)}`}
          className="min-h-16 flex-row items-center gap-4 border-b border-outline-subtle bg-surface px-4 py-3"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-body-lg font-bold text-text-primary" numberOfLines={1}>
              Order {orderRef(item.orderId)}
            </Text>
            <Text className="text-caption text-text-secondary" numberOfLines={1}>
              {dayTitle(item.at)}, {timeLabel(item.at)}
            </Text>
          </View>
          {opening === item.fileId ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <ExternalLink size={20} color={colors.textSecondary} />
          )}
        </Pressable>
      )}
      refreshControl={
        <RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.refresh()} tintColor={colors.textPrimary} />
      }
      ListHeaderComponent={
        feed.error || openError ? (
          <View className="gap-3 px-4 pb-4">
            {feed.error ? <InlineNotice tone="error" icon="circle-x" title="Not loaded" body={feed.error} /> : null}
            {openError ? <InlineNotice tone="error" icon="circle-x" title="Scan not opened" body={openError} /> : null}
          </View>
        ) : null
      }
      ListEmptyComponent={
        feed.loading ? (
          <Loading label="Loading receipt scans" />
        ) : feed.error ? null : (
          <EmptyState
            icon="receipts"
            title="No receipt scans yet"
            body="When a shop attaches its invoice to an order, the scan appears here. Pull down to check again."
          />
        )
      }
      ListFooterComponent={<More feed={feed} label="Show older scans" />}
      contentContainerStyle={{ flexGrow: 1 }}
    />
  );
}

function Loading({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View className="items-center py-10">
      <ActivityIndicator color={colors.textPrimary} accessibilityLabel={label} />
    </View>
  );
}

function More({
  feed,
  label,
}: {
  feed: { hasMore: boolean; loadingMore: boolean; loadMore: () => Promise<void> };
  label: string;
}) {
  if (!feed.hasMore) return <View className="h-6" />;
  return (
    <View className="p-4">
      <SecondaryButton
        label={feed.loadingMore ? "Loading…" : label}
        onPress={() => void feed.loadMore()}
        disabled={feed.loadingMore}
      />
    </View>
  );
}
