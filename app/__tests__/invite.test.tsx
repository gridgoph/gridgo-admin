import { fireEvent, render, screen } from "@testing-library/react-native";

import InviteScreen from "@/app/invite";
import { setTokenProvider } from "@/lib/api";
import { useSession } from "@/store/session";

type Reply = { status: number; body: unknown };
let calls: { url: string; init: RequestInit }[] = [];

function stubFetch(...replies: Reply[]) {
  calls = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift() ?? { status: 500, body: {} };
    return {
      ok: reply.status < 300,
      status: reply.status,
      text: async () => JSON.stringify(reply.body),
    } as Response;
  }) as unknown as typeof fetch;
}

const hubStaff = { id: "user_1", name: "Hub Person", role: "hub_staff", canHandout: true };

beforeEach(() => {
  setTokenProvider(async () => "jwt");
  useSession.setState({ phase: "ready", access: { kind: "none" }, error: null, pendingInviteCode: null });
});

describe("invite-only access", () => {
  it("shows a signed-in person without a staff role only the invite ask", async () => {
    await render(<InviteScreen />);
    expect(screen.getByText("Ask GRIDGO for an invite")).toBeTruthy();
    expect(screen.getByText("Signed in as staff@example.test")).toBeTruthy();
    expect(screen.queryByText("Scan pick-up QR")).toBeNull();
  });

  it("redeems the code, then re-reads access and grants the staff role", async () => {
    stubFetch(
      { status: 200, body: { staff: hubStaff } },
      { status: 200, body: { user: { id: "user_1", name: "Hub Person" }, memberships: [{ role: "staff" }] } },
      { status: 200, body: { staff: hubStaff } },
    );
    await render(<InviteScreen />);
    await fireEvent.changeText(screen.getByTestId("invite-code"), "gridgoadmin://redeem?code=invite-123");
    await fireEvent.press(screen.getByText("Redeem invite"));

    expect(calls[0].url).toMatch(/\/auth\/staff\/redeem$/);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: "invite-123" });
    expect(calls[1].url).toMatch(/\/auth\/me$/);
    expect(calls[2].url).toMatch(/\/staff\/me$/);
    expect(useSession.getState().access).toEqual({
      kind: "granted",
      name: "Hub Person",
      staff: hubStaff,
      adminRole: null,
    });
  });

  it("explains a refused code and grants nothing", async () => {
    stubFetch({ status: 409, body: { error: "staff_invite_used" } });
    await render(<InviteScreen />);
    await fireEvent.changeText(screen.getByTestId("invite-code"), "used-code");
    await fireEvent.press(screen.getByText("Redeem invite"));
    expect(screen.getByText("Invite not accepted")).toBeTruthy();
    expect(screen.getByText(/already used by another account/)).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(useSession.getState().access).toEqual({ kind: "none" });
  });

  it("prefills the code from an invite link", async () => {
    useSession.setState({ pendingInviteCode: "from-link" });
    await render(<InviteScreen />);
    expect(screen.getByTestId("invite-code").props.value).toBe("from-link");
  });

  it("tells a paused staff member why", async () => {
    useSession.setState({ access: { kind: "paused" } });
    await render(<InviteScreen />);
    expect(screen.getByText("Your staff access is paused")).toBeTruthy();
  });
});
