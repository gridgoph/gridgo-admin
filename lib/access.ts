import {
  apiErrorCode,
  ApiError,
  type Me,
  type MembershipRole,
  type RequestRole,
  type StaffProfile,
} from "@/lib/api";

/**
 * Who may use the Admin App, and for what.
 *
 * GRIDGO database memberships decide, never Clerk metadata. Signing in proves
 * only an identity: the same Clerk instance serves every GRIDGO app, so a
 * client or a rider can sign in here too. Without a staff profile or an
 * Operations / Super Admin membership they get the invite screen and nothing
 * else.
 *
 * - **Staff** (an invite redeemed, profile active) scan, see their own
 *   handovers and follow the hub SOP. Only a role with `canHandout` may scan.
 * - **Admin** (Operations or Super Admin membership) sees every staff
 *   member's handovers and the receipt-scan feed. Those feeds are selected
 *   with the admin membership, never the staff one.
 * - Operations and Super Admin are staff too, without an invite: the API
 *   grants them the staff routes through their own membership, so they select
 *   those routes with it (`staffRole`), never with `staff`.
 */
export type Access =
  /** Signed in, but GRIDGO grants this account nothing here. */
  | { kind: "none" }
  /** A staff membership whose profile Super Admin has suspended. */
  | { kind: "paused" }
  | {
      kind: "granted";
      /** Display name for the header and the handover log. */
      name: string;
      staff: StaffProfile | null;
      /** The `X-GRIDGO-Role` for the staff routes; set whenever `staff` is. */
      staffRole: RequestRole | null;
      adminRole: Extract<RequestRole, "ops_admin" | "super_admin"> | null;
    };

/** Super Admin outranks Operations; both read the same feeds. */
export function adminRoleFrom(
  memberships: readonly { role: MembershipRole }[],
): "ops_admin" | "super_admin" | null {
  const roles = new Set(memberships.map((membership) => membership.role));
  if (roles.has("super_admin")) return "super_admin";
  if (roles.has("ops_admin")) return "ops_admin";
  return null;
}

export type AccessDeps = {
  getMe: () => Promise<Me>;
  getStaffMe: (role: RequestRole) => Promise<StaffProfile>;
};

/**
 * Resolve access from the API. Throws only for failures that say nothing
 * about the account (network, 5xx), so the caller can offer a retry rather
 * than an invite screen the person does not need.
 */
export async function loadAccess(deps: AccessDeps): Promise<Access> {
  let me: Me;
  try {
    me = await deps.getMe();
  } catch (error) {
    // A Clerk identity GRIDGO has never mapped: the honest state of someone
    // about to redeem their first invite.
    if (apiErrorCode(error) === "unmapped_identity") return { kind: "none" };
    if (error instanceof ApiError && error.status === 403) return { kind: "none" };
    throw error;
  }

  const memberships = me.memberships ?? [];
  const adminRole = adminRoleFrom(memberships);
  let staff: StaffProfile | null = null;
  let staffRole: RequestRole | null = null;
  let paused = false;
  if (memberships.some((membership) => membership.role === "staff")) {
    try {
      staff = await deps.getStaffMe("staff");
      staffRole = "staff";
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 403) throw error;
      paused = true;
    }
  }
  if (!staff && adminRole) {
    try {
      staff = await deps.getStaffMe(adminRole);
      staffRole = adminRole;
    } catch (error) {
      // An API without admin staff access still leaves the Admin view.
      if (!(error instanceof ApiError) || error.status !== 403) throw error;
    }
  }

  if (!staff && !adminRole) return paused ? { kind: "paused" } : { kind: "none" };
  const name = staff?.name || me.user?.name?.trim() || "GRIDGO staff";
  return { kind: "granted", name, staff, staffRole, adminRole };
}

export type AccessTabs = {
  scan: boolean;
  handovers: boolean;
  hub: boolean;
  admin: boolean;
};

/** Which tabs this account sees. Account is always there for sign-out. */
export function accessTabs(access: Access | null): AccessTabs {
  if (access?.kind !== "granted") {
    return { scan: false, handovers: false, hub: false, admin: false };
  }
  const staff = access.staff;
  return {
    scan: Boolean(staff?.canHandout),
    handovers: Boolean(staff),
    hub: Boolean(staff) || Boolean(access.adminRole),
    admin: Boolean(access.adminRole),
  };
}

/** The role to send for the hub/SOP read: staff first, else the admin view. */
export function hubReadRole(access: Access | null): RequestRole | null {
  if (access?.kind !== "granted") return null;
  return access.staffRole ?? access.adminRole;
}

/**
 * The role for a staff route (claim, escalate, own log). Those screens exist
 * only with staff access; anyone else falls back to `staff`, which the API
 * refuses.
 */
export function staffRequestRole(access: Access | null): RequestRole {
  return (access?.kind === "granted" && access.staffRole) || "staff";
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  ops_admin: "Operations",
  super_admin: "Super Admin",
};

/**
 * Human label for a staff role: the name Super Admin gave it when the API
 * sends one, else the code in plain words (`hub_staff` → "Hub staff").
 */
export function roleLabel(code: string, name?: string | null): string {
  if (name?.trim()) return name.trim();
  if (ADMIN_ROLE_LABELS[code]) return ADMIN_ROLE_LABELS[code];
  const words = code.replace(/[_-]+/g, " ").trim();
  if (!words) return "Staff";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * An invite code as staff receive it: typed, pasted from a message, or the
 * whole invite link. Accepts `gridgoadmin://redeem?code=…` and any URL with a
 * `code` query, else the trimmed text with inner whitespace removed.
 */
export function normalizeInviteCode(input: string): string {
  const raw = input.trim();
  const fromQuery = /[?&]code=([^&#\s]+)/.exec(raw);
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery[1]);
    } catch {
      return fromQuery[1];
    }
  }
  return raw.replace(/\s+/g, "");
}
