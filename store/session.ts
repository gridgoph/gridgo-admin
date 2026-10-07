import { create } from "zustand";

import { loadAccess, type Access } from "@/lib/access";
import { apiErrorMessage, getMe, getStaffMe } from "@/lib/api";

/**
 * What this signed-in person may do here, read from GRIDGO.
 *
 * Clerk owns the session; this store only holds the API's answer about it.
 * Nothing here is persisted: access is re-read on every launch and on every
 * sign-in, so a suspension or a removed membership takes effect at once.
 */
type Phase = "signedOut" | "checking" | "ready" | "error";

type SessionState = {
  phase: Phase;
  access: Access | null;
  error: string | null;
  /** An invite code that arrived by link before the person had signed in. */
  pendingInviteCode: string | null;
  /** Re-read access from the API. Concurrent calls share one read. */
  refresh: () => Promise<void>;
  /** Adopt access the API already returned (after an invite redemption). */
  setAccess: (access: Access) => void;
  reset: () => void;
  setPendingInviteCode: (code: string | null) => void;
};

let inflight: Promise<void> | null = null;
/** Bumped by reset so a read that started before sign-out cannot land after it. */
let generation = 0;

export const useSession = create<SessionState>((set) => ({
  phase: "signedOut",
  access: null,
  error: null,
  pendingInviteCode: null,
  refresh: () => {
    if (inflight) return inflight;
    const started = generation;
    set((state) => ({
      phase: state.phase === "ready" ? "ready" : "checking",
      error: null,
    }));
    inflight = loadAccess({ getMe, getStaffMe })
      .then((access) => {
        if (started !== generation) return;
        set({ phase: "ready", access, error: null });
      })
      .catch((error: unknown) => {
        if (started !== generation) return;
        // A failed re-check while already admitted keeps the last answer: the
        // next foreground or request tries again instead of blanking the app.
        if (useSession.getState().phase === "ready" && useSession.getState().access) {
          set({ error: apiErrorMessage(error, "GRIDGO could not check your access.") });
          return;
        }
        set({
          phase: "error",
          error: apiErrorMessage(error, "GRIDGO could not check your access."),
        });
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  setAccess: (access) => set({ phase: "ready", access, error: null }),
  reset: () => {
    generation += 1;
    inflight = null;
    set({ phase: "signedOut", access: null, error: null });
  },
  setPendingInviteCode: (code) => set({ pendingInviteCode: code }),
}));
