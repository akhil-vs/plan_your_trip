import { useEffect } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";

export function useNavigationAnimations(isNavigationMode: boolean) {
  const routePreviewOpacity = useSharedValue(0);
  const stackLift = useSharedValue(10);

  useEffect(() => {
    routePreviewOpacity.value = withSpring(isNavigationMode ? 1 : 0.92, {
      damping: 15,
      stiffness: 170,
    });
    stackLift.value = withSpring(isNavigationMode ? 0 : 10, { damping: 18, stiffness: 180 });
  }, [isNavigationMode, routePreviewOpacity, stackLift]);

  return { routePreviewOpacity, stackLift };
}
