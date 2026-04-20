import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../constants/theme";

type Props = {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
};

export function Header({ title, right, onBack }: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    minHeight: 44,
  },
  back: { width: 72 },
  backPlaceholder: { width: 72 },
  backText: { fontSize: 17, color: colors.primary, fontWeight: "500" },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  right: { width: 72, alignItems: "flex-end" },
});
