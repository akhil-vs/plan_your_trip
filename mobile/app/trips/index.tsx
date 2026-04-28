import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1548345680-f5475ea5df84?auto=format&fit=crop&w=1200&q=80";

const PUBLIC_AUTHORS = ["TravelEnthusiast", "RouteMaster", "PeakWalker", "TrailAtlas"];
const PUBLIC_TRIP_IMAGES = [
  "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
];

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
  const insets = useSafeAreaInsets();
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
  const featuredTrip = myTrips[0];
  const remainingTrips = myTrips.slice(1);
  const plannerTarget = featuredTrip?.id ? `/planner/${featuredTrip.id}` : null;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <View>
          <Text style={[type.title, styles.brandTitle]}>Viazo</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </Pressable>
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

      <Pressable style={styles.newTripButton} onPress={openNewItineraryModal}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.newTripText}>+ New itinerary</Text>
      </Pressable>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>My Itineraries</Text>
        <Text style={styles.sectionLink}>View all</Text>
      </View>

      {featuredTrip ? (
        <Pressable style={({ pressed }) => [styles.heroCard, pressed && styles.rowPressed]} onPress={() => router.push(`/planner/${featuredTrip.id}`)}>
          <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.heroImage} imageStyle={styles.heroImageRadius}>
            <View style={styles.heroBadge}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />
              <Text style={styles.heroBadgeText}>{featuredTrip.status === "FINALIZED" ? "Finalized" : "Draft"}</Text>
            </View>
          </ImageBackground>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {featuredTrip.name}
            </Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.heroMeta}>
                {featuredTrip.waypoints.length} {featuredTrip.waypoints.length === 1 ? "stop" : "stops"} •{" "}
                {featuredTrip.dayPlans?.length ?? Math.max(1, Math.ceil(featuredTrip.waypoints.length / 3))} days
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable style={styles.heroPrimaryAction} onPress={() => router.push(`/planner/${featuredTrip.id}`)}>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={styles.heroPrimaryActionText}>Open planner</Text>
              </Pressable>
              <Pressable style={styles.heroSecondaryAction} onPress={() => router.push(`/planner/${featuredTrip.id}/collaboration`)}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      ) : (
        <SurfaceCard style={styles.emptyCard}>
          <EmptyState
            title="No trips yet"
            description="Create an itinerary, add stops on the map, and optimize your days in the planner."
          >
            <PrimaryButton label="Create your first trip" onPress={openNewItineraryModal} />
          </EmptyState>
        </SurfaceCard>
      )}

      {publicTrips.length > 0 ? (
        <View style={styles.publicBlock}>
          <Text style={styles.sectionTitle}>Public Trips</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.publicCarouselContent}>
            {publicTrips.map((trip) => (
              <Link key={trip.id} href={`/planner/${trip.id}`} asChild>
                <Pressable style={({ pressed }) => [styles.publicCard, pressed && styles.rowPressed]}>
                  <ImageBackground
                    source={{ uri: PUBLIC_TRIP_IMAGES[Math.abs(trip.name.length) % PUBLIC_TRIP_IMAGES.length] }}
                    style={styles.publicCardImage}
                    imageStyle={styles.publicCardImageRadius}
                  >
                    <View style={styles.publicCardBadge}>
                      <Ionicons name="globe-outline" size={12} color="#1d4ed8" />
                      <Text style={styles.publicCardBadgeText}>Public</Text>
                    </View>
                  </ImageBackground>
                  <View style={styles.publicCardBody}>
                    <Text style={styles.publicCardTitle} numberOfLines={1}>
                      {trip.name}
                    </Text>
                    <Text style={styles.publicCardMeta} numberOfLines={1}>
                      Shared by {PUBLIC_AUTHORS[Math.abs(trip.name.length) % PUBLIC_AUTHORS.length]}
                    </Text>
                    <View style={styles.publicCardFooter}>
                      <View style={styles.publicStopsPill}>
                        <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.publicStopsPillText}>
                          {trip.waypoints.length} {trip.waypoints.length === 1 ? "stop" : "stops"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </View>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
          data={remainingTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripRow
              item={item}
              onOpen={() => router.push(`/planner/${item.id}`)}
              onCollaboration={() => router.push(`/planner/${item.id}/collaboration`)}
            />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 + insets.bottom }]}
          onRefresh={refetch}
          refreshing={isFetching}
        />
      )}
      <View style={[styles.bottomMenu, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.bottomMenuItem} onPress={() => router.replace("/trips")}>
          <Ionicons name="home" size={18} color={colors.brandPrimary} />
          <Text style={[styles.bottomMenuLabel, styles.bottomMenuLabelActive]}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.bottomMenuItem}
          onPress={() => {
            if (plannerTarget) {
              router.push(plannerTarget);
              return;
            }
            openNewItineraryModal();
          }}
        >
          <Ionicons name="map-outline" size={18} color={colors.textMuted} />
          <Text style={styles.bottomMenuLabel}>Planner</Text>
        </Pressable>
        <Pressable style={styles.bottomMenuItem} onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <Text style={styles.bottomMenuLabel}>Profile</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: space.lg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: space.lg, flexGrow: 1 },
  headerBlock: { marginBottom: space.md, gap: space.lg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: space.xs,
  },
  brandTitle: { color: colors.brandPrimary, fontSize: 30 },
  topActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconBtn: {
    height: 34,
    width: 34,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2ff",
  },
  newTripButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 12,
    ...{
      shadowColor: "#1d4ed8",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 10,
      elevation: 5,
    },
  },
  newTripText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  spinner: { marginTop: space.xl },
  loading: { ...type.body, color: colors.textMuted, textAlign: "center", marginTop: space.md },
  bottomMenu: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomMenuItem: { alignItems: "center", justifyContent: "center", gap: 3, minWidth: 72 },
  bottomMenuLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  bottomMenuLabelActive: { color: colors.brandPrimary, fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  sectionLink: { color: "#3478f6", fontWeight: "500" },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  heroImage: { height: 94, justifyContent: "flex-start", alignItems: "flex-end", padding: 10 },
  heroImageRadius: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  heroBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  heroBadgeText: { color: "#166534", fontSize: 11, fontWeight: "600" },
  heroContent: { padding: space.lg, gap: space.sm },
  heroTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroMeta: { ...type.caption },
  heroActions: { flexDirection: "row", gap: space.sm, marginTop: 4 },
  heroPrimaryAction: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  heroPrimaryActionText: { color: "#fff", fontWeight: "600" },
  heroSecondaryAction: {
    width: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  publicBlock: { gap: space.sm },
  publicCarouselContent: { paddingRight: 8, gap: 10 },
  publicCard: {
    width: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  publicCardImage: { height: 92, justifyContent: "flex-start", alignItems: "flex-end", padding: 8 },
  publicCardImageRadius: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  publicCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,246,255,0.94)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  publicCardBadgeText: { color: "#1d4ed8", fontSize: 10, fontWeight: "700" },
  publicCardBody: { padding: 10, gap: 6 },
  publicCardTitle: { ...type.headline, fontSize: 15 },
  publicCardMeta: { ...type.caption },
  publicCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  publicStopsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publicStopsPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
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
