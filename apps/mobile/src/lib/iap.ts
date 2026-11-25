import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { PURCHASE_TYPE } from 'react-native-purchases';

/** Google Play consumables created in RevenueCat (and in Play Console). */
export const CREDIT_PRODUCTS = [
  { id: 'ata_credit_1', amount: 1 },
  { id: 'ata_credit_2', amount: 2 },
  { id: 'ata_credit_5', amount: 5 },
  { id: 'ata_credit_10', amount: 10 },
  { id: 'ata_credit_20', amount: 20 },
  { id: 'ata_credit_50', amount: 50 },
] as const;

export type CreditProduct = typeof CREDIT_PRODUCTS[number];

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
let configured = false;
let currentUser: string | null = null;

/**
 * Real purchases require a native Android build with the Revenuecat SDK.
 * Expo Go runs the SDK in mock mode, so never offer a real charge there.
 */
export function isIapAvailable(): boolean {
  return Platform.OS === 'android' && !Constants.expoVersion && !!API_KEY;
}

export async function syncIapUser(userId: number | string | undefined): Promise<void> {
  if (!isIapAvailable() || !userId) return;
  const appUserId = String(userId);
  if (!configured) {
    void Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: API_KEY!, appUserID: appUserId });
    configured = true;
    currentUser = appUserId;
    return;
  }
  if (currentUser !== appUserId) {
    await Purchases.logIn(appUserId);
    currentUser = appUserId;
  }
}

/** Fetch live prices from Google Play/RevenueCat. Falls back to fixed tiers offline. */
export async function getCreditProducts(): Promise<CreditProduct[]> {
  if (!isIapAvailable()) return [...CREDIT_PRODUCTS];
  try {
    const products = await Purchases.getProducts(CREDIT_PRODUCTS.map((p) => p.id), PURCHASE_TYPE.INAPP);
    const found = new Set(products.map((p) => p.identifier));
    if (found.size === 0) return [...CREDIT_PRODUCTS];
    return CREDIT_PRODUCTS.filter((p) => found.has(p.id));
  } catch {
    return [...CREDIT_PRODUCTS];
  }
}

/** Purchase a credit top-up. Wallet crediting happens on the server via webhook. */
export async function purchaseCredit(productId: string): Promise<void> {
  if (!isIapAvailable()) throw new Error('Install the Android app to make purchases');
  const result = await Purchases.purchaseProduct(productId);
  if (!result?.productIdentifier) throw new Error('Purchase was not completed');
}
