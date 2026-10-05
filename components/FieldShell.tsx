import type { ReactNode } from "react";
import { Text, View } from "react-native";

type Props = {
  label: string;
  /** Explains the constraint before anyone hits it. Optional. */
  hint?: string;
  /** Names what is wrong and how to fix it. Replaces the hint when present. */
  error?: string | null;
  children: ReactNode;
};

/**
 * Label, control, and one line of help — in that order, every time.
 *
 * A label labels and helper text explains; neither does the other's job.
 */
export function FieldShell({ label, hint, error, children }: Props) {
  return (
    <View className="gap-2">
      <Text className="text-caption text-text-muted">{label}</Text>
      {children}
      {error ? (
        <Text className="text-caption text-error">{error}</Text>
      ) : hint ? (
        <Text className="text-caption text-text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
