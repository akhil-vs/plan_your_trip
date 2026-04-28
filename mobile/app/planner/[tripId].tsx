import { Stack, useLocalSearchParams } from "expo-router";
import { TripPlannerScreen } from "@/features/planner/trip-planner-screen";

export default function PlannerRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TripPlannerScreen tripId={tripId} />
    </>
  );
}
