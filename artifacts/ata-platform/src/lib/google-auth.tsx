import React, { createContext, useContext, useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

interface GoogleAuthConfig {
  clientId: string | null;
  loading: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthConfig>({ clientId: null, loading: true });

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/google/config")
      .then((r) => r.json())
      .then((data) => setClientId(data.clientId || null))
      .catch(() => setClientId(null))
      .finally(() => setLoading(false));
  }, []);

  const value = { clientId, loading };

  if (loading || !clientId) {
    return (
      <GoogleAuthContext.Provider value={value}>
        {children}
      </GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleAuthContext.Provider value={value}>
      <GoogleOAuthProvider clientId={clientId}>
        {children}
      </GoogleOAuthProvider>
    </GoogleAuthContext.Provider>
  );
}
