import type { ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { spacing } from "@/constants/theme";

/**
 * The scrolling body of any screen that has a field on it.
 *
 * This replaced React Native's `KeyboardAvoidingView`, which was covering the
 * field someone was typing into. Three separate reasons, and the last one is
 * the reason no amount of tuning `behavior` would have fixed it:
 *
 *  1. Android did nothing at all. Every call site passed
 *     `behavior={Platform.OS === "ios" ? "padding" : undefined}`, and with no
 *     behavior `KeyboardAvoidingView` renders a plain `View`. It relied on the
 *     window resizing under it — which stopped happening the moment this app
 *     went edge-to-edge (`android.edgeToEdgeEnabled`, and mandatory from
 *     Android 15): the IME arrives as a window inset now, the app keeps its
 *     full height, and there is nothing for that component to measure.
 *  2. It resizes a container; it never scrolls. Sign-up asks for seven fields
 *     and the pickup escalation note sits at the bottom of a long page, so
 *     "the container is shorter now" still leaves the focused field under the
 *     keyboard.
 *  3. It knows nothing about a scroll view's content inset, so the submit
 *     control below the last field became unreachable without dismissing the
 *     keyboard first.
 *
 * `KeyboardAwareScrollView` answers all three: it extends the scrollable area
 * by the keyboard's real height and scrolls the focused input above it.
 *
 * The layout classes go on a `View` inside, not on the scroll view itself.
 * `KeyboardAwareScrollView` is a third-party component, so NativeWind does not
 * replace it and a `className` on it would be dropped in silence — the same
 * trap that `components/Screen.tsx` documents for `SafeAreaView`.
 */

/** Breathing room between the caret and the top of the keyboard. */
const CARET_GAP = spacing.xl;

const FILL = { flex: 1 } as const;
/** So a short page can still centre itself against the full screen height. */
const GROW = { flexGrow: 1 } as const;

type Props = {
  /**
   * Layout classes for the page body — what a plain `ScrollView`'s
   * `contentContainerClassName` used to carry.
   */
  contentClassName?: string;
  /**
   * Height of a bar pinned below this scroll (`StickyActionBar`), which rides
   * above the keyboard with it. Without this the focused field clears the
   * keyboard and lands behind the bar instead.
   */
  stickyActionHeight?: number;
  children: ReactNode;
};

export function FormScroll({ contentClassName, stickyActionHeight = 0, children }: Props) {
  return (
    <KeyboardAwareScrollView
      style={FILL}
      contentContainerStyle={GROW}
      bottomOffset={CARET_GAP}
      extraKeyboardSpace={stickyActionHeight}
      // Tapping the page outside a control puts the keyboard away; tapping a
      // control still works, so the submit button takes the first tap rather
      // than spending it on a dismiss.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View className={contentClassName}>{children}</View>
    </KeyboardAwareScrollView>
  );
}
