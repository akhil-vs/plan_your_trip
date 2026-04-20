import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth } from "../context/AuthContext";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { RoutePreviewScreen } from "../screens/RoutePreviewScreen";
import { SavedRoutesScreen } from "../screens/SavedRoutesScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { TripDetailScreen } from "../screens/TripDetailScreen";
import { TripsScreen } from "../screens/TripsScreen";
import { STRINGS } from "../shared/constants/strings";
import { HomeTabsParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<HomeTabsParamList>();
const Stack = createStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1A73E8",
        tabBarInactiveTintColor: "#5F6368",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: STRINGS.tabMap }} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ title: STRINGS.tabTrips }} />
      <Tab.Screen name="SavedRoutes" component={SavedRoutesScreen} options={{ title: STRINGS.tabSaved }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: STRINGS.tabProfile }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { state } = useAuth();

  if (!state.hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  if (!state.user) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: STRINGS.registerTitle }} />
      </Stack.Navigator>
    );
  }

  if (state.user.onboardingComplete === false) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: STRINGS.searchScreenTitle }} />
      <Stack.Screen name="RoutePreview" component={RoutePreviewScreen} options={{ title: "Route Preview" }} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: STRINGS.tripDetailTitle }} />
    </Stack.Navigator>
  );
}
