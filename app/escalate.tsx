import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { FormScroll } from "@/components/FormScroll";
import { InlineNotice } from "@/components/InlineNotice";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { defaultEscalationReason, orderRef } from "@/lib/handover";
import { useScan } from "@/store/scan";

const REASON_LIMIT = 500;

/**
 * Report a refused handover to Operations and Super Admin.
 *
 * An escalation is a report, not an override: the package still stays on the
 * counter until Operations answers. The scanned QR goes with the report so
 * the API can tie it to the package actually at the hub.
 */
export default function EscalateScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const outcome = useScan((state) => state.outcome);
  const escalate = useScan((state) => state.escalate);
  const [reason, setReason] = useState(() => (outcome ? defaultEscalationReason(outcome) : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path =
    outcome && (outcome.kind === "mismatch" || outcome.kind === "locked") ? outcome.escalatePath : null;
  const orderId = path?.split("/")[2] ?? null;
  const trimmed = reason.trim();

  async function send() {
    if (busy || !trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await escalate(trimmed);
      router.back();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The report did not reach Operations. Try again, or call them."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={["bottom", "left", "right"]}>
      <FormScroll contentClassName="gg-page grow gap-6 py-6">
        <View className="gap-2">
          <Text className="text-h2 text-text-primary" accessibilityRole="header">
            Tell Operations what happened
          </Text>
          <Text className="text-body-lg text-text-secondary">
            Operations and Super Admin are alerted at once. Keep the package on the counter until they reply.
          </Text>
          {orderId ? (
            <Text className="text-body text-text-muted">Order {orderRef(decodeURIComponent(orderId))}</Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-body font-medium text-text-primary">What happened</Text>
          <TextInput
            value={reason}
            onChangeText={(next) => {
              setReason(next.slice(0, REASON_LIMIT));
              setError(null);
            }}
            multiline
            placeholderTextColor={colors.textMuted}
            placeholder="Describe the mismatch"
            accessibilityLabel="What happened"
            className="min-h-32 rounded-field border border-outline bg-surface py-3 text-body text-text-primary"
            style={{ ...fieldInputStyle, textAlignVertical: "top" }}
            testID="escalation-reason"
          />
          <Text className="text-caption text-text-muted">
            {reason.length} / {REASON_LIMIT}
          </Text>
        </View>

        {!path ? (
          <InlineNotice
            tone="warning"
            icon="triangle-alert"
            title="Call Operations"
            body="This handover cannot be reported from the app. Call Operations."
          />
        ) : null}
        {error ? <InlineNotice tone="error" icon="circle-x" title="Not sent" body={error} /> : null}

        <PrimaryButton
          label={busy ? "Sending…" : "Send to Operations"}
          onPress={() => void send()}
          disabled={busy || !trimmed || !path}
          size="large"
        />
      </FormScroll>
    </Screen>
  );
}
