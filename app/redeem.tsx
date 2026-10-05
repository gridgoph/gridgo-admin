import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { normalizeInviteCode } from "@/lib/access";
import { useSession } from "@/store/session";

/**
 * `gridgoadmin://redeem?code=…` — the invite link GRIDGO sends.
 *
 * The code is held in memory, never in the URL bar or storage, and the person
 * goes wherever their state allows: sign-in first if needed, then the invite
 * screen prefilled with it.
 */
export default function RedeemLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const value = typeof code === "string" ? normalizeInviteCode(code) : "";
  const pending = useSession((state) => state.pendingInviteCode);

  // Hold the code before leaving, so the invite screen mounts with it.
  useEffect(() => {
    if (value) useSession.getState().setPendingInviteCode(value);
  }, [value]);

  return !value || pending === value ? <Redirect href="/" /> : null;
}
