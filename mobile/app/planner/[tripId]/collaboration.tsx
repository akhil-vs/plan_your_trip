import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/services/api";

export default function CollaborationScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [memberEmail, setMemberEmail] = useState("");
  const [chatText, setChatText] = useState("");
  const [tab, setTab] = useState<"members" | "chat" | "activity">("members");

  const membersQuery = useQuery({
    queryKey: ["members", tripId],
    queryFn: () => api.members(tripId),
    enabled: Boolean(tripId),
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Members & Chat", headerShown: true }} />
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
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={memberEmail}
              onChangeText={setMemberEmail}
              autoCapitalize="none"
              placeholder="Add member email"
            />
            <Pressable
              style={styles.btn}
              onPress={async () => {
                if (!memberEmail.trim()) return;
                try {
                  await api.addMember(tripId, memberEmail.trim(), "EDITOR");
                  setMemberEmail("");
                  await membersQuery.refetch();
                } catch (error) {
                  Alert.alert("Add member failed", String(error));
                }
              }}
            >
              <Text style={styles.btnText}>Add</Text>
            </Pressable>
          </View>
          {membersQuery.isLoading ? <Text style={styles.placeholder}>Loading members…</Text> : null}
          {members.length === 0 && !membersQuery.isLoading ? (
            <Text style={styles.placeholder}>No members yet. Invite collaborators to plan together.</Text>
          ) : null}
          <FlatList
            data={members}
            scrollEnabled={false}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {item.user.name ?? item.user.email} ({item.role})
                </Text>
                {item.role !== "OWNER" ? (
                  <Pressable
                    onPress={async () => {
                      try {
                        await api.removeMember(tripId, item.user.id);
                        await membersQuery.refetch();
                      } catch (error) {
                        Alert.alert("Remove member failed", String(error));
                      }
                    }}
                  >
                    <Text style={styles.link}>Remove</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.owner}>Owner</Text>
                )}
              </View>
            )}
          />
        </>
      ) : null}

      {tab === "chat" ? (
        <>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={chatText}
              onChangeText={setChatText}
              placeholder="Message"
            />
            <Pressable
              style={styles.btn}
              onPress={async () => {
                if (!chatText.trim()) return;
                try {
                  await api.postChatMessage(tripId, { body: chatText.trim() });
                  setChatText("");
                  await chatQuery.refetch();
                } catch (error) {
                  Alert.alert("Message failed", String(error));
                }
              }}
            >
              <Text style={styles.btnText}>Send</Text>
            </Pressable>
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
              <View style={styles.chatBubble}>
                <Text style={styles.chatAuthor}>{item.user?.name ?? "User"}</Text>
                <Text style={styles.chatBody}>{item.body ?? "[image]"}</Text>
              </View>
            )}
          />
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          {eventsQuery.isLoading ? <Text style={styles.placeholder}>Loading activity…</Text> : null}
          {events.length === 0 && !eventsQuery.isLoading ? (
            <Text style={styles.placeholder}>No activity events yet.</Text>
          ) : null}
          <FlatList
            data={events}
            scrollEnabled={false}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => (
              <Text style={styles.eventText}>
                {item.type} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            )}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#6b7280", marginTop: -4 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 4 },
  tab: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  tabActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  tabText: { color: "#4b5563", fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: "#2563eb" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  itemText: { color: "#111827" },
  link: { color: "#dc2626", fontWeight: "600" },
  owner: { color: "#4b5563", fontWeight: "600" },
  placeholder: { color: "#6b7280", paddingVertical: 6 },
  chatBubble: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  chatAuthor: { color: "#111827", fontWeight: "700", marginBottom: 2, fontSize: 12 },
  chatBody: { color: "#374151" },
  eventText: { color: "#374151", paddingVertical: 4 },
});
