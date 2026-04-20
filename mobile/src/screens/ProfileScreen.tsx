import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { STRINGS } from "../shared/constants/strings";

export function ProfileScreen() {
  const { logout, state } = useAuth();
  const user = state.user;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.profileTitle}</Text>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>{STRINGS.registerName}</Text>
          <Text style={styles.value}>{user.name ?? "—"}</Text>
          <Text style={[styles.label, styles.spaced]}>{STRINGS.profileEmail}</Text>
          <Text style={styles.value}>{user.email}</Text>
          <Text style={[styles.label, styles.spaced]}>{STRINGS.profilePlan}</Text>
          <Text style={styles.value}>{user.plan}</Text>
        </View>
      ) : null}
      <Pressable style={styles.signOut} onPress={() => void logout()}>
        <Text style={styles.signOutText}>{STRINGS.profileSignOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#202124", marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#5F6368", textTransform: "uppercase" },
  spaced: { marginTop: 12 },
  value: { fontSize: 16, color: "#202124", marginTop: 4 },
  signOut: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 16, fontWeight: "600", color: "#EA4335" },
});
