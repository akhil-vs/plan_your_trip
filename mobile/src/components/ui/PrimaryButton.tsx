import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

type Props = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function PrimaryButton({ label, loading, variant = "primary", disabled, style, ...rest }: Props) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === "secondary" && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : colors.brandPrimary} />
      ) : (
        <Text style={[styles.label, isPrimary && styles.labelOnPrimary, isGhost && styles.labelGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.92 },
  label: { fontSize: 16, fontWeight: "600", color: colors.text },
  labelOnPrimary: { color: "#fff" },
  labelGhost: { color: colors.brandPrimary },
});
