import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space, type } from "@/theme/tokens";

type Props = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function EmptyState({ title, description, children }: Props) {
  return (
    <View style={styles.box}>
      <Text style={[type.headline, styles.title]}>{title}</Text>
      <Text style={[type.caption, styles.desc]}>{description}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  title: { textAlign: "center" },
  desc: { textAlign: "center", maxWidth: 280, color: colors.textSecondary },
});
