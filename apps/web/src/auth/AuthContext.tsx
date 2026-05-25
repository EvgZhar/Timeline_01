import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import type { UserDto, AuthSettingsDto } from "@timeline/shared";

interface AuthState {
  token: string | null;
  user: UserDto | null;
  currentDataAreaId: number | null;
  settings: AuthSettingsDto | null;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, user: UserDto, currentDataAreaId: number) => void;
  setSettings: (settings: AuthSettingsDto) => void;
  setCurrentDataAreaId: (id: number) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadState(): AuthState {
  try {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    const currentDataAreaId = localStorage.getItem("currentDataAreaId");
    const settings = localStorage.getItem("authSettings");
    return {
      token,
      user: user ? JSON.parse(user) : null,
      currentDataAreaId: currentDataAreaId ? Number(currentDataAreaId) : null,
      settings: settings ? JSON.parse(settings) : null,
    };
  } catch {
    return { token: null, user: null, currentDataAreaId: null, settings: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  const setAuth = useCallback((token: string, user: UserDto, currentDataAreaId: number) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("currentDataAreaId", String(currentDataAreaId));
    setState({ token, user, currentDataAreaId, settings: null });
  }, []);

  const setSettings = useCallback((settings: AuthSettingsDto) => {
    localStorage.setItem("authSettings", JSON.stringify(settings));
    setState((prev) => ({ ...prev, settings }));
  }, []);

  const setCurrentDataAreaId = useCallback((id: number) => {
    localStorage.setItem("currentDataAreaId", String(id));
    setState((prev) => ({ ...prev, currentDataAreaId: id }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("currentDataAreaId");
    localStorage.removeItem("authSettings");
    setState({ token: null, user: null, currentDataAreaId: null, settings: null });
  }, []);

  const value: AuthContextType = {
    ...state,
    setAuth,
    setSettings,
    setCurrentDataAreaId,
    logout,
    isAuthenticated: !!state.token,
    isAdmin: state.user?.login === "admin",
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
