import { Pressable, Text, View } from "react-native";

export type Segment<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
  /** Keep the label for screen readers only, where the screen already names it. */
  hideLabel?: boolean;
};

/**
 * One choice from two or three short, mutually exclusive options.
 *
 * Built on GRIDGO tokens rather than the platform segmented control: that
 * component styles itself from the OS palette and cannot be told to use this
 * product's surfaces, so on one screen it would read as a control borrowed from
 * another app. The behaviour it provides — a radio group with a selected
 * segment — is small enough to owe nothing to the native implementation.
 *
 * Selection is a filled segment and a bold label, so it survives greyscale.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
}: Props<T>) {
  return (
    <View className="gap-3">
      {hideLabel ? null : <Text className="text-overline text-text-muted">{label.toUpperCase()}</Text>}
      <View
        className="flex-row gap-1 rounded-field border border-outline bg-surface-variant p-1"
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {segments.map((segment) => {
          const selected = segment.id === value;
          return (
            <Pressable
              key={segment.id}
              onPress={() => onChange(segment.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={segment.label}
              className={
                selected
                  ? "min-h-11 flex-1 items-center justify-center rounded-md bg-surface px-3 py-2"
                  : "min-h-11 flex-1 items-center justify-center rounded-md px-3 py-2"
              }
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            >
              <Text
                className={
                  selected
                    ? "text-center text-button text-text-primary"
                    : "text-center text-body text-text-secondary"
                }
                numberOfLines={2}
              >
                {segment.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
