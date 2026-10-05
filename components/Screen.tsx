import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

import { useThemeColors } from "@/hooks/useTheme";

const ALL_EDGES: readonly Edge[] = ["top", "right", "bottom", "left"];

/**
 * The screen shell: full-bleed canvas, inset on the edges the screen asks for.
 *
 * Padding comes from `useSafeAreaInsets()`, not a measuring safe-area view.
 * A new native stack screen's measuring view reports 0 on the first frame
 * of the push, so the header and copy paint under the status bar and then
 * drop into place — the flick on every navigation. The provider already
 * knows the insets (seeded with `initialWindowMetrics`), so reading them
 * here is correct on that first frame.
 *
 * Tokens go through `style`, not `className`: NativeWind does not style
 * third-party views, and the old measuring shell silently dropped `gg-screen`.
 */
export function Screen({
  edges = ALL_EDGES,
  children,
}: {
  /** Which insets to apply. Omit for all four. */
  edges?: readonly Edge[];
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: edges.includes("top") ? insets.top : 0,
        paddingRight: edges.includes("right") ? insets.right : 0,
        paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        paddingLeft: edges.includes("left") ? insets.left : 0,
      }}
    >
      {children}
    </View>
  );
}
