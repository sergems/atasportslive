import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEYS = {
  access: 'ata_access_token',
  refresh: 'ata_refresh_token',
  biometrics: 'ata_biometric_enabled',
} as const;

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/** True when this device can protect secrets behind biometrics + device PIN. */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    return await SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

/** Plain (unprotected) flag — safe to read on app start before any prompt. */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEYS.biometrics)) === 'true';
  } catch {
    return false;
  }
}

export async function saveTokens(tokens: StoredTokens, protectWithBiometrics: boolean): Promise<void> {
  const protectedOptions = protectWithBiometrics ? { requireAuthentication: true as const } : {};
  await SecureStore.setItemAsync(KEYS.access, tokens.accessToken, protectedOptions);
  await SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken, protectedOptions);
  await SecureStore.setItemAsync(KEYS.biometrics, protectWithBiometrics ? 'true' : 'false');
}

/**
 * Reads tokens. If they were saved with requireAuthentication, the OS will
 * show the Face ID / fingerprint / device PIN prompt at this point.
 */
export async function readTokens(): Promise<StoredTokens | null> {
  try {
    const protect = await isBiometricEnabled();
    const options = protect ? { requireAuthentication: true as const } : {};
    const accessToken = await SecureStore.getItemAsync(KEYS.access, options);
    const refreshToken = await SecureStore.getItemAsync(KEYS.refresh, options);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    // A failed read can mean the user changed their biometrics (iOS key
    // invalidation) or cancelled the prompt. Treat as "no usable session".
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.access),
    SecureStore.deleteItemAsync(KEYS.refresh),
    SecureStore.deleteItemAsync(KEYS.biometrics),
  ]);
}

/** Explicit biometric gate used by the lock screen before reading tokens. */
export async function promptBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ATA Sports Live',
      fallbackLabel: 'Use device passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
