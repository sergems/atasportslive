import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type AuthResponse } from '@/lib/api';
import {
  canUseBiometrics,
  clearTokens,
  isBiometricEnabled,
  promptBiometrics,
  readTokens,
  saveTokens,
  type StoredTokens,
} from '@/lib/secure-storage';

type Status = 'loading' | 'unauthenticated' | 'locked' | 'authenticated';

interface AuthContextValue {
  status: Status;
  user: AuthResponse['user'] | null;
  /** Raw access token, needed for the WebSocket chat connection. */
  accessToken: string | null;
  biometricAvailable: boolean;
  signIn: (email: string, password: string, useBiometrics: boolean) => Promise<void>;
  unlock: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (user: AuthResponse['user']) => void;
  setBiometricProtection: (enabled: boolean) => Promise<void>;
  authedFetch: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, protectedByBiometrics] = await Promise.all([canUseBiometrics(), isBiometricEnabled()]);
      if (!active) return;
      setBiometricAvailable(available);
      if (protectedByBiometrics) {
        setStatus('locked');
        return;
      }
      const stored = await readTokens();
      if (!active) return;
      if (!stored) {
        setStatus('unauthenticated');
        return;
      }
      setTokens(stored);
      try {
        setUser(await api.me(stored.accessToken));
      } catch {
        try {
          const refreshed = await api.refresh(stored.refreshToken);
          await saveTokens(refreshed, false);
          if (!active) return;
          setTokens(refreshed);
          setUser(refreshed.user);
        } catch {
          await clearTokens();
          if (!active) return;
          setTokens(null);
          setStatus('unauthenticated');
          return;
        }
      }
      setStatus('authenticated');
    })();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string, useBiometrics: boolean) => {
    const result = await api.login(email, password);
    const protect = useBiometrics && biometricAvailable;
    await saveTokens(result, protect);
    setTokens(result);
    setUser(result.user);
    setStatus('authenticated');
  }, [biometricAvailable]);

  const unlock = useCallback(async () => {
    const ok = await promptBiometrics();
    if (!ok) throw new Error('Biometric unlock was cancelled');
    const stored = await readTokens();
    if (!stored) {
      await clearTokens();
      setTokens(null);
      setStatus('unauthenticated');
      throw new Error('Your saved login is no longer valid. Please sign in again.');
    }
    setTokens(stored);
    try {
      setUser(await api.me(stored.accessToken));
    } catch {
      setUser(null);
    }
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (tokens) await api.logout(tokens.accessToken);
    } catch { /* local sign-out still proceeds */ }
    await clearTokens();
    setTokens(null);
    setUser(null);
    setStatus('unauthenticated');
  }, [tokens]);

  const refreshUser = useCallback((next: AuthResponse['user']) => setUser(next), []);

  const setBiometricProtection = useCallback(async (enabled: boolean) => {
    if (!tokens) throw new Error('Not signed in');
    if (enabled && !biometricAvailable) throw new Error('Biometrics are not available on this device');
    await saveTokens(tokens, enabled);
  }, [tokens, biometricAvailable]);

  const authedFetch = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    if (!tokens) throw new Error('Not signed in');
    try {
      return await fn(tokens.accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const refreshed = await api.refresh(tokens.refreshToken);
        await saveTokens(refreshed, await isBiometricEnabled());
        setTokens(refreshed);
        return fn(refreshed.accessToken);
      }
      throw error;
    }
  }, [tokens]);

  const value = useMemo(() => ({
    status, user, accessToken: tokens?.accessToken ?? null, biometricAvailable,
    signIn, unlock, signOut, refreshUser, setBiometricProtection, authedFetch,
  }), [status, user, tokens, biometricAvailable, signIn, unlock, signOut, refreshUser, setBiometricProtection, authedFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
