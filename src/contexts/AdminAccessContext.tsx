"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";

type AccountMe = {
  isAdmin?: boolean;
  onboardingComplete?: boolean;
};

type AdminAccessValue = {
  /** True when the signed-in user’s email is in ADMIN_EMAILS (server-checked). */
  isAdmin: boolean;
  /** True after /api/account/me has been fetched for this session (or unauthenticated resolved). */
  ready: boolean;
  /** Optional account fields from the same fetch (avoids duplicate requests elsewhere). */
  account: AccountMe | null;
  /** Call after profile/plan updates so admin flag stays accurate. */
  refresh: () => void;
};

const AdminAccessContext = createContext<AdminAccessValue | null>(null);

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<AccountMe | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const sessionAdminFallback = Boolean(session?.user?.isAdmin);

  const refresh = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      queueMicrotask(() => {
        setIsAdmin(false);
        setAccount(null);
        setReady(true);
      });
      return;
    }
    if (status === "loading") {
      queueMicrotask(() => {
        setReady(false);
      });
      return;
    }

    let cancelled = false;
    fetch("/api/account/me", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((me: AccountMe | null) => {
        if (cancelled) return;
        setAccount(me);
        // Prefer server /me (DB email + ADMIN_EMAILS). If the route fails, keep JWT/session flag so admins are not locked out.
        const fromMe = me && typeof me.isAdmin === "boolean" ? me.isAdmin : null;
        setIsAdmin(fromMe !== null ? fromMe : sessionAdminFallback);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAccount(null);
        setIsAdmin(sessionAdminFallback);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [status, fetchKey, sessionAdminFallback]);

  const value = useMemo(
    () => ({ isAdmin, ready, account, refresh }),
    [isAdmin, ready, account, refresh]
  );

  return (
    <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
  );
}

export function useAdminAccess(): AdminAccessValue {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error("useAdminAccess must be used within AdminAccessProvider");
  }
  return ctx;
}
