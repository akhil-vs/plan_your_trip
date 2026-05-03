import { PropsWithChildren, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "plan-your-trip-query-cache-v1",
});

export function AppProvider({ children }: PropsWithChildren) {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: "v1",
          }}
        >
          {children}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
