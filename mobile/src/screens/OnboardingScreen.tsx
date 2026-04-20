import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { STRINGS } from "../shared/constants/strings";

export function OnboardingScreen() {
  const { completeOnboarding, state } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onContinue = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : STRINGS.commonError);
    } finally {
      setBusy(false);
    }
  }, [completeOnboarding]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.onboardingTitle}</Text>
      <Text style={styles.subtitle}>{STRINGS.onboardingSubtitle}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryButton, busy || state.loading ? styles.buttonDisabled : null]}
        onPress={() => void onContinue()}
        disabled={busy || state.loading}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{STRINGS.onboardingContinue}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#202124", marginBottom: 16 },
  subtitle: { fontSize: 16, color: "#5F6368", lineHeight: 24, marginBottom: 32 },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  error: { color: "#EA4335", fontSize: 14, marginBottom: 16 },
});
