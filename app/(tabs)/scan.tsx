import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { CircleCheck, CircleX, PackageCheck, ScanLine, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { CodeField } from "@/components/CodeField";
import { FormScroll } from "@/components/FormScroll";
import { InlineNotice } from "@/components/InlineNotice";
import { PrimaryButton } from "@/components/PrimaryButton";
import { QrScanner } from "@/components/QrScanner";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusChip } from "@/components/StatusChip";
import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";
import {
  cleanQrToken,
  MAX_ATTEMPTS,
  OTP_LENGTH,
  orderRef,
  otpComplete,
  plausibleQrToken,
  retryAfterLabel,
  type ClaimOutcome,
} from "@/lib/handover";
import { useScan } from "@/store/scan";

/**
 * The counter. Scan → code → verdict, one decision per screen state, every
 * action within a thumb's reach.
 */
export default function ScanScreen() {
  const step = useScan((state) => state.step);

  return (
    <Screen edges={["top", "left", "right"]}>
      <FormScroll contentClassName="gg-page grow gap-6 pb-6 pt-4">
        {step === "scan" ? <ScanStep /> : null}
        {step === "code" ? <CodeStep /> : null}
        {step === "result" ? <ResultStep /> : null}
      </FormScroll>
    </Screen>
  );
}

function ScanStep() {
  const colors = useThemeColors();
  const scanned = useScan((state) => state.scanned);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  function useTyped() {
    const token = cleanQrToken(typed);
    if (!plausibleQrToken(token)) {
      setTypedError("That is not a GRIDGO pick-up QR code. Check it and try again.");
      return;
    }
    setTyped("");
    scanned(token);
  }

  return (
    <>
      <View className="gap-1">
        <Text className="text-h1 text-text-primary" accessibilityRole="header">
          Scan pick-up QR
        </Text>
        <Text className="text-body-lg text-text-secondary">
          Scan the QR on the client’s GRIDGO app. You’ll ask for their code next.
        </Text>
      </View>

      <QrScanner
        onScan={(token) => {
          void Haptics.selectionAsync().catch(() => undefined);
          scanned(token);
        }}
      />

      {typing ? (
        <View className="gap-3">
          <Text className="text-body font-medium text-text-primary">QR code text</Text>
          <TextInput
            value={typed}
            onChangeText={(next) => {
              setTyped(next);
              setTypedError(null);
            }}
            placeholder="Paste or type the code under the QR"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="go"
            onSubmitEditing={useTyped}
            accessibilityLabel="QR code text"
            className="gg-field"
            style={fieldInputStyle}
            testID="manual-qr"
          />
          {typedError ? (
            <InlineNotice tone="error" icon="circle-x" title="Code not recognised" body={typedError} />
          ) : null}
          <SecondaryButton label="Use this code" onPress={useTyped} disabled={!typed.trim()} size="large" />
        </View>
      ) : (
        <SecondaryButton label="Type the QR code instead" onPress={() => setTyping(true)} size="large" />
      )}
    </>
  );
}

function CodeStep() {
  const otp = useScan((state) => state.otp);
  const setOtp = useScan((state) => state.setOtp);
  const submitting = useScan((state) => state.submitting);
  const wrongCodes = useScan((state) => state.wrongCodes);
  const submit = useScan((state) => state.submit);
  const reset = useScan((state) => state.reset);

  async function confirm() {
    const outcome = await submit();
    if (!outcome) return;
    void (outcome.kind === "done"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    ).catch(() => undefined);
  }

  return (
    <>
      <View className="flex-row items-center justify-between">
        <StatusChip tone="success" icon="circle-check" label="QR scanned" />
        <Pressable
          onPress={reset}
          disabled={submitting}
          accessibilityRole="button"
          className="gg-touch justify-center px-1"
        >
          <Text className="text-button text-text-primary underline">Scan a different QR</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-h1 text-text-primary" accessibilityRole="header">
          Enter the client’s code
        </Text>
        <Text className="text-body-lg text-text-secondary">
          Ask the client for the {OTP_LENGTH}-digit code in their GRIDGO app. GRIDGO checks it against the QR before
          you hand anything over.
        </Text>
      </View>

      <CodeField
        value={otp}
        onChangeText={setOtp}
        length={OTP_LENGTH}
        disabled={submitting}
        autoFocus
        accessibilityLabel="Client’s code"
        accessibilityHint={`The ${OTP_LENGTH} digits the client shows you`}
        testID="client-otp"
      />

      {wrongCodes > 0 ? (
        <Text className="text-body text-text-secondary">
          Wrong codes on this QR so far: {wrongCodes}. After {MAX_ATTEMPTS} the QR locks for 15 minutes.
        </Text>
      ) : null}

      <PrimaryButton
        label={submitting ? "Checking…" : "Confirm handover"}
        onPress={() => void confirm()}
        disabled={submitting || !otpComplete(otp)}
        size="large"
      />
    </>
  );
}

function ResultStep() {
  const outcome = useScan((state) => state.outcome);
  if (!outcome) return null;
  switch (outcome.kind) {
    case "done":
      return <Done outcome={outcome} />;
    case "mismatch":
    case "locked":
      return <Refused outcome={outcome} />;
    default:
      return <Stopped outcome={outcome} />;
  }
}

function Done({ outcome }: { outcome: Extract<ClaimOutcome, { kind: "done" }> }) {
  const colors = useThemeColors();
  const reset = useScan((state) => state.reset);
  const time = new Date(outcome.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <View
        className="items-start gap-4 rounded-card border-2 border-success bg-surface p-6"
        accessibilityLiveRegion="assertive"
        testID="result-done"
      >
        <CircleCheck size={48} color={colors.success} strokeWidth={2} />
        <Text className="text-display text-text-primary" accessibilityRole="header">
          Codes match
        </Text>
        <Text className="text-body-lg text-text-secondary">
          Hand the package to the client. The handover is recorded under your name.
        </Text>
        <View className="w-full flex-row justify-between border-t border-outline-subtle pt-4">
          <View className="gap-1">
            <Text className="text-caption text-text-muted">Order</Text>
            <Text className="text-body-lg font-bold text-text-primary">{orderRef(outcome.orderId)}</Text>
          </View>
          <View className="items-end gap-1">
            <Text className="text-caption text-text-muted">Recorded</Text>
            <Text className="text-body-lg font-bold text-text-primary">{time}</Text>
          </View>
        </View>
      </View>
      <PrimaryButton label="Scan next" onPress={reset} size="large" />
    </>
  );
}

function Refused({ outcome }: { outcome: Extract<ClaimOutcome, { kind: "mismatch" | "locked" }> }) {
  const colors = useThemeColors();
  const router = useRouter();
  const retryCode = useScan((state) => state.retryCode);
  const reset = useScan((state) => state.reset);
  const escalated = useScan((state) => state.escalated);
  const locked = outcome.kind === "locked";
  const wait = locked ? retryAfterLabel(outcome.retryAfter) : null;

  return (
    <>
      <View
        className="items-start gap-4 rounded-card border-2 border-error bg-surface p-6"
        accessibilityLiveRegion="assertive"
        testID="result-refused"
      >
        <CircleX size={48} color={colors.error} strokeWidth={2} />
        <Text className="text-display text-text-primary" accessibilityRole="header">
          Do not hand over
        </Text>
        <Text className="text-body-lg text-text-secondary">
          {locked
            ? `Too many wrong codes for this QR. It is locked${wait ? ` — ${wait.toLowerCase()}` : ""}. Keep the package on the counter.`
            : "The client’s code does not match this QR. Keep the package on the counter."}
        </Text>
        {escalated ? (
          <StatusChip tone="info" icon="bell" label="Operations has been told" />
        ) : null}
      </View>

      {escalated ? (
        <InlineNotice
          tone="info"
          icon="clock"
          title="Wait for Operations"
          body="Keep the package until Operations replies. Do not hand it over on a wrong code."
        />
      ) : outcome.escalatePath ? (
        <PrimaryButton label="Escalate to Operations" onPress={() => router.push("/escalate")} size="large" />
      ) : (
        <InlineNotice
          tone="warning"
          icon="triangle-alert"
          title="Call Operations"
          body="This refusal cannot be reported from the app. Call Operations before doing anything else."
        />
      )}
      {!locked ? (
        <SecondaryButton label="Enter the code again" onPress={retryCode} size="large" />
      ) : null}
      <SecondaryButton label="Scan a different QR" onPress={reset} size="large" />
    </>
  );
}

const STOPPED_COPY: Record<string, { title: string; body: string; icon: "warn" | "box" | "scan" }> = {
  not_found: {
    title: "Not a pick-up QR",
    body: "This QR is not a GRIDGO order waiting at the hub. Ask the client to open the order’s pick-up QR, then scan again.",
    icon: "scan",
  },
  already_done: {
    title: "Already handed over",
    body: "This order was already collected. Do not hand anything over. Call Operations if the client says otherwise.",
    icon: "box",
  },
};

function Stopped({ outcome }: { outcome: ClaimOutcome }) {
  const colors = useThemeColors();
  const reset = useScan((state) => state.reset);
  const submit = useScan((state) => state.submit);
  const submitting = useScan((state) => state.submitting);

  const copy =
    outcome.kind === "blocked"
      ? { title: outcome.title, body: outcome.body, icon: "warn" as const }
      : outcome.kind === "error"
        ? { title: "Nothing was recorded", body: outcome.message, icon: "warn" as const }
        : (STOPPED_COPY[outcome.kind] ?? STOPPED_COPY.not_found);
  const Icon = copy.icon === "box" ? PackageCheck : copy.icon === "scan" ? ScanLine : TriangleAlert;
  const tone = outcome.kind === "blocked" ? colors.error : colors.warning;

  return (
    <>
      <View
        className={`items-start gap-4 rounded-card border-2 bg-surface p-6 ${outcome.kind === "blocked" ? "border-error" : "border-warning"}`}
        accessibilityLiveRegion="assertive"
        testID="result-stopped"
      >
        <Icon size={44} color={tone} strokeWidth={2} />
        <Text className="text-h1 text-text-primary" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text className="text-body-lg text-text-secondary">{copy.body}</Text>
      </View>
      {outcome.kind === "error" ? (
        <>
          <PrimaryButton
            label={submitting ? "Checking…" : "Try again"}
            onPress={() => void submit()}
            disabled={submitting}
            size="large"
          />
          <SecondaryButton label="Scan a different QR" onPress={reset} size="large" />
        </>
      ) : (
        <PrimaryButton label="Scan next" onPress={reset} size="large" />
      )}
    </>
  );
}
