import { TextInput, View, type TextInputProps } from "react-native";

import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** Picks the keyboard, autofill and capitalisation the field really needs. */
  kind?: "phone" | "name" | "text";
  onSubmit?: () => void;
  returnKeyType?: TextInputProps["returnKeyType"];
  editable?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
};

/**
 * A single line of text.
 *
 * The kind decides the keyboard and the autofill hint, so a name field opens
 * a capitalising keyboard and a phone field opens the number pad.
 */
export function TextField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  kind = "text",
  onSubmit,
  returnKeyType,
  editable = true,
  autoCapitalize,
}: Props) {
  const colors = useThemeColors();

  return (
    <View className={editable ? undefined : "gg-disabled"}>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        onSubmitEditing={onSubmit}
        returnKeyType={returnKeyType}
        autoCapitalize={autoCapitalize ?? CAPITALIZE[kind]}
        autoCorrect={kind === "text"}
        autoComplete={AUTOCOMPLETE[kind]}
        keyboardType={KEYBOARD[kind]}
        textContentType={CONTENT_TYPE[kind]}
        className="gg-field"
        style={fieldInputStyle}
      />
    </View>
  );
}

type Kind = NonNullable<Props["kind"]>;

const CAPITALIZE: Record<Kind, TextInputProps["autoCapitalize"]> = {
  phone: "none",
  name: "words",
  text: "characters",
};

const AUTOCOMPLETE: Record<Kind, TextInputProps["autoComplete"]> = {
  phone: "tel",
  name: "name",
  text: "off",
};

const KEYBOARD: Record<Kind, TextInputProps["keyboardType"]> = {
  phone: "phone-pad",
  name: "default",
  text: "default",
};

const CONTENT_TYPE: Record<Kind, TextInputProps["textContentType"]> = {
  phone: "telephoneNumber",
  name: "name",
  text: "none",
};
