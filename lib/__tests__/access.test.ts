import {
  accessTabs,
  adminRoleFrom,
  hubReadRole,
  loadAccess,
  normalizeInviteCode,
  roleLabel,
  staffRequestRole,
  type Access,
} from "@/lib/access";
import { ApiError, type Me, type RequestRole, type StaffProfile } from "@/lib/api";

const hubStaff: StaffProfile = { id: "user_1", name: "Hub Person", role: "hub_staff", canHandout: true };
const opsStaff: StaffProfile = { id: "user_1", name: "Ops Person", role: "ops_admin", canHandout: true };

function me(roles: Me["memberships"][number]["role"][], name = "Signed In"): Me {
  return { user: { id: "user_1", name }, memberships: roles.map((role) => ({ role })) };
}

function deps(memberships: Me | Error, staff: StaffProfile | Error = hubStaff) {
  return {
    getMe: jest.fn(async () => {
      if (memberships instanceof Error) throw memberships;
      return memberships;
    }),
    getStaffMe: jest.fn(async (_role: RequestRole) => {
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
    expect(access).toEqual({ kind: "granted", name: "Hub Person", staff: hubStaff, staffRole: "staff", adminRole: null });
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
      staffRole: null,
      adminRole: "ops_admin",
    });
  });

  it("makes Operations and Super Admin staff through their own membership, without an invite", async () => {
    for (const role of ["ops_admin", "super_admin"] as const) {
      const profile = { ...opsStaff, role };
      const d = deps(me([role]), profile);
      await expect(loadAccess(d)).resolves.toEqual({
        kind: "granted",
        name: "Ops Person",
        staff: profile,
        staffRole: role,
        adminRole: role,
      });
      expect(d.getStaffMe).toHaveBeenCalledTimes(1);
      expect(d.getStaffMe).toHaveBeenCalledWith(role);
    }
  });

  it("falls back to the admin membership when the invited staff profile is paused", async () => {
    const d = deps(me(["staff", "super_admin"]));
    d.getStaffMe.mockImplementation(async (role) => {
      if (role === "staff") throw new ApiError(403, { error: "staff_membership_required" });
      return { ...opsStaff, role };
    });
    await expect(loadAccess(d)).resolves.toMatchObject({ kind: "granted", staffRole: "super_admin", adminRole: "super_admin" });
    expect(d.getStaffMe.mock.calls).toEqual([["staff"], ["super_admin"]]);
  });

  it("keeps the Admin view when the API does not grant admins the staff routes", async () => {
    const d = deps(me(["ops_admin"], "Ops Person"), new ApiError(403, { error: "staff_membership_required" }));
    await expect(loadAccess(d)).resolves.toEqual({
      kind: "granted",
      name: "Ops Person",
      staff: null,
      staffRole: null,
      adminRole: "ops_admin",
    });
  });

  it("rethrows a failure that says nothing about the account", async () => {
    await expect(loadAccess(deps(new Error("offline")))).rejects.toThrow("offline");
    await expect(loadAccess(deps(new ApiError(503, { error: "server_error" })))).rejects.toBeInstanceOf(ApiError);
    await expect(loadAccess(deps(me(["staff"]), new ApiError(500, {})))).rejects.toBeInstanceOf(ApiError);
    await expect(loadAccess(deps(me(["ops_admin"]), new Error("offline")))).rejects.toThrow("offline");
  });
});

describe("roles → tabs", () => {
  const granted = (staff: StaffProfile | null, adminRole: "ops_admin" | "super_admin" | null): Access => ({
    kind: "granted",
    name: "x",
    staff,
    staffRole: staff ? (staff.role === adminRole ? adminRole : "staff") : null,
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

  it("gives Operations every tab once the API grants it the staff routes", () => {
    expect(accessTabs(granted(opsStaff, "ops_admin"))).toEqual({ scan: true, handovers: true, hub: true, admin: true });
  });

  it("gives Operations the Admin view and the SOP without the staff routes, never Scan", () => {
    expect(accessTabs(granted(null, "ops_admin"))).toEqual({ scan: false, handovers: false, hub: true, admin: true });
  });

  it("reads the hub as staff first, else with the admin membership", () => {
    expect(hubReadRole(granted(hubStaff, "super_admin"))).toBe("staff");
    expect(hubReadRole(granted({ ...opsStaff, role: "super_admin" }, "super_admin"))).toBe("super_admin");
    expect(hubReadRole(granted(null, "super_admin"))).toBe("super_admin");
    expect(hubReadRole({ kind: "none" })).toBeNull();
  });

  it("selects the staff routes with staff, or with the admin membership that grants them", () => {
    expect(staffRequestRole(granted(hubStaff, "ops_admin"))).toBe("staff");
    expect(staffRequestRole(granted(opsStaff, "ops_admin"))).toBe("ops_admin");
    expect(staffRequestRole(null)).toBe("staff");
  });

  it("prefers Super Admin over Operations", () => {
    expect(adminRoleFrom([{ role: "ops_admin" }, { role: "super_admin" }])).toBe("super_admin");
    expect(adminRoleFrom([{ role: "staff" }])).toBeNull();
  });

  it("labels configurable role codes in plain words", () => {
    expect(roleLabel("hub_staff")).toBe("Hub staff");
    expect(roleLabel("ops_admin")).toBe("Operations");
    expect(roleLabel("super_admin")).toBe("Super Admin");
    expect(roleLabel("")).toBe("Staff");
  });

  it("uses the role name Super Admin set when the API sends one", () => {
    expect(roleLabel("qa_desk", "Front desk (no handout)")).toBe("Front desk (no handout)");
    expect(roleLabel("qa_desk", "  ")).toBe("Qa desk");
    expect(roleLabel("qa_desk", null)).toBe("Qa desk");
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
