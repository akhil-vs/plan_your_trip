import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";
import { colors, radius, space, type } from "@/theme/tokens";

const prefs = [
  { id: "solo" as const, label: "Solo", hint: "Just me" },
  { id: "couple" as const, label: "Couple", hint: "Two travelers" },
  { id: "family" as const, label: "Family", hint: "Kids & adults" },
  { id: "group" as const, label: "Group", hint: "Friends or team" },
];

export default function OnboardingScreen() {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [destinationName, setDestinationName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [travelPreference, setTravelPreference] = useState<(typeof prefs)[number]["id"]>("solo");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!destinationName.trim() || !Number.isFinite(latN) || !Number.isFinite(lngN)) {
      Alert.alert("Check your details", "Enter a destination name and valid latitude / longitude.");
      return;
    }
    try {
      setPending(true);
      const result = await api.onboardingComplete({
        destinationName: destinationName.trim(),
        lat: latN,
        lng: lngN,
        travelPreference,
      });
      await refreshUser();
      router.replace(`/planner/${result.tripId}`);
    } catch (error) {
      Alert.alert("Onboarding failed", error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  const skip = async () => {
    try {
      setPending(true);
      await api.onboardingSkip();
      await refreshUser();
      router.replace("/trips");
    } catch (error) {
      Alert.alert("Skip failed", error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AppScreen scroll>
      <Text style={type.overline}>Get started</Text>
      <Text style={[type.title, styles.title]}>Plan your first trip</Text>
      <Text style={[type.caption, styles.lead]}>
        We will create a starter itinerary around your destination. You can refine everything in the planner.
      </Text>

      <SurfaceCard style={styles.card}>
        <TextField label="Destination" placeholder="e.g. Lisbon" value={destinationName} onChangeText={setDestinationName} />
        <View style={styles.coordRow}>
          <View style={styles.coordHalf}>
            <TextField label="Latitude" placeholder="38.72" keyboardType="decimal-pad" value={lat} onChangeText={setLat} />
          </View>
          <View style={styles.coordHalf}>
            <TextField label="Longitude" placeholder="-9.14" keyboardType="decimal-pad" value={lng} onChangeText={setLng} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Who is traveling?</Text>
        <View style={styles.chips}>
          {prefs.map((p) => {
            const active = travelPreference === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setTravelPreference(p.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>{p.label}</Text>
                <Text style={[styles.chipHint, active && styles.chipHintActive]}>{p.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label="Create starter trip" loading={pending} onPress={() => void submit()} />
        <PrimaryButton label="Skip for now" variant="ghost" disabled={pending} onPress={() => void skip()} />
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.xs, marginBottom: space.sm },
  lead: { color: colors.textSecondary, marginBottom: space.lg, maxWidth: 340 },
  card: { gap: space.lg },
  coordRow: { flexDirection: "row", gap: space.md },
  coordHalf: { flex: 1 },
  fieldLabel: { ...type.caption, fontWeight: "600", color: colors.textSecondary, marginBottom: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexGrow: 1,
    minWidth: "44%",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brandPrimary, backgroundColor: "#eff6ff" },
  chipTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  chipTitleActive: { color: colors.brandPrimary },
  chipHint: { ...type.caption, marginTop: 2 },
  chipHintActive: { color: colors.brandPrimary },
});
