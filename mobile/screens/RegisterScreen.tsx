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
import { Header } from "../components/Header";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { showAuthError } from "../utils/authToast";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof routeNames.Register
>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const nav = useNavigation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
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
      Toast.show({ type: "success", text1: "Account created" });
    } catch (e) {
      showAuthError("Could not create account", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Register" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Text style={styles.sub}>Create your Viazo account.</Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Password (min 6 chars)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title="Sign up" onPress={onSubmit} loading={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sub: { color: colors.textSecondary, marginBottom: 16, fontSize: typography.body },
});
