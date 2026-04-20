import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text}>You are offline. Some actions may not work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { color: "#f8fafc", fontSize: 13, textAlign: "center" },
});
