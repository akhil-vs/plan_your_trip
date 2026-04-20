import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Header } from "../components/Header";
import { colors, typography } from "../constants/theme";
import { fetchPublicTrip } from "../services/trips";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { routeNames } from "../constants/routes";

type Props = NativeStackScreenProps<RootStackParamList, typeof routeNames.ShareTrip>;

export function ShareTripScreen({ route }: Props) {
  const { shareId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [text, setText] = useState("Loading…");

  useEffect(() => {
    void (async () => {
      try {
        const t = await fetchPublicTrip(shareId);
        setText(JSON.stringify(t, null, 2).slice(0, 6000));
      } catch (e) {
        setText(e instanceof Error ? e.message : "Not found");
      }
    })();
  }, [shareId]);

  return (
    <Screen>
      <Header title="Shared trip" onBack={() => navigation.goBack()} />
      <View style={styles.box}>
        <Text style={styles.mono}>{text}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  mono: { fontSize: 12, color: colors.textSecondary, fontFamily: "Courier" },
});
