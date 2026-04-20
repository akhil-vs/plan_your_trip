import { Pressable, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
export function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const navigation = useNavigation();

  return (
    <Screen>
      <Text style={styles.h1}>Profile</Text>
      <Card>
        <Text style={styles.name}>{user?.name || "Traveler"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.plan}>Plan: {user?.plan ?? "FREE"}</Text>
      </Card>
      <Button title="Refresh account" variant="secondary" onPress={refreshUser} />
      <Pressable
        style={styles.row}
        onPress={() =>
          navigation.getParent()?.navigate(routeNames.Pricing as never)
        }
      >
        <Text style={styles.rowText}>Pricing & plans</Text>
        <Text style={styles.chev}>›</Text>
      </Pressable>
      {user?.isAdmin && (
        <Pressable
          style={styles.row}
          onPress={() =>
            navigation.getParent()?.navigate(routeNames.Admin as never)
          }
        >
          <Text style={styles.rowText}>Admin</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      )}
      <View style={styles.spacer} />
      <Button
        title="Log out"
        variant="secondary"
        onPress={async () => {
          await logout();
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: routeNames.Login }] })
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 16,
  },
  name: { fontSize: typography.subtitle, fontWeight: "700", color: colors.text },
  email: { color: colors.textSecondary, marginTop: 4 },
  plan: { marginTop: 8, fontWeight: "600", color: colors.primary },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  rowText: { fontSize: typography.body, color: colors.text },
  chev: { fontSize: 20, color: colors.textSecondary },
  spacer: { flex: 1, minHeight: 24 },
});
