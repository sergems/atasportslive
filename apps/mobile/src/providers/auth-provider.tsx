import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type AuthResponse } from '@/lib/api';
import {
  canUseBiometrics,
  clearTokens,
  isBiometricEnabled,
  promptBiometrics,
  readAccessTokenRaw,
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
  register: (data: { email: string; username: string; password: string; fullName: string; phone?: string; referralCode?: string }) => Promise<void>;
  unlock: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (user: AuthResponse['user']) => void;
  setBiometricProtection: (enabled: boolean) => Promise<void>;
  authedFetch: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * One refresh at a time. The backend rotates the refresh token on every call,
 * so concurrent 401s must share a single result instead of racing with a
 * stale token (which logs the user out).
 */
let refreshInFlight: Promise<AuthResponse> | null = null;
function refreshSession(refreshToken: string): Promise<AuthResponse> {
  if (!refreshInFlight) {
    refreshInFlight = api.refresh(refreshToken).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [tokens, setTokensState] = useState<StoredTokens | null>(null);
  const tokensRef = useRef<StoredTokens | null>(null);
  /** Access token kept only for server-side logout from the lock screen. */
  const logoutTokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const setTokens = useCallback((next: StoredTokens | null) => {
    tokensRef.current = next;
    setTokensState(next);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, protectedByBiometrics] = await Promise.all([canUseBiometrics(), isBiometricEnabled()]);
      if (!active) return;
      setBiometricAvailable(available);
      if (protectedByBiometrics) {
        // Keep just the access token in memory so "Use email instead" can
        // still revoke the session on the server without a biometric prompt.
        logoutTokenRef.current = await readAccessTokenRaw();
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
          const refreshed = await refreshSession(stored.refreshToken);
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
  }, [setTokens]);

  const signIn = useCallback(async (email: string, password: string, useBiometrics: boolean) => {
    const result = await api.login(email, password);
    const protect = useBiometrics && biometricAvailable;
    await saveTokens(result, protect);
    setTokens(result);
    setUser(result.user);
    setStatus('authenticated');
  }, [biometricAvailable, setTokens]);

  const register = useCallback(async (data: { email: string; username: string; password: string; fullName: string; phone?: string; referralCode?: string }) => {
    const result = await api.register(data);
    await saveTokens(result, false);
    setTokens(result);
    setUser(result.user);
    setStatus('authenticated');
  }, [setTokens]);

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
    logoutTokenRef.current = null;
    try {
      setUser(await api.me(stored.accessToken));
    } catch {
      setUser(null);
    }
    setStatus('authenticated');
  }, [setTokens]);

  const signOut = useCallback(async () => {
    const accessToken = tokensRef.current?.accessToken ?? logoutTokenRef.current;
    try {
      if (accessToken) await api.logout(accessToken);
    } catch { /* local sign-out still proceeds */ }
    logoutTokenRef.current = null;
    await clearTokens();
    setTokens(null);
    setUser(null);
    setStatus('unauthenticated');
  }, [setTokens]);

  const refreshUser = useCallback((next: AuthResponse['user']) => setUser(next), []);

  const setBiometricProtection = useCallback(async (enabled: boolean) => {
    if (!tokens) throw new Error('Not signed in');
    if (enabled && !biometricAvailable) throw new Error('Biometrics are not available on this device');
    await saveTokens(tokens, enabled);
  }, [tokens, biometricAvailable]);

  const authedFetch = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const current = tokensRef.current;
    if (!current) throw new Error('Not signed in');
    try {
      return await fn(current.accessToken);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      try {
        const refreshed = await refreshSession(current.refreshToken);
        await saveTokens(refreshed, await isBiometricEnabled());
        setTokens(refreshed);
        setUser(refreshed.user);
        return await fn(refreshed.accessToken);
      } catch (refreshError) {
        // A rejected refresh means the session is gone — don't leave the app
        // stuck in "authenticated" with a token that can never work again.
        await clearTokens().catch(() => {});
        setTokens(null);
        setUser(null);
        setStatus('unauthenticated');
        throw refreshError;
      }
    }
  }, [setTokens]);

  const value = useMemo(() => ({
    status, user, accessToken: tokens?.accessToken ?? null, biometricAvailable,
    signIn, register, unlock, signOut, refreshUser, setBiometricProtection, authedFetch,
  }), [status, user, tokens, biometricAvailable, signIn, register, unlock, signOut, refreshUser, setBiometricProtection, authedFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
