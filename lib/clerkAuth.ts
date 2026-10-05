/**
 * Clerk helpers shared with gridgo-rider and gridgo-supplier.
 *
 * The Admin App uses the same GRIDGO Clerk instance as every other GRIDGO app,
 * so one person keeps one identity across apps. Clerk proves who signed in;
 * GRIDGO memberships decide what they may do here (`lib/access.ts`).
 */

type ClerkErrorLike = {
  errors?: { code?: string; longMessage?: string; message?: string }[];
};

/** Clerk errors are structured; never leak codes or response internals. */
export function clerkErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;
  const first = (error as ClerkErrorLike).errors?.[0];
  const structured = first?.longMessage ?? first?.message;
  if (typeof structured === "string" && structured.trim()) return structured.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

/** Production builds must be configured explicitly with a live Clerk instance. */
export function clerkPublishableKey(
  value: string | null | undefined,
  development: boolean,
): string {
  const key = value?.trim();
  if (!key || !/^pk_(test|live)_/.test(key)) {
    throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing or invalid.");
  }
  if (!development && !key.startsWith("pk_live_")) {
    throw new Error("Production GRIDGO Admin builds require a pk_live_ Clerk key.");
  }
  return key;
}

/**
 * Expo extra is preferred because app.config.ts stamps it at prebuild. Keep
 * the static process.env read as a Gradle-time fallback: Babel can inline that
 * value while bundling even if prebuild evaluated an empty environment.
 */
export function resolveClerkPublishableKey(extra: unknown, development: boolean): string {
  const fromExtra = typeof extra === "string" ? extra : "";
  return clerkPublishableKey(
    fromExtra || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    development,
  );
}
