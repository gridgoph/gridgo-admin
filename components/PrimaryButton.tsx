import { Pressable, Text, View, type PressableProps } from "react-native";

type Props = {
  /** A clear verb. "Approve & Continue", not "Submit". */
  label: string;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  /**
   * Large target for outdoor, one-handed trip actions (well above 44dp).
   * Use on Active primary CTAs only.
   */
  size?: "default" | "large";
};

/**
 * The one primary action on a screen or bounded panel.
 *
 * Yellow is a finite attention budget. If a screen already has a
 * PrimaryButton, every other action on it is a SecondaryButton.
 */
export function PrimaryButton({ label, onPress, disabled, size = "default" }: Props) {
  /*
    A disabled CTA gives its yellow back. Fading the fill instead leaves a pale
    slab with grey-on-cream text that fails contrast and still spends the
    screen's one loud element on something nobody can press.
  */
  const large = size === "large";
  const box = disabled
    ? `${large ? "min-h-14" : "h-11 min-w-11"} flex-row items-center justify-center rounded-field border border-outline bg-surface-variant px-4`
    : large
      ? "min-h-14 flex-row items-center justify-center rounded-field bg-action-yellow px-4"
      : "gg-btn-primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={box}
    >
      {({ pressed }) => (
        <>
          <Text
            className={[
              large ? "text-body-lg font-bold" : "text-button",
              disabled ? "text-text-muted" : "text-action-yellow-on",
            ].join(" ")}
          >
            {label}
          </Text>
          {pressed ? <View className="gg-pressed absolute inset-0 rounded-field" /> : null}
        </>
      )}
    </Pressable>
  );
}
