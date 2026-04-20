import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AppMapView } from "../components/map/AppMapView";
import { FloatingSearchBar } from "../components/search/FloatingSearchBar";
import { useUserLocation } from "../hooks/useUserLocation";
import { RootStackParamList } from "../navigation/types";
import { STRINGS } from "../shared/constants/strings";

type HomeNavigationProp = StackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const { hasPermission, error } = useUserLocation();
  const navigation = useNavigation<HomeNavigationProp>();

  return (
    <View style={styles.container}>
      <AppMapView hasLocationPermission={hasPermission} />
      <FloatingSearchBar onPress={() => navigation.navigate("Search")} />
      {!hasPermission ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error ?? STRINGS.mapPermissionRequired}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(32,33,36,0.88)",
  },
  bannerText: { fontSize: 12, color: "#FFFFFF" },
});
