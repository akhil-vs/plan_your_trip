import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
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
import { trackEvent } from "@/lib/analytics";
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
const ITINERARY_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
];
const DISCOVERY_DEFAULT_CATEGORY = "waterfalls";
const DISCOVERY_DEFAULT_REGION = "england";

function getHrefFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const href = (data as Record<string, unknown>).href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}

function TripCard({
  item,
  onOpen,
  onCollaboration,
  imageUri,
}: {
  item: Trip;
  onOpen: () => void;
  onCollaboration: () => void;
  imageUri?: string | null;
}) {
  const status = item.status === "FINALIZED" ? "Finalized" : "Draft";
  const isFinal = item.status === "FINALIZED";
  return (
    <View style={styles.itineraryCard}>
      <View style={styles.rowTop}>
        <View style={[styles.badge, isFinal ? styles.badgeFinal : styles.badgeDraft]}>
          <Text style={[styles.badgeText, isFinal ? styles.badgeTextFinal : styles.badgeTextDraft]}>{status}</Text>
        </View>
        <Pressable onPress={onOpen} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Pressable onPress={onOpen}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.itineraryMetaRow}>
          <Ionicons name="location-outline" size={15} color={colors.textMuted} />
          <Text style={styles.rowMeta}>
          {item.waypoints.length} {item.waypoints.length === 1 ? "stop" : "stops"}
          </Text>
        </View>
      </Pressable>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.itineraryImage} /> : null}
      <View style={styles.tripActions}>
        <Pressable style={[styles.tripActionBtn, styles.tripActionPrimary]} onPress={onOpen}>
          <Ionicons name="calendar-outline" size={14} color="#fff" />
          <Text style={[styles.tripActionText, styles.tripActionTextPrimary]}>Open planner</Text>
        </Pressable>
        <Pressable style={[styles.tripActionBtn, styles.tripActionSecondary]} onPress={onCollaboration}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.brandPrimary} />
          <Text style={styles.tripActionText}>Members & chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<Trip>>(null);
  const signOut = useAuthStore((s) => s.signOut);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["trips"],
    queryFn: api.trips,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(DISCOVERY_DEFAULT_CATEGORY);
  const [selectedRegion, setSelectedRegion] = useState(DISCOVERY_DEFAULT_REGION);
  const [newName, setNewName] = useState("");
  const [starterId, setStarterId] = useState<string | "blank">("blank");
  const [creating, setCreating] = useState(false);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const toggleViewAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllTrips((prev) => !prev);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  };
  const prefetchTrip = (tripId: string) =>
    queryClient.prefetchQuery({
      queryKey: ["trip", tripId],
      queryFn: () => api.trip(tripId),
      staleTime: 5 * 60 * 1000,
    });
  const { data: discoveryData, isFetching: discoveryFetching } = useQuery({
    queryKey: ["discovery-gems", selectedCategory, selectedRegion],
    queryFn: () => api.discoveryGems({ category: selectedCategory, region: selectedRegion }),
  });
  const { data: guides } = useQuery({
    queryKey: ["guides", selectedCategory, selectedRegion],
    queryFn: () => api.guides({ category: selectedCategory, region: selectedRegion }),
  });
  const { data: staycations } = useQuery({
    queryKey: ["staycations", selectedRegion],
    queryFn: () => api.staycations({ region: selectedRegion }),
  });

  const [notifVisible, setNotifVisible] = useState(false);
  const {
    data: notifPayload,
    refetch: refetchNotifications,
    isFetching: notifsFetching,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications(30),
    refetchInterval: 45_000,
  });

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
  const remainingTrips = showAllTrips ? myTrips : myTrips.slice(1);

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <View>
          <Text style={[type.title, styles.brandTitle]}>Viazo</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={styles.iconBtn}
            accessibilityLabel="Notifications"
            onPress={() => {
              setNotifVisible(true);
              void refetchNotifications();
            }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            {(notifPayload?.unreadCount ?? 0) > 0 ? (
              <View style={styles.notifBadge} accessibilityElementsHidden>
                <Text style={styles.notifBadgeText}>
                  {(notifPayload?.unreadCount ?? 0) > 99 ? "99+" : String(notifPayload?.unreadCount ?? 0)}
                </Text>
              </View>
            ) : null}
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
                    router.replace("/landing");
                  },
                },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <View>
          <Text style={styles.sectionTitle}>My Itineraries</Text>
          <Text style={styles.sectionSubtitle}>Manage your upcoming journeys and drafts.</Text>
        </View>
        <Pressable onPress={toggleViewAll}>
          <Text style={styles.sectionLink}>{showAllTrips ? "Show less" : "View all"}</Text>
        </Pressable>
      </View>

      {featuredTrip && !showAllTrips ? (
        <TripCard
          item={featuredTrip}
          imageUri={null}
          onOpen={() => {
            void prefetchTrip(featuredTrip.id);
            router.push(`/planner/${featuredTrip.id}`);
          }}
          onCollaboration={() => router.push(`/planner/${featuredTrip.id}/collaboration`)}
        />
      ) : !featuredTrip ? (
        <SurfaceCard style={styles.emptyCard}>
          <EmptyState
            title="No trips yet"
            description="Create an itinerary, add stops on the map, and optimize your days in the planner."
          >
            <PrimaryButton label="Create your first trip" onPress={openNewItineraryModal} />
          </EmptyState>
        </SurfaceCard>
      ) : null}

      {!showAllTrips && publicTrips.length > 0 ? (
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
      {!showAllTrips ? (
      <View style={styles.publicBlock}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Discover Gems</Text>
          <Pressable onPress={() => router.push("/saved")}>
            <Text style={styles.sectionLink}>Saved</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.publicCarouselContent}>
          {(discoveryData?.categories || []).map((cat) => (
            <Pressable
              key={cat.key}
              style={[styles.filterChip, selectedCategory === cat.key && styles.filterChipActive]}
              onPress={() => {
                setSelectedCategory(cat.key);
                trackEvent("discovery.category_changed", { category: cat.key });
              }}
            >
              <Text style={[styles.filterChipText, selectedCategory === cat.key && styles.filterChipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.publicCarouselContent}>
          {(discoveryData?.regions || []).map((region) => (
            <Pressable
              key={region.key}
              style={[styles.filterChip, selectedRegion === region.key && styles.filterChipActive]}
              onPress={() => {
                setSelectedRegion(region.key);
                trackEvent("discovery.region_changed", { region: region.key });
              }}
            >
              <Text style={[styles.filterChipText, selectedRegion === region.key && styles.filterChipTextActive]}>
                {region.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {discoveryFetching ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : null}
        {(discoveryData?.gems || []).slice(0, 8).map((gem) => (
          <Pressable
            key={gem.id}
            style={styles.discoveryRow}
            onPress={async () => {
              trackEvent("discovery.gem_opened", { gemId: gem.id, category: gem.category, region: gem.region });
              if (!featuredTrip) {
                Alert.alert(
                  "Create an itinerary first",
                  "Create an itinerary to save and route this gem.",
                  [{ text: "OK", onPress: openNewItineraryModal }]
                );
                return;
              }
              try {
                await api.saveGem(gem.id, {
                  tripId: featuredTrip.id,
                  name: gem.name,
                  category: gem.category,
                  lat: gem.lat,
                  lng: gem.lng,
                });
                await queryClient.invalidateQueries({ queryKey: ["saved-gems", featuredTrip.id] });
                Alert.alert("Saved", `"${gem.name}" saved to ${featuredTrip.name}.`, [
                  {
                    text: "Open planner",
                    onPress: () => router.push(`/planner/${featuredTrip.id}`),
                  },
                  { text: "Stay here", style: "cancel" },
                ]);
              } catch (error) {
                Alert.alert("Unable to save gem", error instanceof Error ? error.message : String(error));
              }
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{gem.name}</Text>
              <Text style={styles.publicCardMeta}>{gem.categoryLabel} • {gem.regionLabel}</Text>
            </View>
            <Text style={styles.sectionLink}>{featuredTrip ? "Save" : "Open trip to save"}</Text>
          </Pressable>
        ))}
      </View>
      ) : null}
      {!showAllTrips ? (
      <View style={styles.publicBlock}>
        <Text style={styles.sectionTitle}>Inspiration Guides</Text>
        {(guides || []).map((guide) => (
          <SurfaceCard key={guide.slug} style={styles.discoveryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{guide.title}</Text>
              <Text style={styles.publicCardMeta}>{guide.summary}</Text>
            </View>
            <Text style={styles.publicCardMeta}>{guide.readMinutes} min</Text>
          </SurfaceCard>
        ))}
      </View>
      ) : null}
      {!showAllTrips ? (
      <View style={styles.publicBlock}>
        <Text style={styles.sectionTitle}>Staycation Picks</Text>
        {(staycations || []).slice(0, 4).map((stay) => (
          <SurfaceCard key={stay.id} style={styles.discoveryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{stay.name}</Text>
              <Text style={styles.publicCardMeta}>
                {stay.tags.join(" • ")} • from £{stay.priceFrom}/night
              </Text>
            </View>
          </SurfaceCard>
        ))}
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

      <Modal transparent visible={notifVisible} animationType="slide" onRequestClose={() => setNotifVisible(false)}>
        <View style={styles.notifBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNotifVisible(false)} accessibilityLabel="Close notifications" />
          <View style={styles.notifSheet}>
            <View style={styles.notifSheetHeader}>
              <Text style={styles.notifSheetTitle}>Notifications</Text>
              <View style={styles.notifHeaderActions}>
                {(notifPayload?.unreadCount ?? 0) > 0 ? (
                  <Pressable
                    onPress={async () => {
                      try {
                        await api.notificationsMarkAllRead();
                        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <Text style={styles.sectionLink}>Mark all read</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setNotifVisible(false)} accessibilityLabel="Close">
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            {notifsFetching && !(notifPayload?.notifications?.length ?? 0) ? (
              <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginVertical: 28 }} />
            ) : (
              <FlatList
                data={notifPayload?.notifications ?? []}
                keyExtractor={(i) => i.id}
                style={{ maxHeight: Dimensions.get("window").height * 0.58 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.notifRow, item.readAt ? null : styles.notifRowUnread]}
                    onPress={async () => {
                      try {
                        if (!item.readAt) await api.notificationMarkRead(item.id);
                        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
                      } catch {
                        // ignore
                      }
                      const href = getHrefFromNotificationData(item.data);
                      setNotifVisible(false);
                      if (href) router.push(href);
                    }}
                  >
                    <Text style={styles.notifType}>{item.type.replace(/_/g, " ")}</Text>
                    <Text style={styles.notifItemTitle}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={5}>
                      {item.body}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.notifEmpty}>No notifications yet.</Text>}
              />
            )}
          </View>
        </View>
      </Modal>

      {isLoading ? (
        <View style={styles.shell}>
          {header}
          <ActivityIndicator size="large" color={colors.brandPrimary} style={styles.spinner} />
          <Text style={styles.loading}>Loading trips…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={remainingTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TripCard
              item={item}
              imageUri={index % 2 === 0 ? ITINERARY_CARD_IMAGES[index % ITINERARY_CARD_IMAGES.length] : null}
              onOpen={() => {
                void prefetchTrip(item.id);
                router.push(`/planner/${item.id}`);
              }}
              onCollaboration={() => router.push(`/planner/${item.id}/collaboration`)}
            />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.listContent, { paddingBottom: 130 + insets.bottom }]}
          onRefresh={refetch}
          refreshing={isFetching}
        />
      )}
      <View style={[styles.bottomMenu, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.bottomMenuItem} onPress={() => router.replace("/trips")}>
          <View style={[styles.bottomMenuCircle, styles.bottomMenuCircleActive]}>
            <Ionicons name="home" size={18} color="#fff" />
          </View>
          <Text style={[styles.bottomMenuLabel, styles.bottomMenuLabelActive]}>Home</Text>
        </Pressable>
        <Pressable style={styles.bottomMenuItem} onPress={openNewItineraryModal}>
          <View style={styles.bottomMenuCircle}>
            <Ionicons name="map-outline" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.bottomMenuLabel}>Planner</Text>
        </Pressable>
        <Pressable style={styles.bottomMenuItem} onPress={() => router.push("/profile")}>
          <View style={styles.bottomMenuCircle}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          </View>
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
    position: "relative",
    overflow: "visible",
  },
  notifBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  notifBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  notifSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    maxHeight: Dimensions.get("window").height * 0.78,
  },
  notifSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  notifSheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  notifHeaderActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  notifRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  notifRowUnread: { backgroundColor: "#eff6ff" },
  notifType: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "capitalize", marginBottom: 4 },
  notifItemTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4 },
  notifBody: { ...type.caption, color: colors.textSecondary, lineHeight: 18 },
  notifEmpty: { ...type.body, color: colors.textMuted, textAlign: "center", paddingVertical: 28 },
  spinner: { marginTop: space.xl },
  loading: { ...type.body, color: colors.textMuted, textAlign: "center", marginTop: space.md },
  bottomMenu: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  bottomMenuItem: { alignItems: "center", justifyContent: "center", gap: 6, minWidth: 72 },
  bottomMenuCircle: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  bottomMenuCircleActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  bottomMenuLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  bottomMenuLabelActive: { color: colors.brandPrimary, fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  sectionSubtitle: { ...type.caption, marginTop: 2 },
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
  itineraryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
    gap: space.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPressed: { backgroundColor: colors.overlay },
  rowTitle: { ...type.headline, fontSize: 17 },
  itineraryMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  rowMeta: { ...type.caption },
  itineraryImage: {
    width: "100%",
    height: 100,
    borderRadius: radius.md,
    marginTop: 2,
  },
  tripActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  tripActionBtn: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  tripActionPrimary: { backgroundColor: "#1248dd" },
  tripActionSecondary: { backgroundColor: "#dfe2f7" },
  tripActionText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  tripActionTextPrimary: { color: "#fff" },
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
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filterChipActive: { borderColor: colors.brandPrimary, backgroundColor: "#eff6ff" },
  filterChipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 12 },
  filterChipTextActive: { color: colors.brandPrimary },
  discoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: "#fff",
  },
});
