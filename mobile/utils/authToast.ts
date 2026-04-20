import { Alert } from "react-native";
import { getApiBase } from "./apiBase";

/** Full-screen alerts so errors are never clipped (Toast-only UX hid the real message). */
export function showAuthError(title: string, err: unknown) {
  const message = err instanceof Error ? err.message : title;
  const withBase =
    __DEV__ && !message.includes(getApiBase())
      ? `${message}\n\n(API base: ${getApiBase()})`
      : message;
  Alert.alert(title, withBase);
}
