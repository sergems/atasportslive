import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from './auth-store';
import { useGetMe } from '@workspace/api-client-react';
import { useLocation } from 'wouter';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  isAdmin: boolean;
  isModerator: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { token, user, setAuth, clearAuth, setUser } = useAuthStore();
  const [, setLocation] = useLocation();

  const { data: me, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: ['/api/auth/me'],
      retry: false,
    }
  });

  useEffect(() => {
    if (me) {
      setUser(me);
    }
    if (isError) {
      clearAuth();
    }
  }, [me, isError, setUser, clearAuth]);

  const login = (newToken: string, newUser: any) => {
    setAuth(newToken, newUser);
  };

  const logout = () => {
    clearAuth();
    setLocation('/login');
  };

  const value = {
    isAuthenticated: !!token,
    user,
    isAdmin: user?.role === 'admin',
    isModerator: user?.role === 'moderator' || user?.role === 'admin',
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
