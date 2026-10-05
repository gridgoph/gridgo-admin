import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";

/**
 * Emailed-code entry, in the GRIDGO mark's own visual language.
 *
 * An unfilled cell holds one quiet dot — the unlit dot from the logo — and
 * typing lights it into a digit, so the code reads as the mark completing
 * itself. The cell waiting for the next digit carries a single yellow bar.
 * That is the only yellow on the screen apart from the button, and "current
 * step" is one of the few places the system allows actionYellow: it is the
 * same rule `PaginationDots` follows.
 *
 * Six visible cells, one real field. A row of six separate inputs is what
 * breaks emailed-code entry in practice — autofill fills the first box, paste
 * drops five digits, and backspace strands the caret. So the keyboard, the
 * one-time-code autofill and the clipboard all talk to a single invisible
 * TextInput stretched across the row, and the cells only draw what it holds.
 */

const CELL_HEIGHT = 56;
/** The logo's unlit dot. */
const DOT = 6;
/** Caret bar under the cell awaiting the next digit. */
const BAR_HEIGHT = 2;

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /** Digits expected. Clerk emails six. */
  length?: number;
  /** Draw the row as refused. Pair with a message; colour never carries it alone. */
  invalid?: boolean;
  disabled?: boolean;
  /** Fired once the last digit lands, so nobody needs a second tap. */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
};

export function CodeField({
  value,
  onChangeText,
  length = 6,
  invalid = false,
  disabled = false,
  onComplete,
  autoFocus = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  // How many cells are lit. Eased once here and read by every cell, so the row
  // settles as one movement rather than six.
  const filled = useSharedValue(value.length);
  // Auto-submit is for finishing typing, not for re-firing on every re-render
  // while the request is in flight.
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    filled.value = reducedMotion
      ? value.length
      : withTiming(value.length, { duration: 180 });
  }, [filled, reducedMotion, value.length]);

  useEffect(() => {
    if (value.length < length) {
      submitted.current = null;
      return;
    }
    if (submitted.current === value) return;
    submitted.current = value;
    onComplete?.(value);
  }, [length, onComplete, value]);

  const digits = Array.from({ length }, (_, index) => value[index] ?? null);
  // Where the next digit lands. Past the end nothing is pending, so no cell
  // claims the caret.
  const activeIndex = focused && !disabled ? value.length : -1;

  return (
    <Pressable onPress={() => input.current?.focus()} disabled={disabled} className="relative">
      {/*
        Hidden from assistive tech, not from sight: the field below owns the
        label and the value, and announcing six boxes as well would read the
        code back one box at a time. The field itself is deliberately a sibling
        of this group rather than a child, so it stays reachable.
      */}
      <View
        className="flex-row gap-2"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {digits.map((digit, index) => (
          <Cell
            key={index}
            index={index}
            digit={digit}
            active={index === activeIndex}
            invalid={invalid}
            disabled={disabled}
            reducedMotion={reducedMotion}
            filled={filled}
          />
        ))}
      </View>

      <TextInput
        ref={input}
        testID={testID}
        // Invisible on purpose: it is the whole row's keyboard, sized to the row
        // so a tap anywhere lands in it. Geometry and transparency cannot come
        // from a class here.
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: CELL_HEIGHT,
          opacity: 0,
        }}
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        maxLength={length}
        // Backspace deletes the last digit wherever they tapped.
        selection={{ start: value.length, end: value.length }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />
    </Pressable>
  );
}

type CellProps = {
  index: number;
  digit: string | null;
  active: boolean;
  invalid: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  filled: SharedValue<number>;
};

function Cell({
  index,
  digit,
  active,
  invalid,
  disabled,
  reducedMotion,
  filled,
}: CellProps) {
  const colors = useThemeColors();

  // Animated values cannot come from a class, so this is on the style
  // exception list.
  const box = useAnimatedStyle(() => {
    // 0 until this cell's digit lands, 1 once it has.
    const lit = interpolate(filled.value, [index, index + 1], [0, 1], "clamp");
    return {
      borderColor: invalid
        ? colors.error
        : interpolateColor(lit, [0, 1], [colors.outline, colors.textMuted]),
    };
  });

  const bar = useAnimatedStyle(() => {
    const width = active ? "44%" : "0%";
    const opacity = active ? 1 : 0;
    return reducedMotion
      ? { width, opacity }
      : {
          width: withTiming(width, { duration: 160 }),
          opacity: withTiming(opacity, { duration: 160 }),
        };
  });

  const dot = useAnimatedStyle(() => ({
    opacity: interpolate(filled.value, [index, index + 0.6], [1, 0], "clamp"),
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          height: CELL_HEIGHT,
          borderRadius: radius.field,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.38 : 1,
        },
        box,
      ]}
      className="bg-surface"
    >
      {digit ? (
        <Text className="text-h2 text-text-primary">{digit}</Text>
      ) : (
        <Animated.View
          style={[
            {
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: colors.textMuted,
            },
            dot,
          ]}
        />
      )}

      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 8,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: colors.actionYellow,
          },
          bar,
        ]}
      />
    </Animated.View>
  );
}
