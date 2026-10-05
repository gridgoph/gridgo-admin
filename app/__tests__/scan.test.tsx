import { fireEvent, render, screen } from "@testing-library/react-native";

import EscalateScreen from "@/app/escalate";
import ScanScreen from "@/app/(tabs)/scan";
import { setTokenProvider } from "@/lib/api";
import { useScan } from "@/store/scan";

const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const TOKEN = "Zm9vYmFyYmF6cXV4X3Rva2VuLWZvci1odWItY2xhaW0";

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

const body = (index: number) => JSON.parse(String(calls[index].init.body));

beforeEach(() => {
  useScan.getState().reset();
  setTokenProvider(async () => "jwt");
  jest.clearAllMocks();
});

async function scanAndType(otp: string) {
  await render(<ScanScreen />);
  await fireEvent.press(screen.getByText("Type the QR code instead"));
  await fireEvent.changeText(screen.getByTestId("manual-qr"), ` ${TOKEN} `);
  await fireEvent.press(screen.getByText("Use this code"));
  expect(screen.getByText("Enter the client’s code")).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId("client-otp"), otp);
}

describe("scan and confirm", () => {
  it("scans with the camera, then asks for the client's code", async () => {
    await render(<ScanScreen />);
    await fireEvent(screen.getByTestId("camera-view"), "onBarcodeScanned", { data: TOKEN, type: "qr" });
    expect(screen.getByText("Enter the client’s code")).toBeTruthy();
    expect(useScan.getState().qrToken).toBe(TOKEN);
  });

  it("rejects a QR that is not a GRIDGO claim without leaving the camera", async () => {
    await render(<ScanScreen />);
    await fireEvent(screen.getByTestId("camera-view"), "onBarcodeScanned", { data: "hello", type: "qr" });
    expect(screen.getByText("Not a GRIDGO pick-up QR. Try again.")).toBeTruthy();
    expect(useScan.getState().step).toBe("scan");
  });

  it("does not send anything until all six digits are in", async () => {
    stubFetch();
    await scanAndType("12345");
    await fireEvent.press(screen.getByText("Confirm handover"));
    expect(calls).toHaveLength(0);
  });

  it("completes only when the API confirms the QR and the code together", async () => {
    stubFetch({
      status: 200,
      body: {
        handout: { id: "h_1", orderId: "ord_1a2b3c4d", staffId: "u", staffName: "N", hubId: "primary", at: "2026-10-06T02:00:00Z" },
        order: { orderId: "ord_1a2b3c4d", state: "issue_window_open" },
      },
    });
    await scanAndType("123456");
    await fireEvent.press(screen.getByText("Confirm handover"));
    expect(body(0)).toEqual({ qrToken: TOKEN, otp: "123456" });
    expect(screen.getByTestId("result-done")).toBeTruthy();
    expect(screen.getByText("Codes match")).toBeTruthy();
    expect(screen.getByText("1A2B-3C4D")).toBeTruthy();
  });
});

describe("mismatch", () => {
  const mismatch = {
    status: 409,
    body: {
      error: "handover_otp_mismatch",
      canEscalate: true,
      escalatePath: "/orders/ord_1a2b3c4d/handover/escalate",
    },
  };

  it("blocks the handover and offers escalation to Operations", async () => {
    stubFetch(mismatch);
    await scanAndType("654321");
    await fireEvent.press(screen.getByText("Confirm handover"));
    expect(screen.getByTestId("result-refused")).toBeTruthy();
    expect(screen.getByText("Do not hand over")).toBeTruthy();
    expect(screen.queryByText("Codes match")).toBeNull();
    await fireEvent.press(screen.getByText("Escalate to Operations"));
    expect(mockRouter.push).toHaveBeenCalledWith("/escalate");
  });

  it("lets staff retype the code against the same QR and counts the misses", async () => {
    stubFetch(mismatch, mismatch);
    await scanAndType("654321");
    await fireEvent.press(screen.getByText("Confirm handover"));
    await fireEvent.press(screen.getByText("Enter the code again"));
    expect(useScan.getState().qrToken).toBe(TOKEN);
    expect(useScan.getState().otp).toBe("");
    expect(screen.getByText(/Wrong codes on this QR so far: 1/)).toBeTruthy();
  });

  it("locks after too many wrong codes, with no retry but escalation still open", async () => {
    stubFetch({
      status: 429,
      body: {
        error: "handover_attempts_exceeded",
        retryAfter: new Date(Date.now() + 10 * 60000).toISOString(),
        escalatePath: "/orders/ord_1a2b3c4d/handover/escalate",
      },
    });
    await scanAndType("111111");
    await fireEvent.press(screen.getByText("Confirm handover"));
    expect(screen.getByText("Do not hand over")).toBeTruthy();
    expect(screen.queryByText("Enter the code again")).toBeNull();
    expect(screen.getByText("Escalate to Operations")).toBeTruthy();
  });

  it("sends the report with the scanned QR, then says Operations has it", async () => {
    stubFetch(mismatch, { status: 200, body: { escalated: true } });
    await scanAndType("654321");
    await fireEvent.press(screen.getByText("Confirm handover"));

    const escalate = await render(<EscalateScreen />);
    expect(screen.getByText("Order 1A2B-3C4D")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("escalation-reason"), "Client showed a different code.");
    await fireEvent.press(screen.getByText("Send to Operations"));
    expect(calls[1].url).toMatch(/\/orders\/ord_1a2b3c4d\/handover\/escalate$/);
    expect((calls[1].init.headers as Record<string, string>)["X-GRIDGO-Role"]).toBe("staff");
    expect(body(1)).toEqual({ reason: "Client showed a different code.", qrToken: TOKEN });
    expect(mockRouter.back).toHaveBeenCalled();
    await escalate.unmount();

    await render(<ScanScreen />);
    expect(screen.getByText("Operations has been told")).toBeTruthy();
    expect(screen.queryByText("Escalate to Operations")).toBeNull();
  });

  it("stops on a QR that is not waiting at the hub", async () => {
    stubFetch({ status: 404, body: { error: "claim_not_found" } });
    await scanAndType("123456");
    await fireEvent.press(screen.getByText("Confirm handover"));
    expect(screen.getByText("Not a pick-up QR")).toBeTruthy();
    expect(screen.queryByText("Escalate to Operations")).toBeNull();
  });
});
