import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { colors } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { useAuthStore } from "../store/authStore";
import type { RootStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PlannerScreen } from "../screens/PlannerScreen";
import { TripDetailScreen } from "../screens/TripDetailScreen";
import { PricingScreen } from "../screens/PricingScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { InviteScreen } from "../screens/InviteScreen";
import { ShareTripScreen } from "../screens/ShareTripScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const linking = {
  prefixes: [Linking.createURL("/"), "viazo://"],
  config: {
    screens: {
      [routeNames.Main]: {
        screens: {
          [routeNames.Home]: "home",
          [routeNames.PlannerTab]: "planner",
          [routeNames.Profile]: "profile",
        },
      },
      [routeNames.Invite]: "invite/:token",
      [routeNames.ShareTrip]: "share/:shareId",
    },
  },
};

function initialRouteName(user: ReturnType<typeof useAuthStore.getState>["user"]) {
  if (!user) return routeNames.Login;
  if (user.onboardingComplete === false) return routeNames.Onboarding;
  return routeNames.Main;
}

export function RootNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      onReady={() => {
        const name = initialRouteName(useAuthStore.getState().user);
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name }] })
        );
      }}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRouteName(user)}
      >
        <Stack.Screen name={routeNames.Login} component={LoginScreen} />
        <Stack.Screen name={routeNames.Register} component={RegisterScreen} />
        <Stack.Screen name={routeNames.Onboarding} component={OnboardingScreen} />
        <Stack.Screen name={routeNames.Main} component={MainTabs} />
        <Stack.Screen name={routeNames.PlannerTrip} component={PlannerScreen} />
        <Stack.Screen name={routeNames.TripDetail} component={TripDetailScreen} />
        <Stack.Screen name={routeNames.Pricing} component={PricingScreen} />
        <Stack.Screen name={routeNames.Admin} component={AdminScreen} />
        <Stack.Screen name={routeNames.Invite} component={InviteScreen} />
        <Stack.Screen name={routeNames.ShareTrip} component={ShareTripScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
