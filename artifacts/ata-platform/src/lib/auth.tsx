import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from './auth-store';
import { useGetMe } from '@workspace/api-client-react';
import { useLocation } from 'wouter';

// Role hierarchy — lowest to highest
export const ROLE_LEVELS: Record<string, number> = {
  user:           0,
  content_editor: 1,
  manager:        2,
  admin:          3,
};

export function getRoleLevel(role?: string): number {
  return ROLE_LEVELS[role ?? ''] ?? -1;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  /** True only for admin */
  isAdmin: boolean;
  /** True for admin or manager */
  isManager: boolean;
  /** True for admin, manager, or content_editor */
  isContentEditor: boolean;
  /** True for any role that has access to the admin panel */
  canAccessAdmin: boolean;
  /** True for admin and manager — can credit/debit/suspend other users */
  canManageUsers: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { token, user, setAuth, clearAuth, setUser } = useAuthStore();
  const [, setLocation] = useLocation();

  const { data: me, isError, error } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: ['/api/auth/me'],
      retry: false,
      staleTime: 0,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    }
  });

  useEffect(() => {
    if (me) {
      setUser(me);
    }
    if (isError && error) {
      // Only log out on definitive auth failures (401/403), not transient network or server errors
      const status = (error as any)?.status;
      if (status === 401 || status === 403) {
        clearAuth();
        setLocation('/login');
      }
    }
  }, [me, isError, error, setUser, clearAuth, setLocation]);

  const login = (newToken: string, newUser: any) => {
    setAuth(newToken, newUser);
  };

  const logout = () => {
    clearAuth();
    setLocation('/');
  };

  const role: string = user?.role ?? '';

  const value: AuthContextType = {
    isAuthenticated: !!token,
    user,
    isAdmin:        role === 'admin',
    isManager:      role === 'admin' || role === 'manager',
    isContentEditor: role === 'admin' || role === 'manager' || role === 'content_editor',
    canAccessAdmin: ['admin', 'manager', 'content_editor'].includes(role),
    canManageUsers: role === 'admin' || role === 'manager',
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
