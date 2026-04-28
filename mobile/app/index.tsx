import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthStore } from "@/stores/auth-store";
import { colors } from "@/theme/tokens";

export default function Index() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const user = useAuthStore((s) => s.user);

  if (!bootstrapped) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (!user.onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/trips" />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
