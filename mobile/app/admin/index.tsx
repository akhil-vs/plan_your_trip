import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/services/api";

const WINDOW_OPTIONS = [7, 30, 90] as const;

export default function AdminScreen() {
  const [days, setDays] = useState<(typeof WINDOW_OPTIONS)[number]>(7);

  const statsQuery = useQuery({
    queryKey: ["adminStats", days],
    queryFn: () => api.adminStats(days),
  });

  const usersQuery = useQuery({
    queryKey: ["adminUsers"],
    queryFn: api.adminUsers,
  });

  const kpis = statsQuery.data?.kpis;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin</Text>

      <View style={styles.row}>
        {WINDOW_OPTIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, days === d && styles.chipActive]}
            onPress={() => setDays(d)}
          >
            <Text style={[styles.chipText, days === d && styles.chipTextActive]}>{d}d</Text>
          </Pressable>
        ))}
      </View>

      {statsQuery.isLoading ? <Text>Loading stats…</Text> : null}
      {kpis ? (
        <View style={styles.kpiGrid}>
          <Text style={styles.kpi}>Users: {kpis.totalUsers}</Text>
          <Text style={styles.kpi}>Trips: {kpis.totalTrips}</Text>
          <Text style={styles.kpi}>Public: {kpis.publicTrips}</Text>
          <Text style={styles.kpi}>Finalized: {kpis.finalizedTrips}</Text>
          <Text style={styles.kpi}>Invites: {kpis.pendingInvites}</Text>
          <Text style={styles.kpi}>Members: {kpis.collaborators}</Text>
          <Text style={styles.kpi}>
            New users ({kpis.windowDays}d): {kpis.newUsers7d}
          </Text>
          <Text style={styles.kpi}>
            New trips ({kpis.windowDays}d): {kpis.newTrips7d}
          </Text>
        </View>
      ) : null}

      <Text style={styles.section}>Plans</Text>
      {(statsQuery.data?.planDistribution ?? []).map((row) => (
        <Text key={row.plan} style={styles.line}>
          {row.plan}: {row.count}
        </Text>
      ))}

      <Text style={styles.section}>Users</Text>
      <FlatList
        data={usersQuery.data ?? []}
        scrollEnabled={false}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{item.name ?? item.email}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userMeta}>
                Plan: {item.plan} · trips {item._count.trips}
              </Text>
            </View>
            <View style={styles.planBtns}>
              {(["FREE", "PRO", "TEAM"] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.miniBtn, item.plan === p && styles.miniBtnOn]}
                  onPress={async () => {
                    try {
                      await api.adminUpdateUserPlan(item.id, p);
                      await usersQuery.refetch();
                    } catch (e) {
                      Alert.alert("Update failed", String(e));
                    }
                  }}
                >
                  <Text style={[styles.miniBtnText, item.plan === p && styles.miniBtnTextOn]}>
                    {p[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  chipText: { fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  kpi: { width: "48%", color: "#111827" },
  section: { fontSize: 16, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  line: { color: "#4b5563", marginBottom: 4 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  userName: { fontWeight: "600", color: "#111827" },
  userEmail: { color: "#6b7280", fontSize: 12 },
  userMeta: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  planBtns: { flexDirection: "row", gap: 4 },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  miniBtnOn: { backgroundColor: "#2563eb" },
  miniBtnText: { fontSize: 11, fontWeight: "700", color: "#111827" },
  miniBtnTextOn: { color: "#fff" },
});
