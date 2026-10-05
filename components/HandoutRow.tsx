import { Text, View } from "react-native";

import type { Handout } from "@/lib/api";
import { orderRef } from "@/lib/handover";
import { timeLabel } from "@/lib/handoutLog";

/**
 * One handover in a log: time, order, and — in the Admin view — who did it.
 * The time leads because staff scan the log by "when", not by order number.
 */
export function HandoutRow({ handout, showName = false }: { handout: Handout; showName?: boolean }) {
  return (
    <View
      className="min-h-14 flex-row items-center gap-4 border-b border-outline-subtle bg-surface px-4 py-3"
      accessibilityLabel={`${timeLabel(handout.at)}, order ${orderRef(handout.orderId)}${showName ? `, by ${handout.staffName}` : ""}`}
    >
      <Text className="w-20 text-body-lg font-bold text-text-primary">{timeLabel(handout.at)}</Text>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-body text-text-primary" numberOfLines={1}>
          Order {orderRef(handout.orderId)}
        </Text>
        {showName ? (
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {handout.staffName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
