import React from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PlaceSuggestion } from "../../services/places";
import { colors } from "../../constants/theme";

const categories = ["Restaurants", "Fuel stations", "Hotels", "Parking", "Hospitals", "Attractions"];
const recentSearches = ["Home", "Airport Terminal 3", "Downtown Office"];
const suggestedPlaces = ["City Center Mall", "Central Park", "Riverside Walk"];

function metricSeed(id: string) {
  return Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function distanceLabel(id: string) {
  const km = ((metricSeed(id) % 120) + 8) / 10;
  return `${km.toFixed(1)} km`;
}

function ratingLabel(id: string) {
  const rating = 3.8 + ((metricSeed(id) % 13) / 10);
  return `${Math.min(5, rating).toFixed(1)} ★`;
}

interface Props {
  query: string;
  autoFocus?: boolean;
  onChangeQuery: (value: string) => void;
  results: PlaceSuggestion[];
  onSelectResult: (item: PlaceSuggestion) => void;
}

export function SearchPanel({ query, autoFocus, onChangeQuery, results, onSelectResult }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        autoFocus={autoFocus}
        style={styles.input}
        placeholder="Search destination or stop"
        placeholderTextColor={colors.textSecondary}
      />
      <Text style={styles.section}>Popular categories</Text>
      <View style={styles.catRow}>
        {categories.map((cat) => (
          <View key={cat} style={styles.chip}>
            <Text style={styles.chipText}>{cat}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.section}>Recent searches</Text>
      <View style={styles.simpleList}>
        {recentSearches.map((item) => (
          <Text key={item} style={styles.simpleItem}>
            • {item}
          </Text>
        ))}
      </View>
      <Text style={styles.section}>Suggested places</Text>
      <View style={styles.simpleList}>
        {suggestedPlaces.map((item) => (
          <Text key={item} style={styles.simpleItem}>
            • {item}
          </Text>
        ))}
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelectResult(item)}>
            <Text style={styles.placeIcon}>◉</Text>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.address} numberOfLines={1}>
                {item.fullName}
              </Text>
            </View>
            <View style={styles.metaWrap}>
              <Text style={styles.meta}>{ratingLabel(item.id)}</Text>
              <Text style={styles.distance}>{distanceLabel(item.id)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Recent searches and suggestions will appear here.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 10 },
  input: {
    backgroundColor: colors.card ?? "#F8F9FA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.text,
  },
  section: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "#E8F0FE" },
  chipText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  placeIcon: { color: colors.textSecondary, fontSize: 16 },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  address: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  metaWrap: { alignItems: "flex-end", gap: 2 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  distance: { color: colors.textSecondary, fontSize: 11 },
  simpleList: { marginBottom: 6 },
  simpleItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  empty: { color: colors.textSecondary, paddingVertical: 16 },
});
