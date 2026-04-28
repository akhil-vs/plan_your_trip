import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, space } from "@/theme/tokens";

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Defaults to top + horizontal; omit top when a parent `Stack` header handles the inset. */
  safeAreaEdges?: Edge[];
}>;

export function AppScreen({ children, scroll, contentStyle, safeAreaEdges = ["top", "left", "right"] }: Props) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={safeAreaEdges}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safe, contentStyle]} edges={safeAreaEdges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxxl },
});
