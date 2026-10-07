import {
  apiErrorCode,
  apiErrorField,
  apiErrorMessage,
  ApiError,
  type ClaimResult,
} from "@/lib/api";

/**
 * The hub claim, as rules rather than screens.
 *
 * Staff scan the client's QR, type the client's six-digit code, and the API
 * confirms the pair. The app never compares them itself and never completes a
 * handover on its own say-so: only a 200 from `POST /staff/hub/claims` is a
 * handover. Every refusal blocks — a mismatch is not a warning to click past,
 * it is "do not hand over the package", with escalation to Operations as the
 * only way forward (gridgoph/gridgo-api#125, decided 5 Oct).
 */

/** Client codes are six digits. */
export const OTP_LENGTH = 6;

/** The API locks a QR after this many wrong codes, for 15 minutes. */
export const MAX_ATTEMPTS = 5;

/** Keep only digits, at most six. Pasting "123 456" works. */
export function cleanOtp(input: string): string {
  return input.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function otpComplete(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * The QR holds only the opaque claim token (`docs/HUB_HANDOVER_API.md`:
 * "Render only qrToken inside the QR"). Typed or pasted entry trims the
 * whitespace a message app adds; a base64url token never contains any.
 */
export function cleanQrToken(input: string): string {
  return input.replace(/\s+/g, "");
}

/** Long enough to be a real token: guards against a stray scan of a short code. */
export function plausibleQrToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,256}$/.test(token);
}

export type ClaimOutcome =
  | { kind: "done"; orderId: string; at: string }
  /** Wrong code. The package stays on the counter. */
  | { kind: "mismatch"; escalatePath: string | null }
  /** Too many wrong codes on this QR. */
  | { kind: "locked"; retryAfter: string | null; escalatePath: string | null }
  /** The QR is not a GRIDGO pick-up claim (or not one waiting at the hub). */
  | { kind: "not_found" }
  | { kind: "already_done" }
  /** Ready but not releasable: final payment, holds, or wrong state. */
  | { kind: "blocked"; title: string; body: string }
  /** The request failed without a verdict — nothing happened. */
  | { kind: "error"; message: string };

export function claimSucceeded(result: ClaimResult): ClaimOutcome {
  return { kind: "done", orderId: result.order.orderId, at: result.handout.at };
}

function pathOrNull(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/orders/") ? value : null;
}

/** Turn a refusal into what the counter needs to know. Never "success". */
export function classifyClaimError(error: unknown): ClaimOutcome {
  const code = apiErrorCode(error);
  switch (code) {
    case "handover_otp_mismatch":
      return { kind: "mismatch", escalatePath: pathOrNull(apiErrorField(error, "escalatePath")) };
    case "handover_attempts_exceeded": {
      const retryAfter = apiErrorField(error, "retryAfter");
      return {
        kind: "locked",
        retryAfter: typeof retryAfter === "string" ? retryAfter : null,
        escalatePath: pathOrNull(apiErrorField(error, "escalatePath")),
      };
    }
    case "claim_not_found":
      return { kind: "not_found" };
    case "handover_already_completed":
      return { kind: "already_done" };
    case "final_payment_not_confirmed":
      return {
        kind: "blocked",
        title: "Payment not confirmed",
        body: "Do not hand over this order. The client’s final payment is not confirmed yet. Call Operations.",
      };
    case "collection_not_available":
    case "handover_not_ready":
      return {
        kind: "blocked",
        title: "Not ready for pick-up",
        body: "This order is not waiting at the hub. Do not hand anything over. Call Operations.",
      };
    case "refund_fulfillment_stopped":
    case "shop_recovery_pending":
    case "reschedule_fulfillment_stopped":
      return {
        kind: "blocked",
        title: "Order on hold",
        body: "Operations has stopped this order. Do not hand it over. Call Operations.",
      };
    case "forbidden":
      return {
        kind: "blocked",
        title: "Your role cannot hand out orders",
        body: "Ask GRIDGO to check your staff role.",
      };
    default:
      break;
  }
  if (error instanceof ApiError && error.status === 403) {
    return {
      kind: "blocked",
      title: "Your role cannot hand out orders",
      body: "Ask GRIDGO to check your staff role.",
    };
  }
  return {
    kind: "error",
    message: apiErrorMessage(error, "The handover did not go through. Nothing was recorded. Try again."),
  };
}

/** "Try again at 3:42 PM" for a locked QR; null when the API gave no time. */
export function retryAfterLabel(retryAfter: string | null, now: Date = new Date()): string | null {
  if (!retryAfter) return null;
  const at = new Date(retryAfter);
  if (Number.isNaN(at.getTime())) return null;
  const minutes = Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 60000));
  return `Try again in ${minutes} min`;
}

/** Default escalation reason, editable before sending. */
export function defaultEscalationReason(outcome: ClaimOutcome): string {
  return outcome.kind === "locked"
    ? "Client’s code was refused five times at the hub. Package kept on the counter."
    : "Client’s code did not match the scanned QR at the hub. Package kept on the counter.";
}

/**
 * The order reference every GRIDGO app prints: the id without its `ord_`
 * prefix, upper-cased, hex grouped in fours (same rule as gridgo-rider
 * `lib/orderReference.ts`), so staff and Operations read the same thing.
 */
export function orderRef(orderId: string): string {
  const bare = orderId.trim().replace(/^ord[_-]/i, "").toUpperCase();
  if (!/^[0-9A-F]{8,}$/.test(bare)) return bare;
  return bare.match(/.{1,4}/g)?.join("-") ?? bare;
}
