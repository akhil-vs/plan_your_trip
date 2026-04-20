import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/theme";
import type { WaypointData } from "../../store/tripStore";
import { StopCard } from "./StopCard";

interface Props {
  waypoints: WaypointData[];
  canAddStop: boolean;
  onAddStop: () => void;
  onRemoveStop: (id: string) => void;
  onEditStopName: (id: string, name: string) => void;
  onMoveStopUp: (index: number) => void;
  onMoveStopDown: (index: number) => void;
}

export function RoutePlannerStack({
  waypoints,
  canAddStop,
  onAddStop,
  onRemoveStop,
  onEditStopName,
  onMoveStopUp,
  onMoveStopDown,
}: Props) {
  return (
    <View style={styles.wrap}>
      {waypoints.map((item, index) => (
        <StopCard
          key={item.id}
          item={item}
          index={index}
          onEditName={onEditStopName}
          onMoveUp={onMoveStopUp}
          onMoveDown={onMoveStopDown}
          onRemove={onRemoveStop}
        />
      ))}
      <Pressable onPress={onAddStop} disabled={!canAddStop} style={[styles.add, !canAddStop && styles.addOff]}>
        <Text style={styles.addText}>+ Add stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  add: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    alignItems: "center",
  },
  addOff: { opacity: 0.45 },
  addText: { color: colors.primary, fontWeight: "700" },
});
