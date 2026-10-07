import { setTokenProvider } from "@/lib/api";
import { useSession } from "@/store/session";

const ME = { user: { id: "user_1", name: "Hub Tester" }, memberships: [{ role: "staff" }] };
const STAFF = { staff: { id: "user_1", name: "Hub Tester", role: "hub_staff", roleName: "Hub staff", canHandout: true } };

function stubFetch(...replies: ({ status: number; body: unknown } | Error)[]) {
  global.fetch = jest.fn(async () => {
    const reply = replies.shift() ?? { status: 500, body: {} };
    if (reply instanceof Error) throw reply;
    return { ok: reply.status < 300, status: reply.status, text: async () => JSON.stringify(reply.body) } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  setTokenProvider(async () => "jwt");
  useSession.getState().reset();
});

afterEach(() => setTokenProvider(null));

describe("session", () => {
  it("keeps granted access when a re-check on resume cannot reach GRIDGO", async () => {
    stubFetch({ status: 200, body: ME }, { status: 200, body: STAFF });
    await useSession.getState().refresh();
    expect(useSession.getState()).toMatchObject({ phase: "ready", access: { kind: "granted" } });

    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    stubFetch(new TypeError("Network request failed"));
    await useSession.getState().refresh();
    warn.mockRestore();
    expect(useSession.getState()).toMatchObject({ phase: "ready", access: { kind: "granted" } });
  });

  it("still applies a re-check that answers, so a suspension takes effect", async () => {
    stubFetch({ status: 200, body: ME }, { status: 200, body: STAFF });
    await useSession.getState().refresh();
    stubFetch({ status: 200, body: ME }, { status: 403, body: { error: "staff_membership_required" } });
    await useSession.getState().refresh();
    expect(useSession.getState()).toMatchObject({ phase: "ready", access: { kind: "paused" } });
  });

  it("offers a retry when the first check fails", async () => {
    stubFetch({ status: 503, body: { error: "unavailable" } });
    await useSession.getState().refresh();
    expect(useSession.getState().phase).toBe("error");
  });
});
