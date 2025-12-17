import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStoredToken, login as apiLogin, logout as apiLogout, clearStoredToken } from "@/lib/salesApi/client";
import type { LoginCredentials } from "@/lib/salesApi/types";

interface SalesAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const SalesAuthContext = createContext<SalesAuthContextType | undefined>(undefined);

export function SalesAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = getStoredToken();
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiLogin(credentials);
      setIsAuthenticated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return (
    <SalesAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        error,
      }}
    >
      {children}
    </SalesAuthContext.Provider>
  );
}

export function useSalesAuth() {
  const context = useContext(SalesAuthContext);
  if (context === undefined) {
    throw new Error("useSalesAuth must be used within a SalesAuthProvider");
  }
  return context;
}
