import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

export function usePlannerBottomSheet(snapIndex: number, onPaddingChange: (paddingBottom: number) => void) {
  const snapProgress = useSharedValue(snapIndex);

  useEffect(() => {
    snapProgress.value = withTiming(snapIndex, { duration: 220 });
    onPaddingChange([160, 300, 520][snapIndex] ?? 220);
  }, [snapIndex, onPaddingChange, snapProgress]);

  return { snapProgress };
}
