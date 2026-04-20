import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { STRINGS } from "../../shared/constants/strings";
import { RouteWaypoint } from "../../shared/types/route.types";

type WaypointListProps = {
  waypoints: RouteWaypoint[];
  activeWaypointId: string | null;
  onSelectWaypoint: (id: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onReorderWaypoints: (data: RouteWaypoint[]) => void;
};

export function WaypointList({
  waypoints,
  activeWaypointId,
  onSelectWaypoint,
  onRemoveWaypoint,
  onReorderWaypoints,
}: WaypointListProps) {
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<RouteWaypoint>) => (
      <Pressable
        onLongPress={drag}
        onPress={() => onSelectWaypoint(item.id)}
        style={[styles.row, isActive ? styles.rowActive : null, activeWaypointId === item.id ? styles.rowSelected : null]}
      >
        <Text style={styles.dragIcon}>{STRINGS.waypointDragHandle}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || STRINGS.waypointPlaceholder}
        </Text>
        <Pressable onPress={() => onRemoveWaypoint(item.id)} hitSlop={8}>
          <Text style={styles.removeIcon}>{STRINGS.waypointRemove}</Text>
        </Pressable>
      </Pressable>
    ),
    [activeWaypointId, onRemoveWaypoint, onSelectWaypoint],
  );

  if (!waypoints.length) {
    return null;
  }

  return (
    <DraggableFlatList
      data={waypoints}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onDragEnd={({ data }) => onReorderWaypoints(data)}
      scrollEnabled={false}
      activationDistance={8}
      containerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 200 },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  rowActive: { opacity: 0.85 },
  rowSelected: { backgroundColor: "#F8F9FA" },
  dragIcon: { width: 24, fontSize: 16, color: "#5F6368", textAlign: "center" },
  name: { flex: 1, marginLeft: 8, fontSize: 14, color: "#202124" },
  removeIcon: { width: 24, fontSize: 16, color: "#5F6368", textAlign: "center" },
  separator: { height: 0.5, backgroundColor: "#E8EAED", marginLeft: 40 },
});
