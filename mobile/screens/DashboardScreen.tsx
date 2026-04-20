import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { SkeletonList } from "../components/SkeletonList";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { fetchTrips, type TripSummary } from "../services/trips";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [myTrips, setMyTrips] = useState<TripSummary[]>([]);
  const [publicTrips, setPublicTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTrips();
      setMyTrips(data.myTrips ?? []);
      setPublicTrips(data.publicTrips ?? []);
    } catch {
      setMyTrips([]);
      setPublicTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  function openTrip(tripId: string) {
    navigation.getParent()?.navigate(routeNames.TripDetail, { tripId });
  }

  function openPlanner(tripId: string) {
    navigation.getParent()?.navigate(routeNames.PlannerTrip, { tripId });
  }

  const sections = [
    { title: "Your trips", data: myTrips },
    ...(publicTrips.length > 0
      ? [{ title: "Community", data: publicTrips }]
      : []),
  ];

  return (
    <Screen>
      <Text style={styles.h1}>Home</Text>
      {loading ? (
        <SkeletonList />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.h2}>{title}</Text>
          )}
          renderItem={({ item, section }) => (
            <Pressable
              onPress={() => openTrip(item.id)}
              style={styles.cardPress}
            >
              <Card>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.status === "FINALIZED" ? "Finalized" : "Draft"}
                  {item.isPublic ? " · Public" : ""}
                  {section.title === "Community" && item.user
                    ? ` · ${item.user.name || "Traveler"}`
                    : ""}
                </Text>
                {section.title === "Your trips" && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => openPlanner(item.id)}
                      style={styles.smallBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.smallBtnText}>Open map</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No itineraries yet. Use the Planner tab to create one.
            </Text>
          }
        />
      )}
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
  h2: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  cardPress: { marginBottom: 12 },
  cardTitle: { fontSize: typography.subtitle, fontWeight: "700", color: colors.text },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: typography.caption },
  actions: { flexDirection: "row", marginTop: 12 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryMuted,
    borderRadius: 8,
  },
  smallBtnText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
});
