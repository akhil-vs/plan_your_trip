import React from "react";
import { Keyboard, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PlaceAutocomplete } from "../components/search/PlaceAutocomplete";
import { WaypointList } from "../components/search/WaypointList";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useRouteContext } from "../context/RouteContext";
import { useMapboxGeocoding } from "../hooks/useMapboxGeocoding";
import { RootStackParamList } from "../navigation/types";
import { STRINGS } from "../shared/constants/strings";
import { PlaceSuggestion } from "../shared/types/place.types";
import { StackNavigationProp } from "@react-navigation/stack";

export function SearchScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Search">>();
  const { dispatch, state } = useRouteContext();
  const [originText, setOriginText] = React.useState("");
  const [destinationText, setDestinationText] = React.useState("");
  const [activeField, setActiveField] = React.useState<"origin" | "destination" | "waypoint">("destination");
  const [activeWaypointId, setActiveWaypointId] = React.useState<string | null>(null);
  const { results, isLoading, error, searchPlaces } = useMapboxGeocoding();

  React.useEffect(() => {
    setOriginText(state.origin?.name ?? "");
    setDestinationText(state.destination?.name ?? "");
  }, [state.destination?.name, state.origin?.name]);

  const handleOriginChange = React.useCallback(
    (value: string) => {
      setOriginText(value);
      setActiveField("origin");
      searchPlaces(value);
    },
    [searchPlaces],
  );

  const handleDestinationChange = React.useCallback(
    (value: string) => {
      setDestinationText(value);
      setActiveField("destination");
      searchPlaces(value);
    },
    [searchPlaces],
  );

  const handleSelectPlace = React.useCallback(
    (place: PlaceSuggestion) => {
      let nextOrigin = state.origin;
      let nextDestination = state.destination;

      if (activeField === "origin") {
        setOriginText(place.name);
        nextOrigin = { name: place.name, coords: place.coords };
        dispatch({ type: "SET_ORIGIN", payload: nextOrigin });
      } else if (activeField === "destination") {
        setDestinationText(place.name);
        nextDestination = { name: place.name, coords: place.coords };
        dispatch({ type: "SET_DESTINATION", payload: nextDestination });
      } else if (activeWaypointId) {
        dispatch({
          type: "UPDATE_WAYPOINT",
          payload: { id: activeWaypointId, name: place.name, coords: place.coords },
        });
      }

      Keyboard.dismiss();

      if (nextOrigin && nextDestination) {
        navigation.navigate("RoutePreview");
      }
    },
    [activeField, activeWaypointId, dispatch, navigation, state.destination, state.origin],
  );

  const handleAddWaypoint = React.useCallback(() => {
    const id = `wpt-${Date.now()}`;
    dispatch({ type: "ADD_WAYPOINT", payload: { id, name: STRINGS.waypointPlaceholder, coords: [0, 0] } });
    setActiveField("waypoint");
    setActiveWaypointId(id);
  }, [dispatch]);

  const handleSelectWaypoint = React.useCallback((id: string) => {
    setActiveField("waypoint");
    setActiveWaypointId(id);
  }, []);

  const handleRemoveWaypoint = React.useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_WAYPOINT", payload: id });
      if (activeWaypointId === id) {
        setActiveWaypointId(null);
        setActiveField("destination");
      }
    },
    [activeWaypointId, dispatch],
  );

  const handleReorderWaypoints = React.useCallback(
    (data: typeof state.waypoints) => {
      dispatch({ type: "REORDER_WAYPOINTS", payload: data });
    },
    [dispatch],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={styles.topArea}>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.dotBlue} />
          <TextInput
            value={originText}
            onChangeText={handleOriginChange}
            onFocus={() => {
              setActiveField("origin");
              setActiveWaypointId(null);
            }}
            placeholder={STRINGS.chooseStartingPoint}
            placeholderTextColor="#9AA0A6"
            style={styles.input}
          />
          <TouchableOpacity style={styles.plusButton} onPress={handleAddWaypoint}>
            <Text style={styles.plusText}>+</Text>
          </TouchableOpacity>
        </View>
        <WaypointList
          waypoints={state.waypoints}
          activeWaypointId={activeWaypointId}
          onSelectWaypoint={handleSelectWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          onReorderWaypoints={handleReorderWaypoints}
        />
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.redPin} />
          <TextInput
            value={destinationText}
            onChangeText={handleDestinationChange}
            onFocus={() => {
              setActiveField("destination");
              setActiveWaypointId(null);
            }}
            placeholder={STRINGS.chooseDestination}
            placeholderTextColor="#9AA0A6"
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.listArea}>
        <PlaceAutocomplete data={results} onSelect={handleSelectPlace} />
        {isLoading ? <LoadingSkeleton rows={4} rowHeight={42} /> : null}
        {error ? <Text style={styles.helperText}>{error}</Text> : null}
        {state.error ? <Text style={styles.helperText}>{state.error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  topArea: { backgroundColor: "#FFFFFF", paddingTop: StatusBar.currentHeight ?? 0, paddingHorizontal: 12 },
  row: { height: 48, flexDirection: "row", alignItems: "center" },
  backButton: { width: 32, alignItems: "center", justifyContent: "center", marginRight: 8 },
  backText: { fontSize: 22, color: "#202124" },
  dotBlue: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A73E8", marginHorizontal: 8 },
  redPin: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EA4335", marginHorizontal: 8 },
  input: { flex: 1, fontSize: 16, color: "#202124" },
  plusButton: { width: 32, alignItems: "center", justifyContent: "center" },
  plusText: { fontSize: 20, color: "#5F6368" },
  separator: { height: 0.5, backgroundColor: "#E8EAED", marginLeft: 48 },
  listArea: { flex: 1 },
  helperText: { fontSize: 12, color: "#5F6368", paddingHorizontal: 16, paddingVertical: 4 },
});
