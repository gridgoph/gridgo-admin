import { useAuth, useClerk } from "@clerk/expo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { setTokenProvider, setUnauthorizedHandler } from "@/lib/api";
import { useSession } from "@/store/session";

/**
 * Clerk session → GRIDGO access.
 *
 * As soon as Clerk reports a session, the API client gets Clerk's token reader
 * and the store reads `/auth/me`. Signing out (or a fresh token the API still
 * refuses) clears both. Coming back to the foreground re-reads access, so a
 * suspended staff profile stops working without a relaunch.
 *
 * Returns whether Clerk has loaded, which the root layout waits on.
 */
export function useAccessBridge(): boolean {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setTokenProvider(null);
      useSession.getState().reset();
      return;
    }
    const uninstall = setTokenProvider(async (options) =>
      (await getToken(options?.skipCache ? { skipCache: true } : undefined)) ?? null,
    );
    void useSession.getState().refresh();
    return uninstall;
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    return setUnauthorizedHandler(() => {
      void signOut().catch(() => undefined);
    });
  }, [signOut]);

  useEffect(() => {
    if (!isSignedIn) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void useSession.getState().refresh();
    });
    return () => subscription.remove();
  }, [isSignedIn]);

  return isLoaded;
}
