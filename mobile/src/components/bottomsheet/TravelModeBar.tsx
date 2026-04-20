import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRINGS } from "../../shared/constants/strings";
import { TravelMode } from "../../shared/types/route.types";

type TravelModeBarProps = {
  travelMode: TravelMode;
  onChange: (mode: TravelMode) => void;
};

const OPTIONS: Array<{ mode: TravelMode; icon: string; label: string }> = [
  { mode: "driving-traffic", icon: "🚗", label: STRINGS.travelModeDrive },
  { mode: "walking", icon: "🚶", label: STRINGS.travelModeWalk },
  { mode: "cycling", icon: "🚲", label: STRINGS.travelModeBike },
];

export const TravelModeBar = memo(function TravelModeBar({ travelMode, onChange }: TravelModeBarProps) {
  const renderOption = useCallback(
    (option: { mode: TravelMode; icon: string; label: string }) => {
      const active = option.mode === travelMode;
      return (
        <Pressable
          key={option.mode}
          style={[styles.tab, active ? styles.tabActive : null]}
          onPress={() => onChange(option.mode)}
        >
          <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
            {option.icon} {option.label}
          </Text>
        </Pressable>
      );
    },
    [onChange, travelMode],
  );

  return <View style={styles.container}>{OPTIONS.map(renderOption)}</View>;
});

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E8EAED" },
  tab: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#1A73E8" },
  tabText: { fontSize: 14, fontWeight: "500", color: "#5F6368" },
  tabTextActive: { color: "#1A73E8" },
});
