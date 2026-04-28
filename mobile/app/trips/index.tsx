import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/services/api";
import {
  buildCreateTripBody,
  DEFAULT_TRIP_NAME,
  STARTER_TEMPLATES,
  templateToWaypoints,
} from "@/lib/trip-payload";
import type { Trip } from "@/types/domain";
import { useAuthStore } from "@/stores/auth-store";
import { colors, radius, space, type } from "@/theme/tokens";

function TripRow({
  item,
  onOpen,
  onCollaboration,
}: {
  item: Trip;
  onOpen: () => void;
  onCollaboration: () => void;
}) {
  const status = item.status === "FINALIZED" ? "Finalized" : "Draft";
  const isFinal = item.status === "FINALIZED";
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onOpen}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta}>
          {item.waypoints.length} {item.waypoints.length === 1 ? "stop" : "stops"}
        </Text>
        <View style={styles.tripActions}>
          <Pressable style={styles.tripActionBtn} onPress={onOpen}>
            <Text style={styles.tripActionText}>Open planner</Text>
          </Pressable>
          <Pressable style={styles.tripActionBtn} onPress={onCollaboration}>
            <Text style={styles.tripActionText}>Members & chat</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.badge, isFinal ? styles.badgeFinal : styles.badgeDraft]}>
        <Text style={[styles.badgeText, isFinal ? styles.badgeTextFinal : styles.badgeTextDraft]}>{status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function TripsScreen() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["trips"],
    queryFn: api.trips,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [starterId, setStarterId] = useState<string | "blank">("blank");
  const [creating, setCreating] = useState(false);

  const openNewItineraryModal = () => {
    setNewName("");
    setStarterId("blank");
    setModalOpen(true);
  };

  const createItinerary = async () => {
    try {
      setCreating(true);
      const template = starterId === "blank" ? null : STARTER_TEMPLATES.find((t) => t.id === starterId);
      const waypoints = template ? templateToWaypoints(template) : [];
      const name = newName.trim() || DEFAULT_TRIP_NAME;
      const trip = await api.createTrip(buildCreateTripBody({ name, waypoints }));
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      setModalOpen(false);
      router.push(`/planner/${trip.id}`);
    } catch (error) {
      Alert.alert("Unable to create trip", error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const myTrips = data?.myTrips ?? [];
  const publicTrips = data?.publicTrips ?? [];

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <View>
          <Text style={type.overline}>PlanYourTrip</Text>
          <Text style={[type.title, styles.screenTitle]}>Trips</Text>
        </View>
        <View style={styles.topActions}>
          <Link href="/profile" asChild>
            <Pressable style={styles.iconBtn} accessibilityLabel="Open profile">
              <Ionicons name="person-circle-outline" size={28} color={colors.brandPrimary} />
            </Pressable>
          </Link>
          <Pressable
            style={styles.iconBtn}
            accessibilityLabel="Sign out"
            onPress={() => {
              Alert.alert("Sign out", "You will need to sign in again to access your trips.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: async () => {
                    await signOut();
                    router.replace("/login");
                  },
                },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <PrimaryButton label="+ New itinerary" onPress={openNewItineraryModal} />

      {publicTrips.length > 0 ? (
        <View style={styles.publicBlock}>
          <Text style={styles.sectionLabel}>Public trips</Text>
          <Text style={[type.caption, styles.publicHint]}>Itineraries shared by the community — open to view.</Text>
          {publicTrips.map((trip) => (
            <Link key={trip.id} href={`/planner/${trip.id}`} asChild>
              <Pressable style={({ pressed }) => [styles.publicRow, pressed && styles.rowPressed]}>
                <Ionicons name="globe-outline" size={20} color={colors.brandAccent} />
                <Text style={styles.publicTitle} numberOfLines={2}>
                  {trip.name}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, styles.myLabel]}>My itineraries</Text>
    </View>
  );

  return (
    <AppScreen>
      <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !creating && setModalOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKb}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <SurfaceCard style={styles.modalCard}>
                <Text style={styles.modalTitle}>New itinerary</Text>
                <Text style={[type.caption, styles.modalSub]}>
                  Same flow as the web app: pick a starter or a blank map, name your trip, then plan in the map.
                </Text>
                <TextField
                  label="Itinerary name"
                  placeholder={DEFAULT_TRIP_NAME}
                  value={newName}
                  onChangeText={setNewName}
                />
                <Text style={styles.fieldLabel}>Start from</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  <Pressable
                    style={[styles.chip, starterId === "blank" && styles.chipActive]}
                    onPress={() => setStarterId("blank")}
                  >
                    <Text style={[styles.chipTitle, starterId === "blank" && styles.chipTitleActive]}>Blank map</Text>
                    <Text style={styles.chipHint}>Add your own stops</Text>
                  </Pressable>
                  {STARTER_TEMPLATES.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[styles.chip, starterId === t.id && styles.chipActive]}
                      onPress={() => setStarterId(t.id)}
                    >
                      <Text style={[styles.chipTitle, starterId === t.id && styles.chipTitleActive]}>{t.title}</Text>
                      <Text style={styles.chipHint}>{t.subtitle}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <PrimaryButton label="Create itinerary" loading={creating} onPress={() => void createItinerary()} />
                <PrimaryButton label="Cancel" variant="ghost" disabled={creating} onPress={() => setModalOpen(false)} />
              </SurfaceCard>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {isLoading ? (
        <View style={styles.shell}>
          {header}
          <ActivityIndicator size="large" color={colors.brandPrimary} style={styles.spinner} />
          <Text style={styles.loading}>Loading trips…</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={myTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripRow
              item={item}
              onOpen={() => router.push(`/planner/${item.id}`)}
              onCollaboration={() => router.push(`/planner/${item.id}/collaboration`)}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <SurfaceCard style={styles.emptyCard}>
              <EmptyState
                title="No trips yet"
                description="Create an itinerary, add stops on the map, and optimize your days in the planner."
              >
                <PrimaryButton label="Create your first trip" onPress={openNewItineraryModal} />
              </EmptyState>
            </SurfaceCard>
          }
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isFetching}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: space.lg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
  headerBlock: { marginBottom: space.md, gap: space.lg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: space.sm,
  },
  screenTitle: { marginTop: 2 },
  topActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconBtn: { padding: space.sm },
  spinner: { marginTop: space.xl },
  loading: { ...type.body, color: colors.textMuted, textAlign: "center", marginTop: space.md },
  sectionLabel: { ...type.overline, marginTop: space.sm },
  myLabel: { marginBottom: space.sm },
  publicBlock: { gap: space.sm },
  publicHint: { color: colors.textSecondary, marginBottom: space.xs },
  publicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  publicTitle: { flex: 1, ...type.headline, fontSize: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
    gap: space.md,
  },
  rowPressed: { backgroundColor: colors.overlay },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.headline, fontSize: 17 },
  rowMeta: { ...type.caption, marginTop: 4 },
  tripActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  tripActionBtn: {
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fbff",
  },
  tripActionText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeDraft: { backgroundColor: "#f1f5f9" },
  badgeFinal: { backgroundColor: "#dcfce7" },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  badgeTextDraft: { color: colors.textSecondary },
  badgeTextFinal: { color: colors.success },
  emptyCard: { marginTop: space.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: space.lg,
  },
  modalKb: { width: "100%" },
  modalCard: { gap: space.md, maxWidth: 440, alignSelf: "center", width: "100%" },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalSub: { color: colors.textSecondary },
  fieldLabel: { ...type.caption, fontWeight: "600", color: colors.textSecondary },
  chipsRow: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    width: 160,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brandPrimary, backgroundColor: "#eff6ff" },
  chipTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  chipTitleActive: { color: colors.brandPrimary },
  chipHint: { ...type.caption, marginTop: 4 },
});
