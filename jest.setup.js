// Reanimated 4 / Worklets load a native TurboModule at import time. Jest has
// no UI runtime, so the Worklets mock must stand in before Reanimated calls
// setUpTests (same harness as gridgo-rider).
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
require("react-native-reanimated").setUpTests();

// Screens read insets from the provider; fall back to zero when a test renders
// a screen without one.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => {
      const insets = React.useContext(actual.SafeAreaInsetsContext);
      return insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
    },
  };
});

require("react-native-gesture-handler/jestSetup");

// Clerk restores its session through native SecureStore in the app. Tests run
// against a deterministic signed-in identity; what GRIDGO grants it is decided
// by the API, which each test stubs through `fetch`.
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||= "pk_test_jest-only";
jest.mock("@clerk/expo", () => {
  const signOut = jest.fn(async () => undefined);
  const getToken = jest.fn(async () => "test-clerk-jwt");
  const signIn = {
    status: "needs_identifier",
    existingSession: null,
    supportedSecondFactors: [],
    password: jest.fn(async () => ({ error: null })),
    finalize: jest.fn(async () => ({ error: null })),
    mfa: {
      sendEmailCode: jest.fn(async () => ({ error: null })),
      verifyEmailCode: jest.fn(async () => ({ error: null })),
      sendPhoneCode: jest.fn(async () => ({ error: null })),
      verifyPhoneCode: jest.fn(async () => ({ error: null })),
      verifyTOTP: jest.fn(async () => ({ error: null })),
      verifyBackupCode: jest.fn(async () => ({ error: null })),
    },
  };
  const user = { primaryEmailAddress: { emailAddress: "staff@example.test" } };
  return {
    ClerkProvider: ({ children }) => children,
    useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken }),
    useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
    useClerk: () => ({ signOut, setActive: jest.fn(async () => undefined) }),
    useSignIn: () => ({ fetchStatus: "idle", signIn }),
  };
});
jest.mock("@clerk/expo/experimental", () => ({
  useSSO: () => ({
    startSSOFlow: jest.fn(async () => ({ createdSessionId: null, authSessionResult: { type: "cancel" } })),
  }),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));

jest.mock("react-native-keyboard-controller", () =>
  require("react-native-keyboard-controller/jest"),
);

// The camera is native. Tests that are about scanning drive the typed
// fallback or call the mocked view's `onBarcodeScanned` directly.
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    CameraView: (props) => React.createElement(View, { testID: "camera-view", ...props }),
    useCameraPermissions: jest.fn(() => [
      { granted: true, canAskAgain: true, status: "granted" },
      jest.fn(async () => ({ granted: true })),
    ]),
  };
});

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

// Expo installs `fetch` lazily through a getter; reading it once here installs
// it while the Expo globals exist, so a late read cannot fail a green run.
void globalThis.fetch;
