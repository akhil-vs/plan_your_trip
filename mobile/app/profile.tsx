import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui/AppScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { env } from "@/config/env";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";
import { colors, radius, space, type } from "@/theme/tokens";

const plans: Array<"FREE" | "PRO" | "TEAM"> = ["FREE", "PRO", "TEAM"];

export default function ProfileScreen() {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { data, refetch } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [pending, setPending] = useState(false);

  return (
    <AppScreen scroll safeAreaEdges={["bottom", "left", "right"]} contentStyle={styles.scroll}>
      <SurfaceCard style={styles.identity}>
        <Text style={type.overline}>Signed in as</Text>
        <Text style={styles.name}>{data?.name?.trim() || "Traveler"}</Text>
        <Text style={styles.email}>{data?.email ?? ""}</Text>
        <View style={styles.planPill}>
          <Text style={styles.planPillText}>{data?.plan ?? "FREE"} plan</Text>
        </View>
      </SurfaceCard>

      <Text style={[styles.sectionTitle, styles.mt]}>Billing</Text>
      <SurfaceCard style={styles.card}>
        <Text style={[type.body, styles.cardCopy]}>Compare limits and upgrade on the web when you are ready.</Text>
        <PrimaryButton
          label="View pricing"
          variant="secondary"
          onPress={() => void Linking.openURL(`${env.apiBaseUrl.replace(/\/$/, "")}/pricing`)}
        />
      </SurfaceCard>

      <Text style={[styles.sectionTitle, styles.mt]}>Plan</Text>
      <SurfaceCard style={styles.card}>
        <View style={styles.planRow}>
          {plans.map((plan) => (
            <Pressable
              key={plan}
              style={[styles.planBtn, data?.plan === plan && styles.planBtnActive]}
              onPress={async () => {
                try {
                  setPending(true);
                  await api.updatePlan(plan);
                  await refetch();
                  await refreshUser();
                } catch (error) {
                  Alert.alert("Update failed", error instanceof Error ? error.message : String(error));
                } finally {
                  setPending(false);
                }
              }}
              disabled={pending}
            >
              <Text style={[styles.planLabel, data?.plan === plan && styles.planLabelActive]}>{plan}</Text>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      {data?.isAdmin ? (
        <>
          <Text style={[styles.sectionTitle, styles.mt]}>Administration</Text>
          <Link href="/admin" asChild>
            <Pressable style={styles.adminCard}>
              <Text style={styles.adminTitle}>Admin dashboard</Text>
              <Text style={styles.adminMeta}>Usage, users, and invites</Text>
            </Pressable>
          </Link>
        </>
      ) : null}

      <Link href="/trips" asChild>
        <Pressable style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back to trips</Text>
        </Pressable>
      </Link>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: space.sm },
  identity: { gap: space.sm },
  name: { fontSize: 22, fontWeight: "700", color: colors.text },
  email: { ...type.body, color: colors.textSecondary },
  planPill: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    backgroundColor: "#eff6ff",
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  planPillText: { fontSize: 12, fontWeight: "700", color: colors.brandPrimary, letterSpacing: 0.4 },
  sectionTitle: { ...type.overline, color: colors.textSecondary },
  mt: { marginTop: space.xl },
  card: { gap: space.md },
  cardCopy: { color: colors.textSecondary },
  planRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  planBtn: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  planBtnActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "#eff6ff",
  },
  planLabel: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  planLabelActive: { color: colors.brandPrimary },
  adminCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    padding: space.lg,
  },
  adminTitle: { fontSize: 16, fontWeight: "700", color: "#92400e" },
  adminMeta: { ...type.caption, color: "#a16207", marginTop: 4 },
  backLink: { marginTop: space.xxl, marginBottom: space.lg, alignSelf: "center" },
  backLinkText: { fontSize: 15, fontWeight: "600", color: colors.brandPrimary },
});
