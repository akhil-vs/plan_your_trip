import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../../constants/theme";

interface Props {
  value?: string;
  onPress: () => void;
  onVoicePress?: () => void;
}

export function FloatingSearchBar({ value, onPress, onVoicePress }: Props) {
  return (
    <Pressable style={styles.shell} onPress={onPress}>
      <Text style={styles.icon}>🔍</Text>
      <Text style={styles.placeholder} numberOfLines={1}>
        {value || "Search for places"}
      </Text>
      <Pressable onPress={onVoicePress} hitSlop={8} style={styles.voiceButton}>
        <Text style={styles.voice}>🎤</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 24,
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    flexDirection: "row",
    ...shadows.card,
  },
  icon: { fontSize: 18, color: colors.textSecondary, marginRight: 10 },
  placeholder: { flex: 1, color: colors.textSecondary, fontSize: 16 },
  voiceButton: { padding: 2 },
  voice: {
    color: colors.primary,
    fontSize: 14,
    width: 24,
    height: 24,
    borderRadius: radius.md,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
