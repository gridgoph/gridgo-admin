/**
 * What a Clerk password attempt asks for next.
 *
 * Password is first factor. A leftover Clerk session is not a wrong password.
 * `needs_client_trust` (new device) and `needs_second_factor` collect a code;
 * they used to collapse into "Wrong email or password."
 */

export type ClerkSecondFactorStrategy = "email_code" | "phone_code" | "totp" | "backup_code";

export type PasswordSignInContinuation =
  | { kind: "complete" }
  | { kind: "existing_session"; sessionId: string }
  | { kind: "verification"; factor: ClerkSecondFactorStrategy }
  | { kind: "blocked"; message: string };

export const clerkPasswordIncompleteMessage =
  "This account needs another verification step. Please try again.";

export const clerkNeedsNewPasswordMessage =
  "This account has to choose a new password before signing in. Tap “Recover password” to get a code.";

export const clerkSignOutRecoveryMessage =
  "GRIDGO could not sign you out of Clerk. Check your connection and try again.";

const SECOND_FACTOR_ORDER: ClerkSecondFactorStrategy[] = [
  "email_code",
  "phone_code",
  "totp",
  "backup_code",
];

/** Email code, else the first second factor Clerk listed. Never throw. */
export function pickSupportedSecondFactor(
  factors?: readonly { strategy: string }[] | null,
): ClerkSecondFactorStrategy {
  const strategies = new Set((factors ?? []).map((factor) => factor.strategy));
  if (strategies.size === 0) return "email_code";
  return SECOND_FACTOR_ORDER.find((strategy) => strategies.has(strategy)) ?? "email_code";
}

export function loginVerifyCopy(
  factor: ClerkSecondFactorStrategy,
  email: string,
): { heading: string; body: string; resend: boolean } {
  const trimmed = email.trim();
  switch (factor) {
    case "phone_code":
      return {
        heading: "Confirm it’s you.",
        body: "GRIDGO sent a 6-digit code to your phone. Enter it to finish signing in.",
        resend: true,
      };
    case "totp":
      return {
        heading: "Confirm it’s you.",
        body: "Enter the 6-digit code from your authenticator app to finish signing in.",
        resend: false,
      };
    case "backup_code":
      return {
        heading: "Confirm it’s you.",
        body: "Enter one of your backup codes to finish signing in.",
        resend: false,
      };
    default:
      return {
        heading: "Confirm it’s you.",
        body: trimmed
          ? `GRIDGO sent a 6-digit code to ${trimmed}. Enter it to finish signing in.`
          : "GRIDGO sent a 6-digit code to your email. Enter it to finish signing in.",
        resend: true,
      };
  }
}

export function continuationAfterPassword(
  status: string | null | undefined,
  existingSession?: { sessionId: string } | null,
  supportedSecondFactors?: readonly { strategy: string }[] | null,
): PasswordSignInContinuation {
  if (existingSession?.sessionId) {
    return { kind: "existing_session", sessionId: existingSession.sessionId };
  }
  if (status === "complete") return { kind: "complete" };
  if (status === "needs_second_factor" || status === "needs_client_trust") {
    return {
      kind: "verification",
      factor: pickSupportedSecondFactor(supportedSecondFactors),
    };
  }
  if (status === "needs_new_password") {
    return { kind: "blocked", message: clerkNeedsNewPasswordMessage };
  }
  return { kind: "blocked", message: clerkPasswordIncompleteMessage };
}
