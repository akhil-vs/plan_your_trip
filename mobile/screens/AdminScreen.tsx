import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { colors, typography } from "../constants/theme";
import { fetchAdminStats, fetchAdminUsers } from "../services/collaboration";
import type { RootStackParamList } from "../navigation/types";

export function AdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<string>("");
  const [usersPreview, setUsersPreview] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const s = await fetchAdminStats();
        setStats(JSON.stringify(s, null, 2).slice(0, 4000));
      } catch {
        setStats("Forbidden or error");
      }
      try {
        const u = await fetchAdminUsers();
        setUsersPreview(JSON.stringify(u, null, 2).slice(0, 2000));
      } catch {
        setUsersPreview("");
      }
    })();
  }, []);

  return (
    <Screen>
      <Header title="Admin" onBack={() => navigation.goBack()} />
      <ScrollView>
        <Card>
          <Text style={styles.h}>Stats (summary)</Text>
          <Text style={styles.mono}>{stats}</Text>
        </Card>
        <Card>
          <Text style={styles.h}>Users</Text>
          <Text style={styles.mono}>{usersPreview}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontWeight: "700", marginBottom: 8, fontSize: typography.subtitle },
  mono: { fontSize: 11, color: colors.textSecondary, fontFamily: "Courier" },
});
