import { create } from "zustand";
import { api } from "@/services/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/services/session";
import type { ApiUser } from "@/types/domain";

type AuthState = {
  bootstrapped: boolean;
  user: ApiUser | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  bootstrapped: false,
  user: null,
  loading: false,
  bootstrap: async () => {
    set({ loading: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ user: null, bootstrapped: true, loading: false });
        return;
      }
      const user = await api.me();
      set({ user, bootstrapped: true, loading: false });
    } catch {
      await clearAccessToken();
      set({ user: null, bootstrapped: true, loading: false });
    }
  },
  refreshUser: async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const user = await api.me();
      set({ user });
    } catch {
      await clearAccessToken();
      set({ user: null });
    }
  },
  signIn: async (email, password) => {
    set({ loading: true });
    const res = await api.login(email, password);
    await setAccessToken(res.token);
    const user = await api.me();
    set({ user, loading: false });
  },
  signOut: async () => {
    await clearAccessToken();
    set({ user: null });
  },
}));
