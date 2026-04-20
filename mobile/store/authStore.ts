import { create } from "zustand";
import {
  fetchAccountMe,
  loginMobile,
  registerAccount,
  signOutLocal,
  type AccountMe,
} from "../services/auth";

type AuthState = {
  user: AccountMe | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) return;
    set({ loading: true, error: null });
    try {
      const me = await fetchAccountMe();
      set({ user: me, hydrated: true, loading: false });
    } catch {
      set({ user: null, hydrated: true, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    let signedIn = false;
    try {
      const { user } = await loginMobile(email, password);
      signedIn = true;
      try {
        const me = await fetchAccountMe();
        set({
          user: me ?? { ...user, onboardingComplete: false },
          loading: false,
        });
      } catch (profileErr) {
        await signOutLocal();
        const detail =
          profileErr instanceof Error ? profileErr.message : "Unknown error";
        throw new Error(
          `Signed in but could not load your profile: ${detail}. If this persists, the API may not accept the mobile token (check server AUTH_SECRET).`
        );
      }
    } catch (e) {
      if (signedIn) await signOutLocal();
      const msg = e instanceof Error ? e.message : "Login failed";
      set({ error: msg, loading: false });
      throw e;
    }
  },

  register: async (name, email, password) => {
    set({ loading: true, error: null });
    let signedIn = false;
    try {
      const { user } = await registerAccount(name, email, password);
      signedIn = true;
      try {
        const me = await fetchAccountMe();
        set({
          user: me ?? { ...user, onboardingComplete: false },
          loading: false,
        });
      } catch (profileErr) {
        await signOutLocal();
        const detail =
          profileErr instanceof Error ? profileErr.message : "Unknown error";
        throw new Error(
          `Signed in but could not load your profile: ${detail}. If this persists, the API may not accept the mobile token (check server AUTH_SECRET).`
        );
      }
    } catch (e) {
      if (signedIn) await signOutLocal();
      const msg = e instanceof Error ? e.message : "Registration failed";
      set({ error: msg, loading: false });
      throw e;
    }
  },

  logout: async () => {
    await signOutLocal();
    set({ user: null });
  },

  refreshUser: async () => {
    try {
      const me = await fetchAccountMe();
      set({ user: me });
    } catch {
      await get().logout();
    }
  },
}));
