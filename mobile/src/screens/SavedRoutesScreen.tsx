import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useRouteContext } from "../context/RouteContext";
import { deleteRoute, getSavedRoutes, saveRoute } from "../services/savedRoutes";
import { STRINGS } from "../shared/constants/strings";
import { SavedRoute } from "../shared/types/route.types";

function formatRouteMeta(distance: number, duration: number) {
  const kms = (distance / 1000).toFixed(1);
  const mins = Math.max(1, Math.round(duration / 60));
  return `${kms} km · ${mins} min`;
}

export function SavedRoutesScreen() {
  const { state } = useRouteContext();
  const [savedRoutes, setSavedRoutes] = React.useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadRoutes = React.useCallback(async () => {
    setIsLoading(true);
    const routes = await getSavedRoutes();
    setSavedRoutes(routes);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadRoutes();
    }, [loadRoutes]),
  );

  const handleDelete = React.useCallback(async (routeId: string) => {
    const updated = await deleteRoute(routeId);
    setSavedRoutes(updated);
  }, []);

  const handleSaveCurrent = React.useCallback(async () => {
    if (!state.route) {
      return;
    }

    const name = state.origin?.name && state.destination?.name
      ? `${state.origin.name}${STRINGS.savedRoutesNameSeparator}${state.destination.name}`
      : STRINGS.savedRoutesUnnamed;

    const routeToSave: SavedRoute = {
      id: `${Date.now()}`,
      name,
      distance: state.route.distance,
      duration: state.route.duration,
      createdAt: new Date().toISOString(),
    };

    const updated = await saveRoute(routeToSave);
    setSavedRoutes(updated);
  }, [state.destination?.name, state.origin?.name, state.route]);

  const renderRightActions = React.useCallback(
    (routeId: string) => (
      <Pressable style={styles.deleteAction} onPress={() => void handleDelete(routeId)}>
        <Text style={styles.deleteText}>🗑</Text>
      </Pressable>
    ),
    [handleDelete],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: SavedRoute }) => (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <View style={styles.card}>
          <View style={styles.thumbnail} />
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>{formatRouteMeta(item.distance, item.duration)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Swipeable>
    ),
    [renderRightActions],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.savedRoutesTitle}</Text>
      {isLoading ? <LoadingSkeleton rows={5} rowHeight={62} /> : null}
      <FlatList
        data={savedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={savedRoutes.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyState, isLoading ? styles.hidden : null]}>
            <View style={styles.emptyIllustration} />
            <Text style={styles.emptyText}>{STRINGS.savedRoutesEmpty}</Text>
          </View>
        }
      />
      <Pressable
        style={[styles.fab, !state.route ? styles.fabDisabled : null]}
        onPress={() => void handleSaveCurrent()}
        disabled={!state.route}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingTop: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#202124", paddingHorizontal: 16, paddingBottom: 8 },
  listContent: { paddingHorizontal: 12, paddingBottom: 96 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: 96 },
  card: { height: 72, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", paddingHorizontal: 8 },
  thumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#F1F3F4" },
  content: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: "700", color: "#202124" },
  meta: { marginTop: 4, fontSize: 13, color: "#5F6368" },
  chevron: { fontSize: 22, color: "#5F6368", paddingHorizontal: 8 },
  separator: { height: 0.5, backgroundColor: "#E8EAED", marginLeft: 68 },
  deleteAction: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EA4335",
    borderRadius: 8,
    marginVertical: 8,
  },
  deleteText: { fontSize: 20, color: "#FFFFFF" },
  emptyState: { alignItems: "center" },
  hidden: { opacity: 0 },
  emptyIllustration: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#F1F3F4", marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#5F6368" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  fabDisabled: { backgroundColor: "#9AA0A6" },
  fabIcon: { color: "#FFFFFF", fontSize: 24, lineHeight: 24 },
});
