import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useIsFocused } from "expo-router";
import { Camera, CameraOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useThemeColors } from "@/hooks/useTheme";
import { cleanQrToken, plausibleQrToken } from "@/lib/handover";

type Props = {
  /** A QR that looks like a GRIDGO claim token. Fired once per scan. */
  onScan: (qrToken: string) => void;
};

/** The square the client's QR goes into. Square because QR codes are. */
const FRAME_STYLE = { width: "100%", aspectRatio: 1, maxHeight: 360 } as const;

/**
 * The camera, and every reason it might not be there.
 *
 * A scanner that can fail silently is worse than none at the counter, so each
 * state says what to do: allow the camera, open settings, or type the code
 * (the typed fallback lives under this component on the Scan screen). The
 * camera only runs while the Scan tab is focused.
 */
export function QrScanner({ onScan }: Props) {
  const colors = useThemeColors();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [failed, setFailed] = useState(false);
  const [notGridgo, setNotGridgo] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!focused) handled.current = false;
  }, [focused]);

  useEffect(() => {
    if (!notGridgo) return;
    const timer = setTimeout(() => {
      setNotGridgo(false);
      handled.current = false;
    }, 1800);
    return () => clearTimeout(timer);
  }, [notGridgo]);

  function handle(result: BarcodeScanningResult) {
    if (handled.current) return;
    handled.current = true;
    const token = cleanQrToken(result.data ?? "");
    if (!plausibleQrToken(token)) {
      setNotGridgo(true);
      return;
    }
    onScan(token);
  }

  if (failed) {
    return (
      <Placeholder icon="off" title="Camera not available" body="Type the QR code below instead." />
    );
  }

  if (!permission) {
    return <Placeholder icon="camera" title="Starting the camera…" />;
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <View style={FRAME_STYLE} className="items-center justify-center gap-4 rounded-card border border-outline bg-surface p-6">
        <CameraOff size={32} color={colors.textMuted} strokeWidth={1.75} />
        <View className="gap-1">
          <Text className="text-center text-h3 text-text-primary">Camera is off</Text>
          <Text className="text-center text-body text-text-secondary">
            {blocked
              ? "Turn on the camera for GRIDGO Admin in this phone's settings, or type the QR code below."
              : "GRIDGO Admin needs the camera to scan the client's pick-up QR."}
          </Text>
        </View>
        <View className="w-full max-w-72">
          {blocked ? (
            <SecondaryButton label="Open settings" onPress={() => void Linking.openSettings()} />
          ) : (
            <PrimaryButton label="Turn on camera" onPress={() => void requestPermission()} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={FRAME_STYLE} className="overflow-hidden rounded-card bg-black">
      {focused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handle}
          onMountError={() => setFailed(true)}
          accessibilityLabel="Camera viewfinder"
        />
      ) : null}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <CornerMarks />
      </View>
      <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 items-center p-3">
        <View className="rounded-pill bg-scrim px-3 py-1.5">
          <Text className="text-body font-medium text-white" accessibilityLiveRegion="polite">
            {notGridgo ? "Not a GRIDGO pick-up QR. Try again." : "Point at the client's QR code"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Placeholder({ icon, title, body }: { icon: "camera" | "off"; title: string; body?: string }) {
  const colors = useThemeColors();
  const Icon = icon === "off" ? CameraOff : Camera;
  return (
    <View style={FRAME_STYLE} className="items-center justify-center gap-3 rounded-card border border-outline bg-surface p-6">
      <Icon size={32} color={colors.textMuted} strokeWidth={1.75} />
      <Text className="text-center text-h3 text-text-primary">{title}</Text>
      {body ? <Text className="text-center text-body text-text-secondary">{body}</Text> : null}
    </View>
  );
}

/** Four white corners: where to aim, without covering the code. */
function CornerMarks() {
  const corner = "absolute h-10 w-10 border-white";
  return (
    <View className="h-3/5 w-3/5">
      <View className={`${corner} left-0 top-0 rounded-tl-lg border-l-4 border-t-4`} />
      <View className={`${corner} right-0 top-0 rounded-tr-lg border-r-4 border-t-4`} />
      <View className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4`} />
      <View className={`${corner} bottom-0 right-0 rounded-br-lg border-b-4 border-r-4`} />
    </View>
  );
}
