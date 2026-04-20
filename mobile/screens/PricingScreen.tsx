import { Linking, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, typography } from "../constants/theme";
import { getApiBase } from "../utils/apiBase";
import type { RootStackParamList } from "../navigation/types";

export function PricingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const web = `${getApiBase()}/pricing`;

  return (
    <Screen>
      <Header title="Pricing" onBack={() => navigation.goBack()} />
      <Card>
        <Text style={styles.p}>
          Free, Pro, and Team plans match the web app. Upgrade on the website for now.
        </Text>
        <Button title="Open pricing page" onPress={() => Linking.openURL(web)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: typography.body, color: colors.text, marginBottom: 16, lineHeight: 22 },
});
