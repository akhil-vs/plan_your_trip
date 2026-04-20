import { NavigatorScreenParams } from "@react-navigation/native";
import { routeNames } from "../constants/routes";

export type MainTabParamList = {
  [routeNames.Home]: undefined;
  [routeNames.PlannerTab]: undefined;
  [routeNames.Profile]: undefined;
};

export type RootStackParamList = {
  [routeNames.Login]: undefined;
  [routeNames.Register]: undefined;
  [routeNames.Onboarding]: undefined;
  [routeNames.Main]: NavigatorScreenParams<MainTabParamList>;
  [routeNames.PlannerTrip]: { tripId: string };
  [routeNames.TripDetail]: { tripId: string };
  [routeNames.Pricing]: undefined;
  [routeNames.Admin]: undefined;
  [routeNames.Invite]: { token: string };
  [routeNames.ShareTrip]: { shareId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
