import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: {
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
});
