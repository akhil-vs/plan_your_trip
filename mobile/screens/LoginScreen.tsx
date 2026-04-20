import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
} from "react-native";
import Toast from "react-native-toast-message";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Screen } from "../components/Screen";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { showAuthError } from "../utils/authToast";
import { getApiBase } from "../utils/apiBase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, typeof routeNames.Login>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const nav = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await login(email.trim(), password);
      const u = useAuthStore.getState().user;
      nav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: u?.onboardingComplete ? routeNames.Main : routeNames.Onboarding,
            },
          ],
        })
      );
      Toast.show({ type: "success", text1: "Welcome back" });
    } catch (e) {
      showAuthError("Sign in failed", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.sub}>Plan trips with your team.</Text>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title="Continue" onPress={onSubmit} loading={busy} />
        {__DEV__ ? (
          <Text style={styles.devApi} selectable>
            API: {getApiBase()}
          </Text>
        ) : null}
        <Button
          title="Create account"
          variant="ghost"
          onPress={() => navigation.navigate(routeNames.Register)}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: 24 },
  title: {
    fontSize: typography.title + 2,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  sub: { color: colors.textSecondary, marginBottom: 24, fontSize: typography.body },
  devApi: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    opacity: 0.85,
  },
});
