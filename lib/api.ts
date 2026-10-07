import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * GRIDGO API client for the Admin App.
 *
 * Same shape as gridgo-rider and gridgo-supplier: Clerk installs a token
 * provider, every request carries a fresh bearer, and a 401 is retried once
 * with a newly minted token before anything treats the session as dead.
 *
 * The contract is gridgo-api `docs/HUB_HANDOVER_API.md`. Staff routes select
 * the staff projection with `X-GRIDGO-Role: staff` (Operations and Super Admin
 * select it with their own membership); the Admin feeds select the caller's
 * Operations or Super Admin membership. A role header the account
 * does not hold is a 403, so the header always follows `lib/access.ts`.
 */

/** Memberships this app reads or selects. Other GRIDGO roles never enter it. */
export type MembershipRole =
  | "client"
  | "supplier"
  | "rider"
  | "ops_admin"
  | "super_admin"
  | "staff";

/** The projection a request selects with `X-GRIDGO-Role`. */
export type RequestRole = "staff" | "ops_admin" | "super_admin";

export type Me = {
  user: { id: string; name?: string | null; email?: string | null };
  memberships: { role: MembershipRole }[];
};

export type StaffProfile = {
  id: string;
  name: string;
  /** Configurable staff role code, e.g. `hub_staff`. */
  role: string;
  /** The role's name as Super Admin set it; absent from older API builds. */
  roleName?: string | null;
  /** Only roles with this flag may record a hub handout. */
  canHandout: boolean;
};

export type HubWindow = { weekday: number; opensMinute: number; closesMinute: number };

export type HubSchedule = {
  utcOffsetMinutes: number;
  week: HubWindow[];
  closures?: { startDay: string; endDay: string }[];
};

export type Hub = {
  id: string;
  name: string;
  point?: { label?: string | null; address?: string | null } | null;
  /** `null` until Super Admin sets hub hours (`docs/HUB_HANDOVER_API.md`). */
  schedule: HubSchedule | null;
};

export type Handout = {
  id: string;
  orderId: string;
  staffId: string;
  /** The staff member's name at the moment of handover. */
  staffName: string;
  hubId: string;
  at: string;
};

export type StaffTotal = { staffId: string; name: string; count: number };

export type HandoutPage = {
  handouts: Handout[];
  staffTotals: StaffTotal[];
  nextCursor: string | null;
};

export type ReceiptScan = { fileId: string; supplierId: string; orderId: string; at: string };

export type ReceiptScanPage = { scans: ReceiptScan[]; nextCursor: string | null };

export type ClaimResult = {
  handout: Handout;
  order: { orderId: string; state: string };
};

/** A short-lived capability, never file identity. Do not persist or rewrite. */
export type DownloadUrl = { fileId: string; url: string; expiresAt: string };

type TokenProvider = (options?: { skipCache?: boolean }) => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

/** Fired when a fresh Clerk token is still refused (a confirmed 401). */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

/** Install Clerk's fresh-token reader. Returns the uninstall. */
export function setTokenProvider(provider: TokenProvider | null): () => void {
  tokenProvider = provider;
  return () => {
    if (tokenProvider === provider) tokenProvider = null;
  };
}

const DEFAULT_API_PORT = "8787";

export type ResolveApiBaseInput = {
  /** Explicit override from EXPO_PUBLIC_API_URL. */
  envUrl?: string | null;
  /** EXPO_PUBLIC_API_PORT, default 8787 when unset. */
  envPort?: string | null;
  /** Host:port of the Expo dev server; only the hostname is used. */
  devHostUri?: string | null;
  platformOS: string;
  /** `false` only for an Android emulator, whose loopback is `10.0.2.2`. */
  isDevice?: boolean;
  /** Expo-web page hostname; `admin.localhost` must call the API on that host. */
  pageHostname?: string | null;
};

/**
 * Resolve the API base URL. Same precedence as the other GRIDGO apps:
 * 1. EXPO_PUBLIC_API_URL
 * 2. On web, the page hostname + port
 * 3. The Expo dev server's hostname + port
 * 4. Android loopback: emulator → 10.0.2.2; USB phone → 127.0.0.1
 * 5. http://127.0.0.1:port
 */
export function resolveApiBase({
  envUrl,
  envPort,
  devHostUri,
  platformOS,
  isDevice,
  pageHostname,
}: ResolveApiBaseInput): string {
  const trimmed = envUrl?.trim().replace(/\/$/, "");
  if (trimmed) return trimmed;

  const apiPort = (envPort?.trim() || DEFAULT_API_PORT).replace(/^:/, "");
  const pageHost = pageHostname?.trim();
  if (platformOS === "web" && pageHost) {
    const host =
      pageHost.startsWith("[") || !pageHost.includes(":") ? pageHost : `[${pageHost}]`;
    return `http://${host}:${apiPort}`;
  }
  const hostname = hostnameFromDevHostUri(devHostUri);
  if (hostname) {
    const loopback = hostname === "localhost" || hostname === "127.0.0.1";
    if (loopback && platformOS === "android") {
      return isDevice === false ? `http://10.0.2.2:${apiPort}` : `http://127.0.0.1:${apiPort}`;
    }
    return `http://${hostname}:${apiPort}`;
  }
  return `http://127.0.0.1:${apiPort}`;
}

/** Pull a hostname from `host:port`, URL-like strings, or a bare host. */
export function hostnameFromDevHostUri(hostUri: string | null | undefined): string | null {
  const raw = hostUri?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `http://${raw}`).hostname || null;
  } catch {
    return raw.split("/")[0]?.replace(/:\d+$/, "") || null;
  }
}

function expoDevHostUri(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  if (expoConfig?.hostUri) return expoConfig.hostUri;
  const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | null;
  return expoGo?.debuggerHost ?? null;
}

export function getApiBase(): string {
  const pageHostname =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.hostname?.trim() || null
      : null;
  return resolveApiBase({
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    envPort: process.env.EXPO_PUBLIC_API_PORT,
    devHostUri: expoDevHostUri(),
    platformOS: Platform.OS,
    isDevice: Constants.isDevice,
    pageHostname,
  });
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : `HTTP ${status}`,
    );
    this.status = status;
    this.body = body;
  }
}

async function bearer(options?: { skipCache?: boolean }): Promise<string | null> {
  const provider = tokenProvider;
  if (!provider) return null;
  try {
    const token = await provider(options);
    return provider === tokenProvider ? token?.trim() || null : null;
  } catch {
    return null;
  }
}

export const API_REQUEST_MS = 20_000;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Which membership projection to select. Omit for identity probes. */
  role?: RequestRole;
  /**
   * Ask without betting the session on the answer. `/auth/me` answers 401
   * `unmapped_identity` for a signed-in person GRIDGO has never seen — the
   * honest state of someone about to redeem their first invite.
   */
  ignoreUnauthorized?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, role, ignoreUnauthorized } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (role) headers["X-GRIDGO-Role"] = role;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_REQUEST_MS);
  let res: Response;
  let data: unknown = null;
  let sentBearer = false;
  // gridgo-api answers 401 to any token it could not verify, including one
  // that expired while a slow request queued. Only a refusal of a freshly
  // minted token is a verdict (gridgo-rider#77).
  let confirmedUnauthorized = true;
  try {
    let token = await bearer();
    for (let attempt = 0; ; attempt += 1) {
      sentBearer = Boolean(token);
      if (token) headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${getApiBase()}${path}`, {
        method,
        headers: { ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (res.status !== 401 || attempt > 0 || !sentBearer) break;
      if (apiErrorCode(new ApiError(res.status, data)) === "unmapped_identity") break;
      token = await bearer({ skipCache: true });
      if (!token) {
        confirmedUnauthorized = false;
        break;
      }
    }
  } catch (caught) {
    if (controller.signal.aborted) {
      throw new Error("GRIDGO did not answer in time. Check this phone’s connection, then try again.");
    }
    // The platform's own text ("fetch failed: java.net.ConnectException …")
    // means nothing at the counter.
    if (__DEV__) console.warn("GRIDGO request failed", caught);
    throw new Error("GRIDGO could not be reached. Check this phone’s connection, then try again.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 401 && !ignoreUnauthorized && sentBearer && confirmedUnauthorized) {
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, data);
  }
  return data as T;
}

// ---- identity and access -------------------------------------------------

/** Who GRIDGO thinks this Clerk identity is, and which memberships it holds. */
export function getMe(): Promise<Me> {
  return request<Me>("/auth/me", { ignoreUnauthorized: true });
}

/**
 * The caller's staff profile, selected with `staff` or, for Operations and
 * Super Admin, their own membership. 403 when suspended or missing.
 */
export async function getStaffMe(role: RequestRole = "staff"): Promise<StaffProfile> {
  const result = await request<{ staff: StaffProfile }>("/staff/me", { role });
  return result.staff;
}

/** Redeem a one-time invite. Single use, bound to the first Clerk identity. */
export async function redeemInvite(code: string): Promise<StaffProfile | null> {
  const result = await request<{ staff: StaffProfile | null }>("/auth/staff/redeem", {
    method: "POST",
    body: { code: code.trim() },
    ignoreUnauthorized: true,
  });
  return result.staff;
}

// ---- hub -----------------------------------------------------------------

export function getHub(role: RequestRole): Promise<{ hub: Hub; sop: string[] }> {
  return request(role === "staff" ? "/staff/hub" : "/ops/hub", { role });
}

/** Both the scanned QR and the client's code; the API confirms the pair. */
export function claimHandover(role: RequestRole, qrToken: string, otp: string): Promise<ClaimResult> {
  return request<ClaimResult>("/staff/hub/claims", {
    method: "POST",
    role,
    body: { qrToken, otp },
  });
}

/**
 * Report a refused handover to Operations. Staff must send the scanned QR so
 * the API can tie the report to the package actually on the counter.
 */
export function escalateHandover(
  role: RequestRole,
  escalatePath: string,
  reason: string,
  qrToken: string,
): Promise<{ escalated: true }> {
  return request(escalatePath, {
    method: "POST",
    role,
    body: { reason: reason.trim(), qrToken },
  });
}

function pageQuery(before?: string | null): string {
  return before ? `?before=${encodeURIComponent(before)}` : "";
}

export function listMyHandouts(role: RequestRole, before?: string | null): Promise<HandoutPage> {
  return request(`/staff/hub/handouts${pageQuery(before)}`, { role });
}

export function listAllHandouts(role: RequestRole, before?: string | null): Promise<HandoutPage> {
  return request(`/ops/hub/handouts${pageQuery(before)}`, { role });
}

export function listReceiptScans(
  role: RequestRole,
  before?: string | null,
): Promise<ReceiptScanPage> {
  return request(`/ops/hub/receipt-scans${pageQuery(before)}`, { role });
}

export function getDownloadUrl(role: RequestRole, fileId: string): Promise<DownloadUrl> {
  return request(`/files/${encodeURIComponent(fileId)}/download-url`, { role });
}

// ---- errors --------------------------------------------------------------

/** True for anything shaped like a code or a status line, never a sentence. */
export function isInternalCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[a-z][a-z0-9]*([_-][a-z0-9]+)+$/i.test(trimmed)) return true;
  if (/^HTTP\s+\d{3}$/i.test(trimmed)) return true;
  return /^[a-z0-9]+$/.test(trimmed);
}

/** The API's machine-readable refusal, or null when it never reached the API. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  return typeof error.body === "object" && error.body && "error" in error.body
    ? String((error.body as { error: string }).error)
    : null;
}

/** A field from the refusal body, e.g. `escalatePath` or `retryAfter`. */
export function apiErrorField(error: unknown, field: string): unknown {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || !error.body) return null;
  return (error.body as Record<string, unknown>)[field] ?? null;
}

/** Staff-facing recovery copy. Never shows a raw code. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const code = apiErrorCode(error) ?? error.message;
    switch (code) {
      case "staff_invite_invalid":
        return "That invite code is not valid. It may have expired or been cancelled. Ask GRIDGO for a new one.";
      case "staff_invite_used":
        return "That invite code was already used by another account. Ask GRIDGO for a new one.";
      case "staff_already_enrolled":
        return "This account already has staff access. Ask GRIDGO if you need a different role.";
      case "email_already_registered":
        return "Another GRIDGO account already uses this email. Sign in with that account, or ask GRIDGO to help.";
      case "staff_profile_required":
        return "Your sign-in has no name or email yet. Add them to your account, then redeem the code again.";
      case "clerk_unavailable":
        return "GRIDGO could not check your sign-in just now. Try again in a moment.";
      case "staff_membership_required":
        return "Your staff access is paused. Ask GRIDGO to turn it back on.";
      case "forbidden":
        return "Your account cannot do this. Ask GRIDGO to check your role.";
      default:
        break;
    }
    if (error.status >= 500) {
      return `${fallback} If it keeps happening, tell Operations the server is failing.`;
    }
    return isInternalCode(code) ? fallback : code;
  }
  if (error instanceof Error && error.message && !isInternalCode(error.message)) {
    return error.message;
  }
  return fallback;
}
