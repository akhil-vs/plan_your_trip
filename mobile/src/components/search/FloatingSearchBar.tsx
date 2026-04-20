import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { STRINGS } from "../../shared/constants/strings";

type FloatingSearchBarProps = {
  onPress?: () => void;
};

export function FloatingSearchBar({ onPress }: FloatingSearchBarProps) {
  const topInset = (StatusBar.currentHeight ?? 0) + 8;

  return (
    <Pressable style={[styles.container, { marginTop: topInset }]} onPress={onPress}>
      <View style={styles.leftContent}>
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.placeholder}>{STRINGS.searchPlaceholder}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{STRINGS.profileAvatarLabel.charAt(0)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    fontSize: 24,
    color: "#5F6368",
  },
  placeholder: {
    marginLeft: 12,
    fontSize: 16,
    color: "#9AA0A6",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A73E8",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
