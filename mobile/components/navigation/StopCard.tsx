import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, shadows } from "../../constants/theme";
import type { WaypointData } from "../../store/tripStore";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

interface Props {
  item: WaypointData;
  index: number;
  onEditName: (id: string, name: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
}

export function StopCard({ item, index, onEditName, onMoveUp, onMoveDown, onRemove }: Props) {
  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <PanGestureHandler
      onGestureEvent={(event) => {
        const tx = (event.nativeEvent as { translationX?: number }).translationX ?? 0;
        translateX.value = tx;
      }}
      onEnded={(event) => {
        const tx = (event.nativeEvent as { translationX?: number; translationY?: number }).translationX ?? 0;
        const ty = (event.nativeEvent as { translationX?: number; translationY?: number }).translationY ?? 0;
        if (tx < -90) {
          onRemove(item.id);
        } else if (ty < -50) {
          onMoveUp(index);
        } else if (ty > 50) {
          onMoveDown(index);
        }
        translateX.value = withSpring(0);
      }}
    >
      <Animated.View style={[styles.card, shadows.card, animatedStyle]}>
        <View style={styles.header}>
          <Text style={styles.drag}>≡</Text>
          <Text style={styles.role}>{item.role ?? "stop"}</Text>
          <Pressable onPress={() => onMoveUp(index)} hitSlop={8}>
            <Text style={styles.control}>↑</Text>
          </Pressable>
          <Pressable onPress={() => onMoveDown(index)} hitSlop={8}>
            <Text style={styles.control}>↓</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
            <Text style={styles.delete}>✕</Text>
          </Pressable>
        </View>
        <TextInput
          value={item.name}
          onChangeText={(v) => onEditName(item.id, v)}
          style={styles.input}
          placeholder="Location"
          placeholderTextColor={colors.textSecondary}
        />
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  drag: { color: colors.textSecondary, fontSize: 16 },
  role: { flex: 1, color: colors.textSecondary, textTransform: "capitalize", fontSize: 12 },
  control: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  delete: { color: "#d93025", fontWeight: "700", fontSize: 14 },
  input: {
    backgroundColor: colors.card ?? "#F8F9FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    minHeight: 40,
    color: colors.text,
  },
});
