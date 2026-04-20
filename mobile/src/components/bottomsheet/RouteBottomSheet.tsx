import React, { useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouteContext } from "../../context/RouteContext";
import { STRINGS } from "../../shared/constants/strings";
import { RouteStep, TravelMode } from "../../shared/types/route.types";
import { DirectionStepRow } from "./DirectionStepRow";
import { RouteCard } from "./RouteCard";
import { TravelModeBar } from "./TravelModeBar";

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${totalMinutes} min`;
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function RouteBottomSheet() {
  const { state, dispatch } = useRouteContext();
  const [selectedOption] = useState("primary");
  const [stepsExpanded, setStepsExpanded] = useState(false);

  const handleTravelMode = useCallback(
    (mode: TravelMode) => {
      dispatch({ type: "SET_TRAVEL_MODE", payload: mode });
    },
    [dispatch],
  );

  const etaText = state.route ? formatDuration(state.route.duration) : "--";
  const distanceText = state.route ? formatDistance(state.route.distance) : "--";
  const steps = useMemo<RouteStep[]>(() => {
    if (!state.route?.legs) {
      return [];
    }
    return state.route.legs.flatMap((leg) =>
      (leg.steps ?? []).map((step) => ({
        distance: step.distance,
        duration: step.duration,
        instruction: step.maneuver?.instruction ?? "Continue straight",
      })),
    );
  }, [state.route]);

  const renderStep = useCallback(({ item }: { item: RouteStep }) => <DirectionStepRow step={item} />, []);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.content}>
        <TravelModeBar travelMode={state.travelMode} onChange={handleTravelMode} />
        {state.isLoading ? <Text style={styles.statusText}>{STRINGS.loading}</Text> : null}
        {!state.isLoading && state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          <RouteCard etaText={etaText} distanceText={distanceText} selected={selectedOption === "primary"} onPress={() => undefined} />
        </ScrollView>
        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startText}>{STRINGS.routeStart}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepsRow} onPress={() => setStepsExpanded((prev) => !prev)}>
          <Text style={styles.stepsText}>{stepsExpanded ? STRINGS.routeStepsExpanded : STRINGS.routeSteps}</Text>
        </TouchableOpacity>
        {stepsExpanded ? (
          <FlatList
            data={steps}
            keyExtractor={(_, index) => `step-${index}`}
            renderItem={renderStep}
            ItemSeparatorComponent={() => <View style={styles.stepSeparator} />}
            ListEmptyComponent={<Text style={styles.noSteps}>{STRINGS.routeNoSteps}</Text>}
            style={styles.stepsList}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#FFFFFF",
    minHeight: 120,
    maxHeight: "92%",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DADCE0",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  content: { flex: 1, backgroundColor: "#FFFFFF" },
  statusText: { fontSize: 13, color: "#5F6368", paddingHorizontal: 12, paddingTop: 8 },
  errorText: { fontSize: 13, color: "#EA4335", paddingHorizontal: 12, paddingTop: 8 },
  cardsRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  startButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: 12,
  },
  startText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  stepsRow: { paddingHorizontal: 12, paddingVertical: 12 },
  stepsText: { fontSize: 14, fontWeight: "500", color: "#202124" },
  stepsList: { maxHeight: 260 },
  stepSeparator: { height: 0.5, backgroundColor: "#E8EAED", marginLeft: 30 },
  noSteps: { paddingHorizontal: 12, paddingBottom: 12, fontSize: 13, color: "#5F6368" },
});
