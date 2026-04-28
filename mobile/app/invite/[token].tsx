import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { api } from "@/services/api";

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Invite</Text>
      <Text style={styles.subtitle}>Accept invitation and open planner.</Text>
      <Button
        title={loading ? "Accepting..." : "Accept invite"}
        onPress={async () => {
          if (!token) return;
          try {
            setLoading(true);
            const result = await api.acceptInvite(token);
            router.replace(`/planner/${result.tripId}`);
          } catch (error) {
            Alert.alert("Invite failed", String(error));
          } finally {
            setLoading(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#6b7280" },
});
