import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { env } from "./env";

let initialized = false;

export const initSentry = () => {
  if (initialized || !env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: Constants.expoConfig?.extra?.env ?? "development",
    tracesSampleRate: 0.2,
  });
  initialized = true;
};
