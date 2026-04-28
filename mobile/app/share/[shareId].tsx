import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { api } from "@/services/api";

export default function SharedTripScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["sharedTrip", shareId],
    queryFn: () => api.sharedTrip(shareId),
    enabled: Boolean(shareId),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data?.name ?? "Shared trip"}</Text>
      <Text style={styles.subtitle}>
        By {data?.user?.name ?? "Community"} • {data?.waypoints?.length ?? 0} stops
      </Text>
      {isLoading ? <Text>Loading...</Text> : null}
      <FlatList
        data={data?.waypoints ?? []}
        keyExtractor={(item, idx) => `${item.id ?? item.name}-${idx}`}
        renderItem={({ item, index }) => (
          <Text style={styles.stop}>
            {index + 1}. {item.name}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#6b7280", marginTop: 4, marginBottom: 14 },
  stop: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
});
