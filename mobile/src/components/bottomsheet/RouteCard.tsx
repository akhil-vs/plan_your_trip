import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRINGS } from "../../shared/constants/strings";

type RouteCardProps = {
  etaText: string;
  distanceText: string;
  selected: boolean;
  onPress: () => void;
};

export const RouteCard = memo(function RouteCard({ etaText, distanceText, selected, onPress }: RouteCardProps) {
  return (
    <Pressable style={[styles.card, selected ? styles.cardSelected : null]} onPress={onPress}>
      <Text style={styles.eta}>{etaText}</Text>
      <Text style={styles.distance}>{distanceText}</Text>
      <Text style={styles.via}>{STRINGS.routeViaLabel}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8EAED",
    padding: 12,
    marginRight: 10,
    backgroundColor: "#FFFFFF",
  },
  cardSelected: { borderColor: "#1A73E8", borderWidth: 2 },
  eta: { fontSize: 22, fontWeight: "700", color: "#202124" },
  distance: { marginTop: 4, fontSize: 13, color: "#5F6368" },
  via: { marginTop: 4, fontSize: 12, color: "#5F6368", fontStyle: "italic" },
});
