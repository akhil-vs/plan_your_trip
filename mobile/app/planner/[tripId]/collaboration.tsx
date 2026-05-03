import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { env } from "@/config/env";
import { api } from "@/services/api";

export default function CollaborationScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [chatText, setChatText] = useState("");
  const [tab, setTab] = useState<"members" | "chat" | "activity">("members");

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => api.trip(tripId!),
    enabled: Boolean(tripId),
  });
  const currentRole = tripQuery.data?.currentUserRole as "OWNER" | "EDITOR" | "VIEWER" | undefined;
  const canInvite = currentRole === "OWNER" || currentRole === "EDITOR";
  const canRemoveMember = currentRole === "OWNER";

  const membersQuery = useQuery({
    queryKey: ["members", tripId],
    queryFn: () => api.members(tripId!),
    enabled: Boolean(tripId),
  });
  const invitesQuery = useQuery({
    queryKey: ["invites", tripId],
    queryFn: () => api.invites(tripId!),
    enabled: Boolean(tripId) && canInvite,
  });
  const chatQuery = useQuery({
    queryKey: ["chat", tripId],
    queryFn: () => api.chatMessages(tripId),
    enabled: Boolean(tripId),
  });
  const eventsQuery = useQuery({
    queryKey: ["events", tripId],
    queryFn: () => api.tripEvents(tripId, 40),
    enabled: Boolean(tripId),
  });

  const members = membersQuery.data ?? [];
  const messages = chatQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const activeMembers = members.length;
  const eventTypeLabel = (type: string) =>
    type
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const actorNameFromId = (actorId: string | null) => {
    if (!actorId) return "System";
    const member = members.find((m) => m.user.id === actorId);
    return member?.user.name?.trim() || member?.user.email || "Member";
  };
  const renderAvatar = (seed: string) => (
    <Image source={{ uri: `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(seed)}` }} style={styles.chatAvatar} />
  );

  const sendMessage = async () => {
    if (!chatText.trim()) return;
    try {
      await api.postChatMessage(tripId, { body: chatText.trim() });
      setChatText("");
      await chatQuery.refetch();
    } catch (error) {
      Alert.alert("Message failed", String(error));
    }
  };

  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, tab === "chat" && styles.contentWithComposer]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: "Members & Chat",
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTitleStyle: { color: "#1f2937", fontWeight: "700" },
          headerRight: () => (
            <Pressable style={styles.headerMenuBtn} onPress={() => Alert.alert("More options coming soon")}>
              <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
            </Pressable>
          ),
        }}
      />
      <Text style={styles.title}>Collaboration</Text>
      <Text style={styles.subtitle}>Invite members, chat, and monitor activity in one place.</Text>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "members" && styles.tabActive]} onPress={() => setTab("members")}>
          <Text style={[styles.tabText, tab === "members" && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "chat" && styles.tabActive]} onPress={() => setTab("chat")}>
          <Text style={[styles.tabText, tab === "chat" && styles.tabTextActive]}>
            Chat ({messages.length})
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "activity" && styles.tabActive]} onPress={() => setTab("activity")}>
          <Text style={[styles.tabText, tab === "activity" && styles.tabTextActive]}>
            Activity ({events.length})
          </Text>
        </Pressable>
      </View>

      {tab === "members" ? (
        <>
          {tripQuery.isLoading ? <Text style={styles.placeholder}>Loading trip access…</Text> : null}
          {currentRole === "VIEWER" ? (
            <Text style={styles.placeholder}>
              Viewers can&apos;t send invites. Ask an editor or the trip owner to invite people by email.
            </Text>
          ) : null}
          {canInvite ? (
            <View style={styles.inviteCard}>
              <Text style={styles.inviteLabel}>INVITE BY EMAIL</Text>
              <Text style={styles.inviteHint}>
                Sends the same email invite as the web app. They join via the link even if they don&apos;t have an
                account yet.
              </Text>
              <TextInput
                style={styles.inputFull}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="jane@example.com"
                placeholderTextColor="#9ca3af"
              />
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.roleChip, inviteRole === "EDITOR" && styles.roleChipActive]}
                  onPress={() => setInviteRole("EDITOR")}
                >
                  <Text style={[styles.roleChipText, inviteRole === "EDITOR" && styles.roleChipTextActive]}>Editor</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleChip, inviteRole === "VIEWER" && styles.roleChipActive]}
                  onPress={() => setInviteRole("VIEWER")}
                >
                  <Text style={[styles.roleChipText, inviteRole === "VIEWER" && styles.roleChipTextActive]}>Viewer</Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.btnFull, sendingInvite && styles.btnDisabled]}
                disabled={sendingInvite}
                onPress={async () => {
                  if (!inviteEmail.trim() || !tripId) return;
                  try {
                    setSendingInvite(true);
                    const res = await api.createInvite(tripId, inviteEmail.trim().toLowerCase(), inviteRole);
                    setInviteEmail("");
                    await invitesQuery.refetch();
                    const msg = res.emailDelivered
                      ? "Invite sent by email."
                      : "Invite created. Share the link if email did not arrive.";
                    Alert.alert("Invite sent", msg);
                  } catch (error) {
                    Alert.alert("Invite failed", error instanceof Error ? error.message : String(error));
                  } finally {
                    setSendingInvite(false);
                  }
                }}
              >
                <Text style={styles.btnText}>{sendingInvite ? "Sending…" : "Send invite"}</Text>
              </Pressable>
              <Text style={styles.sectionTitle}>Pending invites</Text>
              {invitesQuery.isLoading ? <Text style={styles.placeholder}>Loading invites…</Text> : null}
              {invitesQuery.isError ? (
                <Text style={styles.placeholder}>
                  Couldn&apos;t load invites (Pro plan required for collaboration on this trip).
                </Text>
              ) : null}
              {(invitesQuery.data ?? []).filter((i) => i.status === "PENDING").length === 0 &&
              !invitesQuery.isLoading &&
              !invitesQuery.isError ? (
                <Text style={styles.placeholder}>No pending invites.</Text>
              ) : null}
              {(invitesQuery.data ?? [])
                .filter((i) => i.status === "PENDING")
                .map((inv) => (
                  <View key={inv.id} style={styles.pendingInviteRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.itemText} numberOfLines={1}>
                        {inv.email}
                      </Text>
                      <Text style={styles.memberStatus}>{inv.role}</Text>
                    </View>
                    <Pressable
                      style={styles.secondaryPill}
                      onPress={async () => {
                        const link = `${env.apiBaseUrl}/invite/${inv.token}`;
                        try {
                          await Share.share({ message: link, title: "Trip invite" });
                        } catch {
                          Alert.alert("Invite link", link);
                        }
                      }}
                    >
                      <Text style={styles.secondaryPillText}>Share link</Text>
                    </Pressable>
                    <Pressable
                      style={styles.removePill}
                      onPress={async () => {
                        try {
                          await api.revokeInvite(tripId!, inv.id);
                          await invitesQuery.refetch();
                        } catch (error) {
                          Alert.alert("Revoke failed", error instanceof Error ? error.message : String(error));
                        }
                      }}
                    >
                      <Text style={styles.link}>Revoke</Text>
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>Team members</Text>
          {membersQuery.isLoading ? <Text style={styles.placeholder}>Loading members…</Text> : null}
          {members.length === 0 && !membersQuery.isLoading ? (
            <Text style={styles.placeholder}>No members yet. Invite collaborators to plan together.</Text>
          ) : null}
          <FlatList
            data={members}
            scrollEnabled={false}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person-outline" size={18} color="#2563eb" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.itemText}>
                    {item.user.name ?? item.user.email}
                    {item.role === "OWNER" ? " (OWNER)" : ""}
                  </Text>
                  <Text style={styles.memberStatus}>Active now</Text>
                </View>
                {canRemoveMember && item.role !== "OWNER" ? (
                  <Pressable
                    style={styles.removePill}
                    onPress={async () => {
                      try {
                        await api.removeMember(tripId!, item.user.id);
                        await membersQuery.refetch();
                      } catch (error) {
                        Alert.alert("Remove member failed", error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    <Text style={styles.link}>Remove</Text>
                  </Pressable>
                ) : item.role === "OWNER" ? (
                  <View style={styles.ownerPill}>
                    <Text style={styles.owner}>OWNER</Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        </>
      ) : null}

      {tab === "chat" ? (
        <>
          <View style={styles.activityStatusRow}>
            <View style={styles.activeDot} />
            <Text style={styles.activeMembersText}>{activeMembers} Members Active</Text>
          </View>
          {chatQuery.isLoading ? <Text style={styles.placeholder}>Loading chat…</Text> : null}
          {messages.length === 0 && !chatQuery.isLoading ? (
            <Text style={styles.placeholder}>No chat messages yet.</Text>
          ) : null}
          <FlatList
            data={messages}
            scrollEnabled={false}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.chatRow}>
                {renderAvatar(item.user?.name ?? item.user?.id ?? "user")}
                <View style={styles.chatBubble}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatAuthor}>{item.user?.name ?? "User"}</Text>
                    <Text style={styles.chatTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
                  </View>
                  <Text style={styles.chatBody}>{item.body ?? "[image]"}</Text>
                </View>
              </View>
            )}
          />
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          <View style={styles.activityStatusRow}>
            <View style={styles.activeDot} />
            <Text style={styles.activeMembersText}>{activeMembers} Members Active</Text>
          </View>
          {eventsQuery.isLoading ? <Text style={styles.placeholder}>Loading activity…</Text> : null}
          {events.length === 0 && !eventsQuery.isLoading ? (
            <Text style={styles.placeholder}>No activity events yet.</Text>
          ) : null}
          <FlatList
            data={events}
            scrollEnabled={false}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => (
              <View style={styles.activityRow}>
                <View style={styles.activityRail}>
                  <View style={styles.activityAvatar}>
                    <Ionicons name="person-outline" size={14} color="#334155" />
                  </View>
                  <View style={styles.activityLine} />
                </View>
                <View style={styles.activityBody}>
                  <View style={styles.activityMetaRow}>
                    <Text style={styles.activityTitle}>
                      {actorNameFromId(item.actorId)} · {eventTypeLabel(item.type)}
                    </Text>
                    <Text style={styles.activityTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
                  </View>
                  <View style={styles.activityBubble}>
                    <Text style={styles.eventText}>{JSON.stringify(item.payload ?? {}, null, 0) || "No details"}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        </>
      ) : null}
    </ScrollView>
    {tab === "chat" ? (
      <View style={styles.chatComposerDock}>
        <View style={styles.chatComposerRow}>
          <Pressable style={styles.chatPlusBtn}>
            <Ionicons name="add-circle-outline" size={24} color="#6b7280" />
          </Pressable>
          <View style={styles.chatInputWrap}>
            <TextInput
              style={styles.chatComposerInput}
              value={chatText}
              onChangeText={setChatText}
              placeholder="Type a message"
              placeholderTextColor="#9ca3af"
            />
            <Ionicons name="happy-outline" size={20} color="#6b7280" />
          </View>
          <Pressable style={styles.chatSendBtn} onPress={() => void sendMessage()}>
            <Text style={styles.chatSendText}>Send</Text>
            <Ionicons name="paper-plane-outline" size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f8" },
  container: { flex: 1, backgroundColor: "#f3f4f8" },
  content: { padding: 22, gap: 14, paddingBottom: 28 },
  contentWithComposer: { paddingBottom: 110 },
  headerMenuBtn: { padding: 6 },
  title: { fontSize: 38 / 2, fontWeight: "700", color: "#1f2937", marginTop: 2 },
  subtitle: { color: "#6b7280", marginTop: -4, fontSize: 31 / 2, lineHeight: 22 },
  tabs: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 10 },
  tab: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
  },
  tabActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  tabText: { color: "#4b5563", fontWeight: "700", fontSize: 15 },
  tabTextActive: { color: "#2563eb" },
  inviteCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
    marginTop: 2,
  },
  inviteLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  inviteHint: { color: "#6b7280", fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: "#4b5563", fontSize: 31 / 2, fontWeight: "700", marginTop: 6 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputFull: {
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    color: "#374151",
    fontSize: 28 / 2,
  },
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  roleChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  roleChipText: { fontWeight: "600", color: "#4b5563", fontSize: 14 },
  roleChipTextActive: { color: "#2563eb" },
  btnFull: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  pendingInviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  secondaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
  },
  secondaryPillText: { color: "#4338ca", fontWeight: "700", fontSize: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    color: "#374151",
    fontSize: 28 / 2,
  },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6efff",
  },
  memberInfo: { flex: 1, marginLeft: 10 },
  itemText: { color: "#1f2937", fontSize: 16, fontWeight: "500" },
  memberStatus: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  removePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#fef2f2" },
  link: { color: "#dc2626", fontWeight: "700", fontSize: 12 },
  ownerPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, backgroundColor: "#eef2ff" },
  owner: { color: "#4f46e5", fontWeight: "700", fontSize: 12 },
  placeholder: { color: "#6b7280", paddingVertical: 6, fontSize: 14 },
  chatBubble: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  chatRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  chatAvatar: { width: 32, height: 32, borderRadius: 8, marginTop: 2 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  chatAuthor: { color: "#1f2937", fontWeight: "700", fontSize: 16 },
  chatTime: { color: "#9ca3af", fontWeight: "600", fontSize: 12 },
  chatBody: { color: "#374151", fontSize: 15, lineHeight: 22 },
  chatComposerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 2 },
  chatComposerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: "#f3f4f8",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  chatPlusBtn: { padding: 2 },
  chatInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    minHeight: 44,
  },
  chatComposerInput: { flex: 1, color: "#374151", fontSize: 15, paddingVertical: 10 },
  chatSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#1759d6",
    paddingHorizontal: 16,
  },
  chatSendText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  activityStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#22c55e" },
  activeMembersText: { color: "#4b5563", fontSize: 15, fontWeight: "600" },
  activityRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  activityRail: { width: 30, alignItems: "center" },
  activityAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  activityLine: { width: 1, flex: 1, marginTop: 4, backgroundColor: "#d1d5db" },
  activityBody: { flex: 1 },
  activityMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  activityTitle: { color: "#1f2937", fontWeight: "700", fontSize: 15 },
  activityTime: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  activityBubble: {
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eventText: { color: "#4b5563", fontSize: 13, lineHeight: 18 },
});
