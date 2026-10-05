/**
 * Complete a Clerk Google browser-SSO attempt.
 *
 * The browser redirect and session activation are separate steps. Clerk may
 * return a created session without making it active, so the caller must adopt
 * that exact session before the rider projection bridge can evaluate access.
 */

export type GoogleSsoFlowResult = {
  createdSessionId: string | null;
  setActive?: (args: { session: string }) => Promise<unknown>;
  authSessionResult?: { type?: string } | null;
};

export type GoogleSsoOutcome =
  | { status: "already_signed_in" }
  | { status: "activated"; sessionId: string }
  | { status: "cancelled" }
  | { status: "incomplete" };

export async function completeGoogleSso(input: {
  alreadySignedIn: boolean;
  startSSOFlow: () => Promise<GoogleSsoFlowResult>;
  setActive: (args: { session: string }) => Promise<unknown>;
}): Promise<GoogleSsoOutcome> {
  if (input.alreadySignedIn) return { status: "already_signed_in" };

  const result = await input.startSSOFlow();
  const dismissal = result.authSessionResult?.type;
  if (dismissal === "cancel" || dismissal === "dismiss") {
    return { status: "cancelled" };
  }

  if (result.createdSessionId) {
    const activate = result.setActive ?? input.setActive;
    await activate({ session: result.createdSessionId });
    return { status: "activated", sessionId: result.createdSessionId };
  }

  return { status: "incomplete" };
}
