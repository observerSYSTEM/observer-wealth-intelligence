"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";

import { apiFetch } from "@/lib/api";
import type { AuthSession, SetupStatus, User } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "setup-required";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  setupStatus: SetupStatus | null;
  sessionExpired: boolean;
  refreshAuth: () => Promise<void>;
  registerOwner: (payload: Record<string, string>) => Promise<void>;
  login: (payload: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshAuth = useCallback(async () => {
    const setup = await apiFetch<SetupStatus>(
      "/api/v1/auth/setup-status",
      {},
      { retryOnUnauthorized: false }
    );
    setSetupStatus(setup);

    if (!setup.owner_exists) {
      setUser(null);
      setStatus("setup-required");
      return;
    }

    try {
      const currentUser = await apiFetch<User>("/api/v1/auth/me");
      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshAuth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAuth]);

  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(true);
      setUser(null);
      setStatus("unauthenticated");
      router.replace("/login");
    };
    window.addEventListener("owi:session-expired", onExpired);
    return () => window.removeEventListener("owi:session-expired", onExpired);
  }, [router]);

  const registerOwner = useCallback(async (payload: Record<string, string>) => {
    const session = await apiFetch<AuthSession>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setUser(session.user);
    setSetupStatus({ owner_exists: true, registration_enabled: false });
    setStatus("authenticated");
    setSessionExpired(false);
  }, []);

  const login = useCallback(async (payload: Record<string, string>) => {
    const session = await apiFetch<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setUser(session.user);
    setStatus("authenticated");
    setSessionExpired(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" }, { retryOnUnauthorized: false });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({
      status,
      user,
      setupStatus,
      sessionExpired,
      refreshAuth,
      registerOwner,
      login,
      logout,
      clearSessionExpired: () => setSessionExpired(false)
    }),
    [login, logout, refreshAuth, registerOwner, sessionExpired, setupStatus, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
