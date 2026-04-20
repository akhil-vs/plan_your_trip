import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/theme";
import type { TransportMode, RoutePreviewMetric } from "../../store/tripStore";

interface Props {
  mode: TransportMode;
  previewByMode: Partial<Record<TransportMode, RoutePreviewMetric>>;
  onChangeMode: (mode: TransportMode) => void;
}

const modes: TransportMode[] = ["car", "bike", "walking", "transit"];

export function TransportModeChips({ mode, previewByMode, onChangeMode }: Props) {
  return (
    <View style={styles.row}>
      {modes.map((item) => {
        const active = item === mode;
        const metric = previewByMode[item];
        return (
          <Pressable
            key={item}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChangeMode(item)}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{item}</Text>
            {metric ? (
              <Text style={[styles.meta, active && styles.activeLabel]}>
                {metric.etaMinutes}m · {metric.distanceKm}km
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeChip: { borderColor: colors.primary, backgroundColor: "#E8F0FE" },
  label: { color: colors.text, textTransform: "capitalize", fontSize: 13, fontWeight: "600" },
  activeLabel: { color: colors.primary },
  meta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
