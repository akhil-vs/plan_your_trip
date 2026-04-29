import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80";
const PROFILE_IMAGE =
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80";

const FEATURES = [
  { id: "f1", title: "Smart Itineraries", subtitle: "Create day-by-day plans in minutes.", icon: "map-outline" as const },
  { id: "f2", title: "Chat with Friends", subtitle: "Discuss and make decisions together.", icon: "chatbubble-ellipses-outline" as const },
  { id: "f3", title: "Organize Easily", subtitle: "Keep everything in one place.", icon: "reader-outline" as const },
  { id: "f4", title: "Share & Collaborate", subtitle: "Invite friends and edit plans.", icon: "bookmark-outline" as const },
];

const CONVERSATIONS = [
  { id: "c1", trip: "Japan Adventure", preview: "Emma: How about visiting Nikko on day 4?", time: "2m ago", count: 3 },
  { id: "c2", trip: "Italy Road Trip", preview: "Liam: I found a great coastal route!", time: "1h ago", count: 2 },
  { id: "c3", trip: "Switzerland Escape", preview: "You: Let's finalise the hotel in Interlaken.", time: "3h ago", count: 1 },
];

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerSticky, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.header}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>Viazo</Text>
            <Text style={styles.brandSuffix}>.cc</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={18} color="#1f2937" />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable style={styles.profileBtn}>
              <Image source={{ uri: PROFILE_IMAGE }} style={styles.avatar} />
              <View style={styles.profileDot} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Your trip.</Text>
          <Text style={[styles.heroTitle, styles.heroTitleAccent]}>Perfectly planned.</Text>
          <Text style={styles.heroSub}>Plan, organize and share unforgettable trips with friends.</Text>
          <View style={styles.heroActions}>
            <Link href="/register" asChild>
              <Pressable style={styles.primaryBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Create Trip</Text>
              </Pressable>
            </Link>
            <Link href="/login" asChild>
              <Pressable style={styles.secondaryBtn}>
                <Ionicons name="person-add-outline" size={16} color="#334155" />
                <Text style={styles.secondaryBtnText}>Add Friends</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
      </View>

      <Text style={styles.sectionTitle}>Plan smarter with Viazo</Text>
      <View style={styles.featureGrid}>
        {FEATURES.map((feature) => (
          <View key={feature.id} style={styles.featureCard}>
            <View style={styles.featureIconWrap}>
              <Ionicons name={feature.icon} size={18} color="#2563eb" />
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureSub}>{feature.subtitle}</Text>
          </View>
        ))}
      </View>

      <View style={styles.rowTitle}>
        <Text style={styles.sectionTitle}>Recent Conversations</Text>
        <Text style={styles.linkText}>View all</Text>
      </View>
      <View style={styles.conversationCard}>
        {CONVERSATIONS.map((item) => (
          <View key={item.id} style={styles.conversationRow}>
            <View style={styles.conversationAvatarStack}>
              <View style={styles.conversationAvatarA} />
              <View style={styles.conversationAvatarB} />
            </View>
            <View style={styles.conversationMain}>
              <Text style={styles.conversationTrip}>{item.trip}</Text>
              <Text style={styles.conversationPreview} numberOfLines={1}>
                {item.preview}
              </Text>
            </View>
            <View style={styles.conversationRight}>
              <Text style={styles.conversationTime}>{item.time}</Text>
              <View style={styles.conversationBadge}>
                <Text style={styles.conversationBadgeText}>{item.count}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  headerSticky: {
    backgroundColor: "#ffffff",
    paddingBottom: 10,
    zIndex: 20,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 },
  brandWrap: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  brand: { fontSize: 30, fontWeight: "800", color: "#0f172a", letterSpacing: -0.8, lineHeight: 30 },
  brandSuffix: { fontSize: 17, fontWeight: "700", color: "#64748b", marginBottom: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#3b82f6",
  },
  profileBtn: { position: "relative" },
  avatar: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: "#dbe1ea" },
  profileDot: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  heroCard: { borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", backgroundColor: "#f8fafc" },
  heroCopy: { padding: 14 },
  heroTitle: { fontSize: 36 / 2, fontWeight: "800", color: "#0f172a", lineHeight: 21 },
  heroTitleAccent: { color: "#2563eb" },
  heroSub: { color: "#475569", marginTop: 8, fontSize: 13, maxWidth: 280 },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryBtnText: { color: "#334155", fontWeight: "600" },
  heroImage: { height: 160, width: "100%" },
  rowTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 26 / 2, fontWeight: "700", color: "#111827" },
  linkText: { color: "#2563eb", fontWeight: "600" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 6,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: "#0f172a", fontWeight: "700", fontSize: 13 },
  featureSub: { color: "#64748b", fontSize: 12, lineHeight: 16 },
  conversationCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  conversationAvatarStack: { width: 38, height: 26, position: "relative" },
  conversationAvatarA: { position: "absolute", left: 0, top: 2, width: 22, height: 22, borderRadius: 99, backgroundColor: "#bfdbfe" },
  conversationAvatarB: { position: "absolute", left: 15, top: 2, width: 22, height: 22, borderRadius: 99, backgroundColor: "#93c5fd" },
  conversationMain: { flex: 1 },
  conversationTrip: { color: "#111827", fontWeight: "700", fontSize: 14 },
  conversationPreview: { color: "#64748b", fontSize: 12, marginTop: 1 },
  conversationRight: { alignItems: "flex-end", gap: 4 },
  conversationTime: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  conversationBadge: { minWidth: 18, height: 18, borderRadius: 99, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  conversationBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
});
