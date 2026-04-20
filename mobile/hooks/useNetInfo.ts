import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  return offline;
}
