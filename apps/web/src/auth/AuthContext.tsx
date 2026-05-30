import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from "react";
import type { UserDto, AuthSettingsDto } from "@timeline/shared";
import { api } from "../api/client";

interface AuthState {
  user: UserDto | null;
  currentDataAreaId: number | null;
  settings: AuthSettingsDto | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  setAuth: (user: UserDto, currentDataAreaId: number) => void;
  setSettings: (settings: AuthSettingsDto) => void;
  setCurrentDataAreaId: (id: number) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadState(): Omit<AuthState, "isLoading"> {
  try {
    const user = localStorage.getItem("user");
    const currentDataAreaId = localStorage.getItem("currentDataAreaId");
    const settings = localStorage.getItem("authSettings");
    return {
      user: user ? JSON.parse(user) : null,
      currentDataAreaId: currentDataAreaId ? Number(currentDataAreaId) : null,
      settings: settings ? JSON.parse(settings) : null,
    };
  } catch {
    return { user: null, currentDataAreaId: null, settings: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...loadState(), isLoading: true });

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const user = await api.auth.me();
        const settings = await api.auth.getSettings();
        if (!cancelled) {
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("currentDataAreaId", String(settings.currentDataAreaId));
          localStorage.setItem("authSettings", JSON.stringify(settings));
          setState({ user, currentDataAreaId: settings.currentDataAreaId, settings, isLoading: false });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const setAuth = useCallback((user: UserDto, currentDataAreaId: number) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("currentDataAreaId", String(currentDataAreaId));
    setState((prev) => ({ ...prev, user, currentDataAreaId }));
  }, []);

  const setSettings = useCallback((settings: AuthSettingsDto) => {
    localStorage.setItem("authSettings", JSON.stringify(settings));
    setState((prev) => ({ ...prev, settings }));
  }, []);

  const setCurrentDataAreaId = useCallback((id: number) => {
    localStorage.setItem("currentDataAreaId", String(id));
    setState((prev) => ({ ...prev, currentDataAreaId: id }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch { /* ignore */ }
    localStorage.removeItem("user");
    localStorage.removeItem("currentDataAreaId");
    localStorage.removeItem("authSettings");
    setState({ user: null, currentDataAreaId: null, settings: null, isLoading: false });
  }, []);

  const value: AuthContextType = {
    ...state,
    setAuth,
    setSettings,
    setCurrentDataAreaId,
    logout,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.login === "admin",
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
