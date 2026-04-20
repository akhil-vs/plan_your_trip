import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";
import { colors, shadows } from "../../constants/theme";

const { height } = Dimensions.get("window");
const snapPercents = [0.2, 0.5, 0.9];

interface Props {
  snapIndex: number;
  setSnapIndex: (index: number) => void;
  animatedSnap: SharedValue<number>;
  children: React.ReactNode;
}

export function PlannerBottomSheet({ snapIndex, setSnapIndex, animatedSnap, children }: Props) {
  const top = useSharedValue(height * (1 - snapPercents[snapIndex]));

  React.useEffect(() => {
    top.value = withSpring(height * (1 - snapPercents[snapIndex]), { damping: 18, stiffness: 170 });
    animatedSnap.value = snapIndex;
  }, [snapIndex, top, animatedSnap]);

  const style = useAnimatedStyle(() => ({ top: top.value }));

  return (
    <PanGestureHandler
      onEnded={(event) => {
        const translationY = (event.nativeEvent as { translationY?: number }).translationY ?? 0;
        if (translationY < -60) {
          setSnapIndex(Math.min(2, snapIndex + 1));
        } else if (translationY > 60) {
          setSnapIndex(Math.max(0, snapIndex - 1));
        }
      }}
    >
      <Animated.View style={[styles.wrap, style, shadows.card]}>
        <Animated.View style={styles.handle} />
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 16,
    minHeight: 180,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: colors.border,
  },
});
