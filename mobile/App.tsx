import React from "react";
import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RouteDirectionsSync } from "./src/components/RouteDirectionsSync";
import { AuthProvider } from "./src/context/AuthContext";
import { RouteProvider } from "./src/context/RouteContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaProvider>
        <AuthProvider>
          <RouteProvider>
            <RouteDirectionsSync />
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </RouteProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
