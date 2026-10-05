import {
  accessTabs,
  adminRoleFrom,
  hubReadRole,
  loadAccess,
  normalizeInviteCode,
  roleLabel,
  type Access,
} from "@/lib/access";
import { ApiError, type Me, type StaffProfile } from "@/lib/api";

const hubStaff: StaffProfile = { id: "user_1", name: "Hub Person", role: "hub_staff", canHandout: true };

function me(roles: Me["memberships"][number]["role"][], name = "Signed In"): Me {
  return { user: { id: "user_1", name }, memberships: roles.map((role) => ({ role })) };
}

function deps(memberships: Me | Error, staff: StaffProfile | Error = hubStaff) {
  return {
    getMe: jest.fn(async () => {
      if (memberships instanceof Error) throw memberships;
      return memberships;
    }),
    getStaffMe: jest.fn(async () => {
      if (staff instanceof Error) throw staff;
      return staff;
    }),
  };
}

describe("loadAccess", () => {
  it("gives a Clerk identity GRIDGO has never seen only the invite screen", async () => {
    const d = deps(new ApiError(401, { error: "unmapped_identity" }));
    await expect(loadAccess(d)).resolves.toEqual({ kind: "none" });
    expect(d.getStaffMe).not.toHaveBeenCalled();
  });

  it("gives a signed-in client or rider without a staff role nothing", async () => {
    const d = deps(me(["client", "rider"]));
    await expect(loadAccess(d)).resolves.toEqual({ kind: "none" });
    expect(d.getStaffMe).not.toHaveBeenCalled();
  });

  it("reads the staff profile for a staff membership", async () => {
    const access = await loadAccess(deps(me(["client", "staff"])));
    expect(access).toEqual({ kind: "granted", name: "Hub Person", staff: hubStaff, adminRole: null });
  });

  it("treats a suspended staff profile as paused, not as an error", async () => {
    const d = deps(me(["staff"]), new ApiError(403, { error: "staff_membership_required" }));
    await expect(loadAccess(d)).resolves.toEqual({ kind: "paused" });
  });

  it("keeps admin access when the staff profile is paused", async () => {
    const d = deps(me(["staff", "ops_admin"], "Ops Person"), new ApiError(403, { error: "staff_membership_required" }));
    await expect(loadAccess(d)).resolves.toEqual({
      kind: "granted",
      name: "Ops Person",
      staff: null,
      adminRole: "ops_admin",
    });
  });

  it("grants the Admin view to Operations without a staff profile", async () => {
    const d = deps(me(["ops_admin"]));
    const access = await loadAccess(d);
    expect(access).toMatchObject({ kind: "granted", staff: null, adminRole: "ops_admin" });
    expect(d.getStaffMe).not.toHaveBeenCalled();
  });

  it("rethrows a failure that says nothing about the account", async () => {
    await expect(loadAccess(deps(new Error("offline")))).rejects.toThrow("offline");
    await expect(loadAccess(deps(new ApiError(503, { error: "server_error" })))).rejects.toBeInstanceOf(ApiError);
    await expect(loadAccess(deps(me(["staff"]), new ApiError(500, {})))).rejects.toBeInstanceOf(ApiError);
  });
});

describe("roles → tabs", () => {
  const granted = (staff: StaffProfile | null, adminRole: "ops_admin" | "super_admin" | null): Access => ({
    kind: "granted",
    name: "x",
    staff,
    adminRole,
  });

  it("shows nothing but Account before access is granted", () => {
    for (const access of [null, { kind: "none" } as const, { kind: "paused" } as const]) {
      expect(accessTabs(access)).toEqual({ scan: false, handovers: false, hub: false, admin: false });
    }
  });

  it("gives hub staff Scan, their log and the SOP, but not Admin", () => {
    expect(accessTabs(granted(hubStaff, null))).toEqual({ scan: true, handovers: true, hub: true, admin: false });
  });

  it("hides Scan from a configurable role that cannot hand out orders", () => {
    const greeter = { ...hubStaff, role: "front_desk", canHandout: false };
    expect(accessTabs(granted(greeter, null))).toEqual({ scan: false, handovers: true, hub: true, admin: false });
  });

  it("gives Operations the Admin view and the SOP, never Scan", () => {
    expect(accessTabs(granted(null, "ops_admin"))).toEqual({ scan: false, handovers: false, hub: true, admin: true });
  });

  it("reads the hub as staff first, else with the admin membership", () => {
    expect(hubReadRole(granted(hubStaff, "super_admin"))).toBe("staff");
    expect(hubReadRole(granted(null, "super_admin"))).toBe("super_admin");
    expect(hubReadRole({ kind: "none" })).toBeNull();
  });

  it("prefers Super Admin over Operations", () => {
    expect(adminRoleFrom([{ role: "ops_admin" }, { role: "super_admin" }])).toBe("super_admin");
    expect(adminRoleFrom([{ role: "staff" }])).toBeNull();
  });

  it("labels configurable role codes in plain words", () => {
    expect(roleLabel("hub_staff")).toBe("Hub staff");
    expect(roleLabel("")).toBe("Staff");
  });
});

describe("normalizeInviteCode", () => {
  it("accepts the code, a pasted message, or the invite link", () => {
    expect(normalizeInviteCode("  abc_DEF-123 ")).toBe("abc_DEF-123");
    expect(normalizeInviteCode("abc DEF\n123")).toBe("abcDEF123");
    expect(normalizeInviteCode("gridgoadmin://redeem?code=abc_DEF-123")).toBe("abc_DEF-123");
    expect(normalizeInviteCode("https://x.test/i?ref=1&code=a%2Db")).toBe("a-b");
  });
});
