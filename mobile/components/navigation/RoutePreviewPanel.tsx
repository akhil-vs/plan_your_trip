import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/theme";

interface Props {
  etaMinutes: number;
  distanceKm: number;
  stopsCount: number;
}

export function RoutePreviewPanel({ etaMinutes, distanceKm, stopsCount }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.item}>
        <Text style={styles.k}>ETA</Text>
        <Text style={styles.v}>{etaMinutes} min</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.k}>Distance</Text>
        <Text style={styles.v}>{distanceKm.toFixed(1)} km</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.k}>Stops</Text>
        <Text style={styles.v}>{stopsCount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 14,
    backgroundColor: colors.card ?? "#F8F9FA",
    padding: 12,
  },
  item: { flex: 1 },
  k: { color: colors.textSecondary, fontSize: 12 },
  v: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
});
