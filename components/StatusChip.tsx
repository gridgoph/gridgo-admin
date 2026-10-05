import {
  Bell,
  CircleCheck,
  CircleX,
  Clock,
  SquarePen,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { Text, View } from "react-native";

import { useThemeColors } from "@/hooks/useTheme";

/** Maps to the semantic colour tokens. `neutral` carries no signal. */
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

/**
 * The icons this app draws status from, keyed by their Lucide name.
 *
 * Keeping a registry rather than exposing Lucide's whole surface means call
 * sites stay stable if the icon set is ever swapped, and it keeps the chip's
 * vocabulary small enough to stay consistent across screens.
 */
const ICONS = {
  "circle-check": CircleCheck,
  "triangle-alert": TriangleAlert,
  "circle-x": CircleX,
  clock: Clock,
  "square-pen": SquarePen,
  bell: Bell,
} satisfies Record<string, LucideIcon>;

export type StatusIconName = keyof typeof ICONS;

type Props = {
  tone: StatusTone;
  /** Say the state: "Approved", "Blocked", "Updated 3 min ago". */
  label: string;
  icon: StatusIconName;
};

const TONE = {
  success: { border: "border-success", text: "text-success", token: "success" },
  warning: { border: "border-warning", text: "text-warning", token: "warning" },
  error: { border: "border-error", text: "text-error", token: "error" },
  info: { border: "border-info", text: "text-info", token: "info" },
  neutral: { border: "border-outline", text: "text-text-secondary", token: "textSecondary" },
} as const;

/**
 * Colour never carries meaning alone. A status is always icon + label +
 * colour, so the screen stays readable in grayscale and to a screen reader.
 */
export function StatusChip({ tone, label, icon }: Props) {
  const colors = useThemeColors();
  const style = TONE[tone];
  const Icon = ICONS[icon];

  return (
    <View className={`gg-chip ${style.border}`} accessibilityRole="text">
      {/*
        lucide-react-native forwards `testID` as the web-only `data-testid`
        attribute rather than the native `testID` prop (see Icon.js), so it
        never reaches the underlying react-native-svg host component. Wrapping
        in a plain View carries the testID instead, with no visual effect
        since `gg-chip` centers its row and the icon keeps its own fixed size.
      */}
      <View testID="status-chip-icon">
        <Icon size={13} color={colors[style.token]} strokeWidth={2} />
      </View>
      <Text className={`text-caption ${style.text}`}>{label}</Text>
    </View>
  );
}
