import { useCallback, useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

type PermissionStatus = "unknown" | "granted" | "denied";

export function useUserLocation() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unknown");
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== "android") {
      setPermissionStatus("granted");
      return true;
    }

    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      setPermissionStatus(granted ? "granted" : "denied");
      setError(null);
      return granted;
    } catch (_err) {
      setPermissionStatus("denied");
      setError("Failed to request location permission.");
      return false;
    }
  }, []);

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  return {
    hasPermission: permissionStatus === "granted",
    permissionStatus,
    error,
    requestPermission,
  };
}
