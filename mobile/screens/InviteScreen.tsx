import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Header } from "../components/Header";
import { colors, typography } from "../constants/theme";
import { acceptInvite } from "../services/collaboration";
import { routeNames } from "../constants/routes";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<RootStackParamList, typeof routeNames.Invite>;

export function InviteScreen({ route }: Props) {
  const { token } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus("Tap accept to join this trip.");
  }, []);

  async function onAccept() {
    setBusy(true);
    try {
      const r = await acceptInvite(token);
      if (r.tripId) {
        navigation.replace(routeNames.TripDetail, { tripId: r.tripId });
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Invite" onBack={() => navigation.goBack()} />
      <Text style={styles.p}>{status}</Text>
      <Button title="Accept invite" onPress={onAccept} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: typography.body, color: colors.text, marginBottom: 16 },
});
