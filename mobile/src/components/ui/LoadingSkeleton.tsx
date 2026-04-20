import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type LoadingSkeletonProps = {
  rows?: number;
  rowHeight?: number;
};

export function LoadingSkeleton({ rows = 3, rowHeight = 48 }: LoadingSkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0.45, 0.95]);
    return { opacity };
  });

  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View key={`skeleton-${index}`} style={[styles.row, { height: rowHeight }, animatedStyle]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  row: {
    borderRadius: 10,
    backgroundColor: "#E8EAED",
    marginBottom: 10,
  },
});
