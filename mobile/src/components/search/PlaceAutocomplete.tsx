import React, { memo, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { STRINGS } from "../../shared/constants/strings";
import { PlaceSuggestion } from "../../shared/types/place.types";

type PlaceAutocompleteProps = {
  data: PlaceSuggestion[];
  onSelect: (place: PlaceSuggestion) => void;
};

type PlaceRowProps = {
  item: PlaceSuggestion;
  onPress: (place: PlaceSuggestion) => void;
};

const PlaceRow = memo(function PlaceRow({ item, onPress }: PlaceRowProps) {
  return (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
      <View style={styles.pinCircle}>
        <Text style={styles.pinIcon}>⌖</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.primaryText}>{item.name}</Text>
        <Text style={styles.secondaryText} numberOfLines={1}>
          {item.secondaryText}
        </Text>
      </View>
    </Pressable>
  );
});

export function PlaceAutocomplete({ data, onSelect }: PlaceAutocompleteProps) {
  const renderItem = useCallback(
    ({ item }: { item: PlaceSuggestion }) => <PlaceRow item={item} onPress={onSelect} />,
    [onSelect],
  );

  return (
    <FlatList
      data={data}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View>
          <View style={styles.currentLocationRow}>
            <Text style={styles.currentLocationText}>{STRINGS.useCurrentLocation}</Text>
          </View>
          <Text style={styles.recentHeader}>{STRINGS.recentSearches}</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>{STRINGS.noResults}</Text>}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { backgroundColor: "#FFFFFF", paddingBottom: 24, flexGrow: 1 },
  currentLocationRow: { height: 48, justifyContent: "center", paddingHorizontal: 16 },
  currentLocationText: { fontSize: 14, fontWeight: "600", color: "#1A73E8" },
  recentHeader: { fontSize: 12, color: "#5F6368", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 6 },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  pinIcon: { fontSize: 20, color: "#5F6368" },
  textBlock: { marginLeft: 12, flex: 1 },
  primaryText: { fontSize: 14, color: "#202124", fontWeight: "700" },
  secondaryText: { fontSize: 12, color: "#5F6368", marginTop: 2 },
  separator: { height: 0.5, backgroundColor: "#E8EAED", marginLeft: 64 },
  emptyText: { paddingHorizontal: 16, paddingTop: 16, fontSize: 13, color: "#5F6368" },
});
