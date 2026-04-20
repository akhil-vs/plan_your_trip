import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RouteStep } from "../../shared/types/route.types";

type DirectionStepRowProps = {
  step: RouteStep;
};

function formatStepDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export const DirectionStepRow = memo(function DirectionStepRow({ step }: DirectionStepRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.bullet} />
      <View style={styles.content}>
        <Text style={styles.instruction}>{step.instruction}</Text>
        <Text style={styles.meta}>{formatStepDistance(step.distance)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingVertical: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A73E8", marginTop: 5, marginRight: 10 },
  content: { flex: 1 },
  instruction: { fontSize: 14, fontWeight: "500", color: "#202124" },
  meta: { marginTop: 2, fontSize: 13, color: "#5F6368" },
});
