import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { StackScreenProps } from "@react-navigation/stack";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useRouteContext } from "../context/RouteContext";
import type { RootStackParamList } from "../navigation/types";
import { getApiBase } from "../lib/apiBase";
import { STRINGS } from "../shared/constants/strings";
import {
  deleteUnfinalize,
  deleteUnpublish,
  postFinalize,
  postPublish,
} from "../services/backend/collaboration";
import { deleteTripRemote, fetchTrip } from "../services/backend/trips";
import type { TripWaypoint } from "../services/backend/trips";

type TripPayload = {
  id: string;
  name: string;
  status: string;
  isPublic: boolean;
  shareId: string;
  waypoints: TripWaypoint[];
};

function asTripPayload(data: unknown): TripPayload | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.name !== "string" || typeof o.shareId !== "string" || !Array.isArray(o.waypoints)) {
    return null;
  }
  return {
    id: typeof o.id === "string" ? o.id : "",
    name: o.name,
    status: typeof o.status === "string" ? o.status : "DRAFT",
    isPublic: o.isPublic === true,
    shareId: o.shareId,
    waypoints: o.waypoints as TripWaypoint[],
  };
}

type Props = StackScreenProps<RootStackParamList, "TripDetail">;

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const { dispatch } = useRouteContext();
  const [trip, setTrip] = React.useState<TripPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const raw = await fetchTrip(tripId);
      setTrip(asTripPayload(raw));
    } catch {
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  const onPreviewRoute = React.useCallback(() => {
    if (!trip?.waypoints?.length) {
      setActionError(STRINGS.tripNeedTwoStops);
      return;
    }
    const ordered = [...trip.waypoints].sort((a, b) => a.order - b.order);
    if (ordered.length < 2) {
      setActionError(STRINGS.tripNeedTwoStops);
      return;
    }
    setActionError(null);
    dispatch({
      type: "LOAD_TRIP_WAYPOINTS",
      payload: ordered.map((w) => ({
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        order: w.order,
      })),
    });
    navigation.navigate("RoutePreview");
  }, [dispatch, navigation, trip]);

  const onShare = React.useCallback(async () => {
    if (!trip) {
      return;
    }
    const url = `${getApiBase()}/share/${trip.shareId}`;
    try {
      await Share.share({ message: url, title: trip.name });
    } catch {
      setActionError(STRINGS.commonError);
    }
  }, [trip]);

  const runFinalize = React.useCallback(async () => {
    try {
      await postFinalize(tripId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : STRINGS.commonError);
    }
  }, [load, tripId]);

  const runReopen = React.useCallback(async () => {
    try {
      await deleteUnfinalize(tripId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : STRINGS.commonError);
    }
  }, [load, tripId]);

  const runPublish = React.useCallback(async () => {
    try {
      await postPublish(tripId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : STRINGS.commonError);
    }
  }, [load, tripId]);

  const runUnpublish = React.useCallback(async () => {
    try {
      await deleteUnpublish(tripId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : STRINGS.commonError);
    }
  }, [load, tripId]);

  const runDelete = React.useCallback(() => {
    Alert.alert(STRINGS.tripDelete, STRINGS.tripDeleteConfirm, [
      { text: STRINGS.tripsCreateCancel, style: "cancel" },
      {
        text: STRINGS.tripDelete,
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteTripRemote(tripId);
              navigation.goBack();
            } catch (e) {
              setActionError(e instanceof Error ? e.message : STRINGS.commonError);
            }
          })();
        },
      },
    ]);
  }, [navigation, tripId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton rows={8} rowHeight={48} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{STRINGS.tripLoadError}</Text>
      </View>
    );
  }

  const isFinalized = trip.status === "FINALIZED";
  const sorted = [...trip.waypoints].sort((a, b) => a.order - b.order);
  const canPreviewRoute = sorted.length >= 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{trip.name}</Text>
      <Text style={styles.meta}>
        {isFinalized ? STRINGS.tripStatusFinalized : STRINGS.tripStatusDraft}
        {" · "}
        {trip.isPublic ? STRINGS.tripPublic : STRINGS.tripPrivate}
      </Text>
      {actionError ? <Text style={styles.banner}>{actionError}</Text> : null}

      <Text style={styles.section}>{STRINGS.tripWaypoints}</Text>
      {sorted.map((w, idx) => (
        <Text key={w.id} style={styles.waypointRow}>
          {idx + 1}. {w.name}
        </Text>
      ))}

      <Pressable
        style={[styles.primaryBtn, !canPreviewRoute ? styles.primaryBtnDisabled : null]}
        onPress={onPreviewRoute}
        disabled={!canPreviewRoute}
      >
        <Text style={styles.primaryBtnText}>{STRINGS.tripRoutePreview}</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={onShare}>
        <Text style={styles.secondaryBtnText}>{STRINGS.tripShare}</Text>
      </Pressable>

      {!isFinalized ? (
        <Pressable style={styles.secondaryBtn} onPress={() => void runFinalize()}>
          <Text style={styles.secondaryBtnText}>{STRINGS.tripFinalize}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.secondaryBtn} onPress={() => void runReopen()}>
          <Text style={styles.secondaryBtnText}>{STRINGS.tripReopen}</Text>
        </Pressable>
      )}

      {!trip.isPublic ? (
        <Pressable style={styles.secondaryBtn} onPress={() => void runPublish()}>
          <Text style={styles.secondaryBtnText}>{STRINGS.tripPublish}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.secondaryBtn} onPress={() => void runUnpublish()}>
          <Text style={styles.secondaryBtnText}>{STRINGS.tripUnpublish}</Text>
        </Pressable>
      )}

      <Pressable style={styles.dangerBtn} onPress={runDelete}>
        <Text style={styles.dangerBtnText}>{STRINGS.tripDelete}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#202124" },
  meta: { fontSize: 14, color: "#5F6368", marginTop: 6 },
  banner: { marginTop: 12, color: "#EA4335", fontSize: 14 },
  section: { fontSize: 16, fontWeight: "600", color: "#202124", marginTop: 20, marginBottom: 8 },
  waypointRow: { fontSize: 14, color: "#5F6368", marginBottom: 6 },
  primaryBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#9AA0A6" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EAED",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: { color: "#1A73E8", fontSize: 15, fontWeight: "600" },
  dangerBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE8E6",
  },
  dangerBtnText: { color: "#EA4335", fontSize: 15, fontWeight: "600" },
  error: { padding: 16, fontSize: 15, color: "#5F6368" },
});
