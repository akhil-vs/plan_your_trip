import { StyleSheet } from "react-native";

export const colors = {
  primary: "#1A73E8",
  primaryMuted: "#E8F0FE",
  secondary: "#5F6368",
  background: "#FFFFFF",
  surface: "#ffffff",
  card: "#F8F9FA",
  border: "#E0E3E7",
  text: "#202124",
  textSecondary: "#5F6368",
  error: "#dc2626",
  success: "#16a34a",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
};

export const typography = {
  title: 22,
  subtitle: 17,
  body: 16,
  caption: 13,
};

export const shadows = StyleSheet.create({
  card: {
    shadowColor: "#202124",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
});
