import React from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import type { RootStackParamList } from "../navigation/types";
import { STRINGS } from "../shared/constants/strings";
import { createTrip, fetchTrips, type TripSummary } from "../services/backend/trips";

type Section = { title: string; data: TripSummary[] };

type Nav = StackNavigationProp<RootStackParamList>;

export function TripsScreen() {
  const navigation = useNavigation<Nav>();
  const [myTrips, setMyTrips] = React.useState<TripSummary[]>([]);
  const [publicTrips, setPublicTrips] = React.useState<TripSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await fetchTrips();
      setMyTrips(data.myTrips ?? []);
      setPublicTrips(data.publicTrips ?? []);
    } catch {
      setMyTrips([]);
      setPublicTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const sections: Section[] = React.useMemo(() => {
    const out: Section[] = [];
    if (myTrips.length > 0) {
      out.push({ title: STRINGS.tripsYourSection, data: myTrips });
    }
    if (publicTrips.length > 0) {
      out.push({ title: STRINGS.tripsCommunitySection, data: publicTrips });
    }
    return out;
  }, [myTrips, publicTrips]);

  const openTrip = React.useCallback(
    (tripId: string) => {
      navigation.navigate("TripDetail", { tripId });
    },
    [navigation],
  );

  const submitCreate = React.useCallback(async () => {
    const name = newName.trim() || "Untitled";
    setCreateError(null);
    try {
      const created = await createTrip({ name, description: null });
      const id = typeof created.id === "string" ? created.id : null;
      setModalOpen(false);
      setNewName("");
      await load();
      if (id) {
        openTrip(id);
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : STRINGS.commonError);
    }
  }, [load, newName, openTrip]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>{STRINGS.tripsTabTitle}</Text>
        <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>
      {loading ? <LoadingSkeleton rows={6} rowHeight={56} /> : null}
      {!loading && sections.length === 0 ? (
        <Text style={styles.empty}>{STRINGS.tripsEmpty}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          renderSectionHeader={({ section }) => <Text style={styles.h2}>{section.title}</Text>}
          renderItem={({ item, section }) => (
            <Pressable style={styles.card} onPress={() => openTrip(item.id)}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.status === "FINALIZED" ? STRINGS.tripStatusFinalized : STRINGS.tripStatusDraft}
                {item.isPublic ? ` · ${STRINGS.tripPublic}` : ""}
                {section.title === STRINGS.tripsCommunitySection && item.user?.name
                  ? ` · ${item.user.name}`
                  : ""}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal transparent visible={modalOpen} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{STRINGS.tripsCreateTitle}</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={STRINGS.tripsCreateName}
              placeholderTextColor="#9AA0A6"
              style={styles.modalInput}
            />
            {createError ? <Text style={styles.modalError}>{createError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => { setModalOpen(false); setCreateError(null); }}>
                <Text style={styles.modalCancelText}>{STRINGS.tripsCreateCancel}</Text>
              </Pressable>
              <Pressable style={styles.modalOk} onPress={() => void submitCreate()}>
                <Text style={styles.modalOkText}>{STRINGS.tripsCreateSubmit}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { fontSize: 22, fontWeight: "700", color: "#202124" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#FFFFFF", fontSize: 22, fontWeight: "600", marginTop: -2 },
  h2: { fontSize: 14, fontWeight: "600", color: "#5F6368", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  listContent: { paddingBottom: 24 },
  card: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EAED",
    backgroundColor: "#FFFFFF",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#202124" },
  meta: { marginTop: 6, fontSize: 13, color: "#5F6368" },
  empty: { textAlign: "center", color: "#5F6368", padding: 24, fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#202124", marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#202124",
  },
  modalError: { color: "#EA4335", fontSize: 13, marginTop: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: "#5F6368", fontSize: 15, fontWeight: "600" },
  modalOk: {
    marginLeft: 12,
    backgroundColor: "#1A73E8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalOkText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
