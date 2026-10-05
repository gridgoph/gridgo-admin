import {
  ApiError,
  apiErrorMessage,
  claimHandover,
  getMe,
  listAllHandouts,
  redeemInvite,
  resolveApiBase,
  setTokenProvider,
  setUnauthorizedHandler,
} from "@/lib/api";

type Reply = { status: number; body: unknown };

function stubFetch(...replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift() ?? { status: 500, body: {} };
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      text: async () => JSON.stringify(reply.body),
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return calls;
}

function headers(call: { init: RequestInit }) {
  return call.init.headers as Record<string, string>;
}

afterEach(() => {
  setTokenProvider(null);
  setUnauthorizedHandler(null);
});

describe("requests", () => {
  it("selects the staff projection and sends both halves of a claim", async () => {
    setTokenProvider(async () => "jwt-1");
    const calls = stubFetch({ status: 200, body: { handout: { id: "h" }, order: { orderId: "ord_1" } } });
    await claimHandover("qr-token", "123456");
    expect(calls[0].url).toMatch(/\/staff\/hub\/claims$/);
    expect(headers(calls[0])["X-GRIDGO-Role"]).toBe("staff");
    expect(headers(calls[0]).Authorization).toBe("Bearer jwt-1");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ qrToken: "qr-token", otp: "123456" });
  });

  it("reads the Admin feeds with the admin membership, never staff", async () => {
    setTokenProvider(async () => "jwt-1");
    const calls = stubFetch({ status: 200, body: { handouts: [], staffTotals: [], nextCursor: null } });
    await listAllHandouts("ops_admin", "2026-10-05T00:00:00Z|h_1");
    expect(calls[0].url).toMatch(/\/ops\/hub\/handouts\?before=2026-10-05T00%3A00%3A00Z%7Ch_1$/);
    expect(headers(calls[0])["X-GRIDGO-Role"]).toBe("ops_admin");
  });

  it("probes identity without a role header", async () => {
    setTokenProvider(async () => "jwt-1");
    const calls = stubFetch({ status: 200, body: { user: { id: "u" }, memberships: [] } });
    await getMe();
    expect(headers(calls[0])["X-GRIDGO-Role"]).toBeUndefined();
  });

  it("retries a 401 once with a freshly minted token before giving up", async () => {
    const provider = jest.fn(async (options?: { skipCache?: boolean }) =>
      options?.skipCache ? "fresh" : "stale",
    );
    setTokenProvider(provider);
    const signedOut = jest.fn();
    setUnauthorizedHandler(signedOut);
    const calls = stubFetch(
      { status: 401, body: { error: "unauthorized" } },
      { status: 200, body: { handouts: [], staffTotals: [], nextCursor: null } },
    );
    await listAllHandouts("super_admin");
    expect(calls.map((call) => headers(call).Authorization)).toEqual(["Bearer stale", "Bearer fresh"]);
    expect(signedOut).not.toHaveBeenCalled();
  });

  it("signs out only when the fresh token is refused too", async () => {
    setTokenProvider(async () => "jwt");
    const signedOut = jest.fn();
    setUnauthorizedHandler(signedOut);
    stubFetch({ status: 401, body: { error: "unauthorized" } }, { status: 401, body: { error: "unauthorized" } });
    await expect(listAllHandouts("ops_admin")).rejects.toBeInstanceOf(ApiError);
    expect(signedOut).toHaveBeenCalledTimes(1);
  });

  it("never signs out on an unmapped identity probe", async () => {
    setTokenProvider(async () => "jwt");
    const signedOut = jest.fn();
    setUnauthorizedHandler(signedOut);
    const calls = stubFetch({ status: 401, body: { error: "unmapped_identity" } });
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    expect(signedOut).not.toHaveBeenCalled();
  });

  it("redeems a trimmed invite code", async () => {
    setTokenProvider(async () => "jwt");
    const calls = stubFetch({ status: 200, body: { staff: { id: "u", name: "N", role: "hub_staff", canHandout: true } } });
    await expect(redeemInvite("  code-1  ")).resolves.toMatchObject({ role: "hub_staff" });
    expect(calls[0].url).toMatch(/\/auth\/staff\/redeem$/);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: "code-1" });
  });
});

describe("invite copy", () => {
  it.each([
    ["staff_invite_invalid", /expired or been cancelled/],
    ["staff_invite_used", /already used by another account/],
    ["staff_already_enrolled", /already has staff access/],
  ])("%s", (code, copy) => {
    expect(apiErrorMessage(new ApiError(409, { error: code }), "fallback")).toMatch(copy);
  });
});

describe("resolveApiBase", () => {
  it("prefers the configured URL on every platform", () => {
    expect(resolveApiBase({ envUrl: "https://api.example.test/", platformOS: "android", devHostUri: "127.0.0.1:8084" }))
      .toBe("https://api.example.test");
  });

  it("follows the web page host so admin.localhost reaches the API on the same site", () => {
    expect(resolveApiBase({ platformOS: "web", pageHostname: "admin.localhost" })).toBe("http://admin.localhost:8787");
  });

  it("uses the emulator loopback only on an emulator", () => {
    expect(resolveApiBase({ platformOS: "android", devHostUri: "localhost:8084", isDevice: false }))
      .toBe("http://10.0.2.2:8787");
    expect(resolveApiBase({ platformOS: "android", devHostUri: "localhost:8084", isDevice: true }))
      .toBe("http://127.0.0.1:8787");
    expect(resolveApiBase({ platformOS: "ios", devHostUri: "192.168.1.9:8084" })).toBe("http://192.168.1.9:8787");
  });
});
