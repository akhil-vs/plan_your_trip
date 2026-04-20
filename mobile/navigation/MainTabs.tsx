import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../constants/theme";
import { routeNames } from "../constants/routes";
import type { MainTabParamList } from "./types";
import { DashboardScreen } from "../screens/DashboardScreen";
import { PlannerListScreen } from "../screens/PlannerListScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name={routeNames.Home}
        component={DashboardScreen}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name={routeNames.PlannerTab}
        component={PlannerListScreen}
        options={{ tabBarLabel: "Planner" }}
      />
      <Tab.Screen
        name={routeNames.Profile}
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
}
