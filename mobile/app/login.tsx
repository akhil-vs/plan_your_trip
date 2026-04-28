import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { TextField } from "@/components/ui/TextField";
import { useAuthStore } from "@/stores/auth-store";
import { colors, space, type } from "@/theme/tokens";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async () => {
    try {
      setPending(true);
      await signIn(email.trim(), password);
      router.replace("/trips");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed";
      Alert.alert("Unable to sign in", message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AppScreen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <Text style={type.overline}>PlanYourTrip</Text>
          <Text style={[type.title, styles.headline]}>Welcome back</Text>
          <Text style={[type.caption, styles.sub]}>Sign in to sync itineraries and maps across devices.</Text>
        </View>

        <SurfaceCard style={styles.card}>
          <TextField
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton label="Sign in" loading={pending} onPress={onSubmit} />
        </SurfaceCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Link href="/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: space.xl, gap: space.sm },
  headline: { marginTop: space.xs },
  sub: { color: colors.textSecondary, maxWidth: 320 },
  card: { gap: space.lg },
  footer: { marginTop: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 15, color: colors.textSecondary },
  footerLink: { fontSize: 15, fontWeight: "600", color: colors.brandPrimary },
});
