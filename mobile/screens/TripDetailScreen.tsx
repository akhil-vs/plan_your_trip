import { useCallback, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, typography } from "../constants/theme";
import {
  deleteUnfinalize,
  deleteUnpublish,
  fetchTripChat,
  fetchTripInvites,
  fetchTripMembers,
  postFinalize,
  postPublish,
  postTripChat,
} from "../services/collaboration";
import { shareTripPdf } from "../services/pdfExport";
import { fetchTrip } from "../services/trips";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { routeNames } from "../constants/routes";

type Props = NativeStackScreenProps<RootStackParamList, typeof routeNames.TripDetail>;

export function TripDetailScreen({ route }: Props) {
  const { tripId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [trip, setTrip] = useState<{
    name: string;
    status: string;
    isPublic: boolean;
    shareId?: string;
  } | null>(null);
  const [members, setMembers] = useState<unknown[]>([]);
  const [invites, setInvites] = useState<unknown[]>([]);
  const [chat, setChat] = useState<
    { id: string; body: string | null; user?: { name: string | null } }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = (await fetchTrip(tripId)) as {
        name: string;
        status: string;
        isPublic: boolean;
        shareId?: string;
      };
      setTrip(t);
      try {
        const m = await fetchTripMembers(tripId);
        setMembers(m);
      } catch {
        setMembers([]);
      }
      try {
        const inv = await fetchTripInvites(tripId);
        setInvites(inv);
      } catch {
        setInvites([]);
      }
      try {
        const c = await fetchTripChat(tripId);
        setChat(c as typeof chat);
      } catch {
        setChat([]);
      }
    } catch {
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onFinalize() {
    try {
      await postFinalize(tripId);
      await load();
      Toast.show({ type: "success", text1: "Trip finalized" });
    } catch {
      Toast.show({ type: "error", text1: "Could not finalize" });
    }
  }

  async function onUnfinalize() {
    try {
      await deleteUnfinalize(tripId);
      await load();
    } catch {
      Toast.show({ type: "error", text1: "Could not reopen" });
    }
  }

  async function onPublish() {
    try {
      await postPublish(tripId);
      await load();
      Toast.show({ type: "success", text1: "Published" });
    } catch {
      Toast.show({ type: "error", text1: "Publish failed" });
    }
  }

  async function onUnpublish() {
    try {
      await deleteUnpublish(tripId);
      await load();
    } catch {
      Toast.show({ type: "error", text1: "Unpublish failed" });
    }
  }

  async function onExportPdf() {
    if (!trip) return;
    try {
      await shareTripPdf(tripId, trip.name);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "Export failed",
      });
    }
  }

  async function sendChat() {
    const body = chatInput.trim();
    if (!body) return;
    try {
      await postTripChat(tripId, { body });
      setChatInput("");
      const c = await fetchTripChat(tripId);
      setChat(c as typeof chat);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "Send failed",
      });
    }
  }

  if (loading || !trip) {
    return (
      <Screen>
        <Header title="Trip" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={trip.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.status}>
            {trip.status} {trip.isPublic ? "· Public" : ""}
          </Text>
          <View style={styles.row}>
            <Button title="Open map" onPress={() => navigation.navigate(routeNames.PlannerTrip, { tripId })} />
          </View>
          <View style={styles.row}>
            {trip.status !== "FINALIZED" ? (
              <Button title="Finalize" onPress={onFinalize} />
            ) : (
              <Button title="Reopen (draft)" variant="secondary" onPress={onUnfinalize} />
            )}
          </View>
          <View style={styles.row}>
            {!trip.isPublic ? (
              <Button title="Publish" variant="secondary" onPress={onPublish} />
            ) : (
              <Button title="Unpublish" variant="secondary" onPress={onUnpublish} />
            )}
          </View>
          <View style={styles.row}>
            <Button title="Export PDF" variant="secondary" onPress={onExportPdf} />
          </View>
        </Card>

        <Text style={styles.h2}>Members ({members.length})</Text>
        <FlatList
          data={members}
          scrollEnabled={false}
          keyExtractor={(_, i) => `m-${i}`}
          renderItem={({ item }) => (
            <Text style={styles.line}>{JSON.stringify(item).slice(0, 120)}</Text>
          )}
        />

        <Text style={styles.h2}>Pending invites ({invites.length})</Text>
        {invites.map((inv, i) => (
          <Text key={i} style={styles.line}>
            {JSON.stringify(inv).slice(0, 120)}
          </Text>
        ))}

        <Text style={styles.h2}>Chat</Text>
        <FlatList
          data={chat}
          scrollEnabled={false}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Text style={styles.chatLine}>
              <Text style={styles.chatAuthor}>{item.user?.name || "?"}: </Text>
              {item.body}
            </Text>
          )}
        />
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Message…"
          style={styles.input}
          onSubmitEditing={sendChat}
        />
        <Button title="Send" onPress={sendChat} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  muted: { color: colors.textSecondary },
  status: { fontWeight: "700", marginBottom: 12 },
  row: { marginTop: 8 },
  h2: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  line: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  chatLine: { marginBottom: 6, color: colors.text },
  chatAuthor: { fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
});
