import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, shadows } from "../../constants/theme";

interface Props {
  following: boolean;
  onRecenter: () => void;
  onToggleFollow: () => void;
}

export function MapFloatingControls({ following, onRecenter, onToggleFollow }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.btn, shadows.card]}
        onPress={onRecenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter to my location"
      >
        <Text style={styles.txt}>◎</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, shadows.card]}
        onPress={onToggleFollow}
        accessibilityRole="switch"
        accessibilityLabel="Toggle live follow mode"
      >
        <Text style={[styles.txt, following && styles.on]}>{following ? "LIVE" : "OFF"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, bottom: 280, gap: 10 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  txt: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  on: { color: colors.primary },
});
