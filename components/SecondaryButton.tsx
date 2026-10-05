import { Pressable, Text, View, type PressableProps } from "react-native";

type Props = {
  label: string;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  /**
   * Match PrimaryButton `large` height and type when the two sit as a pair.
   */
  size?: "default" | "large";
};

/**
 * Every action that is not the screen's primary one.
 *
 * Stays monochrome so the single yellow CTA keeps its meaning.
 */
export function SecondaryButton({ label, onPress, disabled, size = "default" }: Props) {
  const large = size === "large";
  const box = disabled
    ? `${large ? "min-h-14" : "h-11 min-w-11"} flex-row items-center justify-center rounded-field border border-outline bg-surface-variant px-4`
    : large
      ? "min-h-14 flex-row items-center justify-center rounded-field border border-outline bg-surface px-4"
      : "gg-btn-secondary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={disabled ? `${box} gg-disabled` : box}
    >
      {({ pressed }) => (
        <>
          <Text className={large ? "text-body-lg font-bold text-text-primary" : "text-button text-text-primary"}>
            {label}
          </Text>
          {pressed ? <View className="gg-pressed absolute inset-0 rounded-field" /> : null}
        </>
      )}
    </Pressable>
  );
}
