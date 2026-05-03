import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { api } from "@/services/api";
import { colors, radius, space, type } from "@/theme/tokens";

export default function SavedGemsScreen() {
  const { data: trips } = useQuery({ queryKey: ["trips"], queryFn: api.trips });
  const activeTrip = useMemo(() => (trips?.myTrips || [])[0], [trips?.myTrips]);
  const { data: saved } = useQuery({
    queryKey: ["saved-gems", activeTrip?.id],
    queryFn: () => api.savedGems(activeTrip?.id || ""),
    enabled: Boolean(activeTrip?.id),
  });

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Saved Gems</Text>
        <Text style={styles.subTitle}>
          {activeTrip ? `Attached to ${activeTrip.name}` : "Create a trip to start saving gems."}
        </Text>
        {(saved || []).map((gem) => (
          <SurfaceCard key={gem.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{gem.name}</Text>
              <Text style={styles.cardMeta}>{gem.category}</Text>
            </View>
            <Pressable style={styles.cta} onPress={() => router.push(`/planner/${gem.tripId}`)}>
              <Text style={styles.ctaText}>Open trip</Text>
            </Pressable>
          </SurfaceCard>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  title: { ...type.title, color: colors.text },
  subTitle: { ...type.caption, color: colors.textMuted },
  card: { flexDirection: "row", alignItems: "center", gap: space.md },
  cardTitle: { ...type.headline, fontSize: 16 },
  cardMeta: { ...type.caption },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
