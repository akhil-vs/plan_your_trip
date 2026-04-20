export type HomeTabsParamList = {
  Home: undefined;
  Trips: undefined;
  SavedRoutes: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Search: undefined;
  RoutePreview: undefined;
  TripDetail: { tripId: string };
};
