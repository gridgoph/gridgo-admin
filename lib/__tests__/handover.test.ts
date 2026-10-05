import { ApiError } from "@/lib/api";
import {
  classifyClaimError,
  cleanOtp,
  cleanQrToken,
  defaultEscalationReason,
  orderRef,
  otpComplete,
  plausibleQrToken,
  retryAfterLabel,
} from "@/lib/handover";

describe("claim refusals", () => {
  it("treats an OTP mismatch as a block with an escalation path, never a success", () => {
    const error = new ApiError(409, {
      error: "handover_otp_mismatch",
      message: "The codes do not match.",
      canEscalate: true,
      escalatePath: "/orders/ord_1/handover/escalate",
    });
    expect(classifyClaimError(error)).toEqual({
      kind: "mismatch",
      escalatePath: "/orders/ord_1/handover/escalate",
    });
  });

  it("ignores an escalation path that is not an order route", () => {
    const error = new ApiError(409, { error: "handover_otp_mismatch", escalatePath: "https://evil.test/x" });
    expect(classifyClaimError(error)).toEqual({ kind: "mismatch", escalatePath: null });
  });

  it("locks after too many wrong codes and keeps escalation open", () => {
    const error = new ApiError(429, {
      error: "handover_attempts_exceeded",
      retryAfter: "2026-10-06T08:15:00.000Z",
      escalatePath: "/orders/ord_1/handover/escalate",
    });
    expect(classifyClaimError(error)).toEqual({
      kind: "locked",
      retryAfter: "2026-10-06T08:15:00.000Z",
      escalatePath: "/orders/ord_1/handover/escalate",
    });
  });

  it.each([
    ["claim_not_found", 404, "not_found"],
    ["handover_already_completed", 409, "already_done"],
    ["final_payment_not_confirmed", 409, "blocked"],
    ["collection_not_available", 409, "blocked"],
    ["refund_fulfillment_stopped", 409, "blocked"],
    ["forbidden", 403, "blocked"],
  ])("%s blocks the handover (%s)", (code, status, kind) => {
    expect(classifyClaimError(new ApiError(status, { error: code })).kind).toBe(kind);
  });

  it("reports a dead connection as nothing recorded", () => {
    const outcome = classifyClaimError(new TypeError("Network request failed"));
    expect(outcome.kind).toBe("error");
  });

  it("never shows a raw code to staff", () => {
    const outcome = classifyClaimError(new ApiError(409, { error: "some_new_code" }));
    expect(outcome).toEqual({
      kind: "error",
      message: "The handover did not go through. Nothing was recorded. Try again.",
    });
  });
});

describe("input rules", () => {
  it("keeps six digits of the client's code", () => {
    expect(cleanOtp("12 34-56789")).toBe("123456");
    expect(otpComplete("123456")).toBe(true);
    expect(otpComplete("12345")).toBe(false);
    expect(otpComplete("12345a")).toBe(false);
  });

  it("accepts a base64url claim token and rejects stray scans", () => {
    const token = "Zm9vYmFyYmF6cXV4X3Rva2VuLWZvci1odWItY2xhaW0";
    expect(plausibleQrToken(cleanQrToken(` ${token}\n`))).toBe(true);
    expect(plausibleQrToken("12345")).toBe(false);
    expect(plausibleQrToken("https://example.test/a b")).toBe(false);
  });

  it("prints the shared order reference", () => {
    expect(orderRef("ord_1a2b3c4d5e6f")).toBe("1A2B-3C4D-5E6F");
    expect(orderRef("ord_demo")).toBe("DEMO");
  });

  it("says how long a locked QR waits", () => {
    const now = new Date("2026-10-06T08:00:00.000Z");
    expect(retryAfterLabel("2026-10-06T08:14:10.000Z", now)).toBe("Try again in 15 min");
    expect(retryAfterLabel(null, now)).toBeNull();
    expect(retryAfterLabel("nonsense", now)).toBeNull();
  });

  it("prefills an escalation reason that says the package stayed", () => {
    expect(defaultEscalationReason({ kind: "mismatch", escalatePath: null })).toMatch(/kept on the counter/);
  });
});
