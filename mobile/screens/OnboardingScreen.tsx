import { useEffect, useState } from "react";
import { CommonActions, useNavigation } from "@react-navigation/native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Screen } from "../components/Screen";
import { colors, typography } from "../constants/theme";
import { routeNames } from "../constants/routes";
import { completeOnboarding, skipOnboarding } from "../services/onboarding";
import { useAuthStore } from "../store/authStore";

const PREFS = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "family", label: "Family" },
  { id: "group", label: "Group" },
] as const;

export function OnboardingScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [destinationName, setDestinationName] = useState("");
  const [lat, setLat] = useState("48.8566");
  const [lng, setLng] = useState("2.3522");
  const [preference, setPreference] =
    useState<(typeof PREFS)[number]["id"]>("solo");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: routeNames.Main }] })
      );
    }
  }, [user?.onboardingComplete, navigation, user]);

  async function onFinish() {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!destinationName.trim() || !Number.isFinite(latN) || !Number.isFinite(lngN)) {
      Toast.show({ type: "error", text1: "Enter a destination name and valid coordinates" });
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding({
        destinationName: destinationName.trim(),
        lat: latN,
        lng: lngN,
        travelPreference: preference,
      });
      await refreshUser();
      Toast.show({ type: "success", text1: "Trip created" });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSkip() {
    setBusy(true);
    try {
      await skipOnboarding();
      await refreshUser();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "Skip failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.sub}>
            Set a first destination (or skip). You can refine this later on the map.
          </Text>
          <Input
            label="Destination name"
            value={destinationName}
            onChangeText={setDestinationName}
            placeholder="Paris, France"
          />
          <Input label="Latitude" value={lat} onChangeText={setLat} keyboardType="default" />
          <Input label="Longitude" value={lng} onChangeText={setLng} keyboardType="default" />
          <Text style={styles.label}>Travel style</Text>
          <View style={styles.chips}>
            {PREFS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPreference(p.id)}
                style={[
                  styles.chip,
                  preference === p.id && styles.chipOn,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    preference === p.id && styles.chipTextOn,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button title="Create starter trip" onPress={onFinish} loading={busy} />
          <Button title="Skip for now" variant="ghost" onPress={onSkip} disabled={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: {
    fontSize: typography.title + 2,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  sub: { color: colors.textSecondary, marginBottom: 20 },
  label: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextOn: { color: colors.primary },
});
