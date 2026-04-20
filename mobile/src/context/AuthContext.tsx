import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import {
  fetchAccountMe,
  loginMobile,
  registerAccount,
  signOutLocal,
  skipOnboarding,
  type AccountMe,
} from "../services/backend/auth";

type AuthState = {
  user: AccountMe | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
};

type AuthAction =
  | { type: "HYDRATE_START" }
  | { type: "HYDRATE_DONE"; payload: AccountMe | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_USER"; payload: AccountMe | null };

const initialAuthState: AuthState = {
  user: null,
  hydrated: false,
  loading: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "HYDRATE_START":
      return { ...state, loading: true, error: null };
    case "HYDRATE_DONE":
      return { ...state, user: action.payload, hydrated: true, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_USER":
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  const hydrate = useCallback(async () => {
    dispatch({ type: "HYDRATE_START" });
    try {
      const me = await fetchAccountMe();
      dispatch({ type: "HYDRATE_DONE", payload: me });
    } catch {
      dispatch({ type: "HYDRATE_DONE", payload: null });
    }
  }, []);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    let signedIn = false;
    try {
      const { user } = await loginMobile(email, password);
      signedIn = true;
      try {
        const me = await fetchAccountMe();
        dispatch({ type: "SET_USER", payload: me ?? { ...user, onboardingComplete: false } });
      } catch (profileErr) {
        await signOutLocal();
        const detail = profileErr instanceof Error ? profileErr.message : "Unknown error";
        throw new Error(`Signed in but could not load your profile: ${detail}`);
      }
    } catch (e) {
      if (signedIn) {
        await signOutLocal();
      }
      const msg = e instanceof Error ? e.message : "Login failed";
      dispatch({ type: "SET_ERROR", payload: msg });
      throw e;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    let signedIn = false;
    try {
      const { user } = await registerAccount(name, email, password);
      signedIn = true;
      try {
        const me = await fetchAccountMe();
        dispatch({ type: "SET_USER", payload: me ?? { ...user, onboardingComplete: false } });
      } catch (profileErr) {
        await signOutLocal();
        const detail = profileErr instanceof Error ? profileErr.message : "Unknown error";
        throw new Error(`Signed in but could not load your profile: ${detail}`);
      }
    } catch (e) {
      if (signedIn) {
        await signOutLocal();
      }
      const msg = e instanceof Error ? e.message : "Registration failed";
      dispatch({ type: "SET_ERROR", payload: msg });
      throw e;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const logout = useCallback(async () => {
    await signOutLocal();
    dispatch({ type: "SET_USER", payload: null });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchAccountMe();
      dispatch({ type: "SET_USER", payload: me });
    } catch {
      await signOutLocal();
      dispatch({ type: "SET_USER", payload: null });
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    await skipOnboarding();
    await refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({ state, login, register, logout, refreshUser, completeOnboarding }),
    [state, login, register, logout, refreshUser, completeOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
