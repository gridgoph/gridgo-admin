import { render, screen } from "@testing-library/react-native";

import HubScreen from "@/app/(tabs)/hub";
import { setTokenProvider } from "@/lib/api";
import { useSession } from "@/store/session";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});

const SOP = ["Wear GRIDGO identification during hub hours.", "On a mismatch, stop and escalate to Operations."];

function stubHub(schedule: unknown) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ hub: { id: "primary", name: "GRIDGO pickup hub", schedule, point: { label: "GRIDGO Office" } }, sop: SOP }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  setTokenProvider(async () => "jwt");
  useSession.getState().setAccess({
    kind: "granted",
    name: "Hub Tester",
    staff: { id: "user_1", name: "Hub Tester", role: "hub_staff", canHandout: true },
    staffRole: "staff",
    adminRole: null,
  });
});

describe("hub duty", () => {
  it("shows the SOP while hub hours are not set yet", async () => {
    stubHub(null);
    await render(<HubScreen />);
    expect(await screen.findByText(SOP[0])).toBeTruthy();
    expect(screen.getByText("Hub hours not set")).toBeTruthy();
  });

  it("shows the hub days and no warning once hours are set", async () => {
    stubHub({ utcOffsetMinutes: 480, week: [1, 3, 5].map((weekday) => ({ weekday, opensMinute: 540, closesMinute: 1020 })) });
    await render(<HubScreen />);
    expect(await screen.findByText(SOP[0])).toBeTruthy();
    expect(screen.queryByText("Hub hours not set")).toBeNull();
    expect(screen.queryByText(/none set/)).toBeNull();
  });
});
