import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const loading = useAuthStore((s) => s.loading);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const hydrate = useAuthStore((s) => s.hydrate);

  return {
    user,
    hydrated,
    loading,
    login,
    register,
    logout,
    refreshUser,
    hydrate,
    isAuthenticated: Boolean(user?.id),
  };
}
