import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useThemeColors } from "@/hooks/useTheme";

export type NoticeTone = "info" | "success" | "warning" | "error" | "neutral";
export type NoticeIcon = "info" | "circle-check" | "triangle-alert" | "circle-x" | "clock";

const ICONS = {
  info: CircleAlert,
  "circle-check": CircleCheck,
  "triangle-alert": TriangleAlert,
  "circle-x": CircleX,
  clock: Clock,
} satisfies Record<NoticeIcon, LucideIcon>;

const TONE = {
  info: { border: "border-info", token: "info" },
  success: { border: "border-success", token: "success" },
  warning: { border: "border-warning", token: "warning" },
  error: { border: "border-error", token: "error" },
  neutral: { border: "border-outline", token: "textMuted" },
} as const;

type Props = {
  tone: NoticeTone;
  icon: NoticeIcon;
  /** Says the state in staff's words. */
  title: string;
  /** What it means and what to do about it. */
  body?: string | null;
  /** A recovery staff can take right here. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * One state staff need to know about, stated in place.
 *
 * Icon plus label plus colour, so it survives greyscale and a screen reader.
 * Never yellow — the screen's single yellow belongs to its primary action, and
 * a notice that shouts as loudly as the CTA makes both meaningless.
 */
export function InlineNotice({ tone, icon, title, body, actionLabel, onAction }: Props) {
  const colors = useThemeColors();
  const style = TONE[tone];
  const Icon = ICONS[icon];

  return (
    <View
      className={`flex-row gap-3 rounded-card border bg-surface p-4 ${style.border}`}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={body ? `${title}. ${body}` : title}
    >
      <View className="pt-0.5">
        <Icon size={18} color={colors[style.token]} strokeWidth={2} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-body font-bold text-text-primary">{title}</Text>
        {body ? <Text className="text-body text-text-secondary">{body}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            className="gg-touch mt-1 justify-center"
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
          >
            <Text className="text-button text-text-primary underline">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
