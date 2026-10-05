import { useClerk, useUser } from "@clerk/expo";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { FormScroll } from "@/components/FormScroll";
import { GridgoLogo } from "@/components/GridgoLogo";
import { InlineNotice } from "@/components/InlineNotice";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";
import { normalizeInviteCode } from "@/lib/access";
import { apiErrorMessage, redeemInvite } from "@/lib/api";
import { useSession } from "@/store/session";

/**
 * The whole app for a signed-in person without staff access.
 *
 * Invite-only: there is no sign-up, no request form and no browsing. The one
 * thing to do is enter the code GRIDGO sent. A redeemed code grants the role
 * it was minted for; the API decides, this screen only asks.
 */
export default function InviteScreen() {
  // A link that arrives while this screen is open restarts the form with it.
  const pending = useSession((state) => state.pendingInviteCode);
  return <InviteForm key={pending ?? ""} pending={pending} />;
}

function InviteForm({ pending }: { pending: string | null }) {
  const colors = useThemeColors();
  const { signOut } = useClerk();
  const { user } = useUser();
  const access = useSession((state) => state.access);
  const [code, setCode] = useState(pending ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paused = access?.kind === "paused";
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const cleaned = normalizeInviteCode(code);

  async function redeem() {
    if (busy || !cleaned) return;
    setBusy(true);
    setError(null);
    try {
      await redeemInvite(cleaned);
      useSession.getState().setPendingInviteCode(null);
      // Re-read memberships: the guard moves to the staff tabs on its own.
      await useSession.getState().refresh();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The invite code did not go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <FormScroll contentClassName="gg-page grow justify-between gap-8 py-6">
        <View className="gap-8 pt-6">
          <GridgoLogo role="admin" size={22} />
          <View className="gap-3">
            <Text className="text-h1 text-text-primary" accessibilityRole="header">
              {paused ? "Your staff access is paused" : "Ask GRIDGO for an invite"}
            </Text>
            <Text className="text-body-lg text-text-secondary">
              {paused
                ? "GRIDGO has paused your staff profile. Ask them to turn it back on, or enter a new invite code."
                : "This app is for GRIDGO staff only. If GRIDGO sent you an invite code, enter it here."}
            </Text>
            {email ? (
              <Text className="text-body text-text-muted">Signed in as {email}</Text>
            ) : null}
          </View>
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-body font-medium text-text-primary">Invite code</Text>
            <TextInput
              value={code}
              onChangeText={(next) => {
                setCode(next);
                setError(null);
              }}
              placeholder="Paste the code or link"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="go"
              onSubmitEditing={() => void redeem()}
              accessibilityLabel="Invite code"
              className="gg-field"
              style={fieldInputStyle}
              testID="invite-code"
            />
          </View>
          {error ? (
            <InlineNotice tone="error" icon="circle-x" title="Invite not accepted" body={error} />
          ) : null}
          <PrimaryButton
            label={busy ? "Checking code…" : "Redeem invite"}
            onPress={() => void redeem()}
            disabled={busy || !cleaned}
            size="large"
          />
          <SecondaryButton
            label="Sign out"
            onPress={() => void signOut()}
            disabled={busy}
            size="large"
          />
        </View>
      </FormScroll>
    </Screen>
  );
}
