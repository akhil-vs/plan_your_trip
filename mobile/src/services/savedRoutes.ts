import AsyncStorage from "@react-native-async-storage/async-storage";
import { SavedRoute } from "../shared/types/route.types";

const SAVED_ROUTES_KEY = "plan-your-trip:saved-routes";

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const raw = await AsyncStorage.getItem(SAVED_ROUTES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedRoute[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRoute(route: SavedRoute): Promise<SavedRoute[]> {
  const existing = await getSavedRoutes();
  const updated = [route, ...existing.filter((item) => item.id !== route.id)];
  await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteRoute(routeId: string): Promise<SavedRoute[]> {
  const existing = await getSavedRoutes();
  const updated = existing.filter((item) => item.id !== routeId);
  await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));
  return updated;
}
