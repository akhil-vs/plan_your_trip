import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { STRINGS } from "../shared/constants/strings";

type Nav = StackNavigationProp<RootStackParamList, "Register">;

export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const { register, state } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onSubmit = React.useCallback(async () => {
    try {
      await register(name.trim(), email.trim(), password);
    } catch {
      /* state.error */
    }
  }, [email, name, password, register]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>{STRINGS.registerTitle}</Text>
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      <Text style={styles.label}>{STRINGS.registerName}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Alex"
        placeholderTextColor="#9AA0A6"
        style={styles.input}
      />
      <Text style={styles.label}>{STRINGS.signInEmail}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#9AA0A6"
        style={styles.input}
      />
      <Text style={styles.label}>{STRINGS.signInPassword}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor="#9AA0A6"
        style={styles.input}
      />
      <Pressable
        style={[styles.primaryButton, state.loading ? styles.buttonDisabled : null]}
        onPress={() => void onSubmit()}
        disabled={state.loading}
      >
        {state.loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryText}>{STRINGS.registerButton}</Text>
        )}
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.navigate("Login")}>
        <Text style={styles.linkText}>{STRINGS.registerBackToSignIn}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 24, paddingTop: 48, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#202124", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#5F6368", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#202124",
    marginBottom: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  link: { marginTop: 20, alignItems: "center" },
  linkText: { fontSize: 15, color: "#1A73E8", fontWeight: "600" },
  error: { color: "#EA4335", fontSize: 14, marginBottom: 12 },
});
