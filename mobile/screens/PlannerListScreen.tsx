import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { SkeletonList } from "../components/SkeletonList";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { createTrip, deleteTrip, fetchTrips, type TripSummary } from "../services/trips";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PlannerListScreen() {
  const navigation = useNavigation<Nav>();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTrips();
      setTrips(data.myTrips ?? []);
    } catch {
      setTrips([]);
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

  async function onCreate() {
    setCreating(true);
    try {
      const trip = (await createTrip({
        name: "New trip",
        waypoints: [],
        dayPlans: [],
      })) as { id?: string };
      if (trip?.id) {
        navigation.getParent()?.navigate(routeNames.PlannerTrip, { tripId: trip.id });
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "Could not create trip",
      });
    } finally {
      setCreating(false);
    }
  }

  function confirmDelete(trip: TripSummary) {
    Alert.alert("Delete trip", `Delete “${trip.name}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTrip(trip.id);
            await load();
          } catch (e) {
            Toast.show({
              type: "error",
              text1: e instanceof Error ? e.message : "Delete failed",
            });
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text style={styles.h1}>Planner</Text>
      <Button title="New itinerary" onPress={onCreate} loading={creating} />
      {loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          style={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
          }
          renderItem={({ item }) => (
            <Card>
              <Pressable
                onPress={() =>
                  navigation.getParent()?.navigate(routeNames.PlannerTrip, {
                    tripId: item.id,
                  })
                }
              >
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>{item.status}</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                style={styles.danger}
                accessibilityRole="button"
              >
                <Text style={styles.dangerText}>Delete</Text>
              </Pressable>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Create a trip to start planning routes.</Text>
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
    marginBottom: 12,
  },
  list: { marginTop: 16 },
  title: { fontSize: typography.subtitle, fontWeight: "700", color: colors.text },
  meta: { color: colors.textSecondary, marginTop: 4 },
  danger: { marginTop: 12, alignSelf: "flex-start" },
  dangerText: { color: colors.error, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
});
