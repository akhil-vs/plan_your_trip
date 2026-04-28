import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/services/api";
import { colors, space, type } from "@/theme/tokens";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async () => {
    try {
      setPending(true);
      await api.register(name.trim(), email.trim(), password);
      router.replace("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      Alert.alert("Unable to register", message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AppScreen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <Text style={type.overline}>PlanYourTrip</Text>
          <Text style={[type.title, styles.headline]}>Create your account</Text>
          <Text style={[type.caption, styles.sub]}>Build trips, optimize routes, and collaborate with your group.</Text>
        </View>

        <SurfaceCard style={styles.card}>
          <TextField label="Name" placeholder="Alex" autoComplete="name" textContentType="name" value={name} onChangeText={setName} />
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
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton label="Create account" loading={pending} onPress={onSubmit} />
        </SurfaceCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
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
