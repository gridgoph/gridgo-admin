import { create } from "zustand";

import { claimHandover, escalateHandover } from "@/lib/api";
import {
  claimSucceeded,
  classifyClaimError,
  cleanOtp,
  otpComplete,
  type ClaimOutcome,
} from "@/lib/handover";

/**
 * One handover at the counter: QR → client's code → the API's verdict.
 *
 * Held in memory only. The QR token and the code are a credential pair for
 * someone else's package, so they never touch storage or a route URL; leaving
 * the app mid-claim and coming back starts the claim again.
 */
export type ScanStep = "scan" | "code" | "result";

type ScanState = {
  step: ScanStep;
  qrToken: string | null;
  otp: string;
  submitting: boolean;
  outcome: ClaimOutcome | null;
  /** Wrong codes tried for this QR from this phone (the API keeps the real budget). */
  wrongCodes: number;
  /** Set once Operations has the report for this QR. */
  escalated: boolean;
  scanned: (qrToken: string) => void;
  setOtp: (value: string) => void;
  submit: () => Promise<ClaimOutcome | null>;
  /** Keep the QR, clear the code, go back to typing it. */
  retryCode: () => void;
  escalate: (reason: string) => Promise<void>;
  reset: () => void;
};

const initial = {
  step: "scan" as ScanStep,
  qrToken: null,
  otp: "",
  submitting: false,
  outcome: null,
  wrongCodes: 0,
  escalated: false,
};

export const useScan = create<ScanState>((set, get) => ({
  ...initial,
  scanned: (qrToken) => set({ ...initial, step: "code", qrToken }),
  setOtp: (value) => set({ otp: cleanOtp(value) }),
  submit: async () => {
    const { qrToken, otp, submitting } = get();
    if (!qrToken || !otpComplete(otp) || submitting) return null;
    set({ submitting: true });
    let outcome: ClaimOutcome;
    try {
      outcome = claimSucceeded(await claimHandover(qrToken, otp));
    } catch (error) {
      outcome = classifyClaimError(error);
    }
    set((state) => ({
      submitting: false,
      step: "result",
      outcome,
      wrongCodes: outcome.kind === "mismatch" ? state.wrongCodes + 1 : state.wrongCodes,
    }));
    return outcome;
  },
  retryCode: () => set({ step: "code", otp: "", outcome: null }),
  escalate: async (reason) => {
    const { qrToken, outcome } = get();
    const path =
      outcome && (outcome.kind === "mismatch" || outcome.kind === "locked")
        ? outcome.escalatePath
        : null;
    if (!qrToken || !path) throw new Error("This handover cannot be escalated from here. Call Operations.");
    await escalateHandover(path, reason, qrToken);
    set({ escalated: true });
  },
  reset: () => set({ ...initial }),
}));
