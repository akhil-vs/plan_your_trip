import "@/lib/mapbox-init";
import { Stack } from "expo-router";
import { AppProvider } from "@/providers/app-provider";
import { initSentry } from "@/config/sentry";
import { colors } from "@/theme/tokens";

initSentry();

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="profile"
          options={{
            headerShown: true,
            title: "Account",
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.brandPrimary,
            headerTitleStyle: { fontWeight: "700", color: colors.text },
            headerBackTitle: "Trips",
          }}
        />
      </Stack>
    </AppProvider>
  );
}
