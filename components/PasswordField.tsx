import { Eye, EyeOff } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  testID?: string;
  /**
   * Noun the show/hide control names. Defaults to "password" so login's
   * "Show password" / "Hide password" labels stay put. A screen with three
   * fields passes a distinct noun so each eye is its own control.
   */
  visibilityLabel?: string;
};

export const PasswordField = forwardRef<TextInput, Props>(function PasswordField(
  { testID = "password-visibility", visibilityLabel = "password", ...props },
  ref,
) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  return (
    <View className="relative justify-center">
      <TextInput
        {...props}
        ref={ref}
        className="gg-field"
        style={[props.style, { ...fieldInputStyle, paddingEnd: 56 }]}
        secureTextEntry={!visible}
        placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
      />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={visible ? `Hide ${visibilityLabel}` : `Show ${visibilityLabel}`}
        accessibilityState={{ selected: visible }}
        testID={testID}
        className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
      >
        {visible ? (
          <EyeOff size={20} color={colors.textSecondary} strokeWidth={2} />
        ) : (
          <Eye size={20} color={colors.textSecondary} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
});
