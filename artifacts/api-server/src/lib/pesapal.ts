import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type PesapalEnvironment = "sandbox" | "live";

export interface PesapalConfig {
  consumerKey: string;
  consumerSecret: string;
  environment: PesapalEnvironment;
  currency: string;
  ipnId?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

const tokenCache: Record<string, TokenCache> = {};

function baseUrl(env: PesapalEnvironment) {
  return env === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";
}

export async function getPesapalConfig(): Promise<PesapalConfig | null> {
  const rows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN ('pesapal_consumer_key','pesapal_consumer_secret','pesapal_environment','pesapal_currency','pesapal_ipn_id')`
  );
  const map: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }

  const key = map["pesapal_consumer_key"] || process.env["PESAPAL_CONSUMER_KEY"] || "";
  const secret = map["pesapal_consumer_secret"] || process.env["PESAPAL_CONSUMER_SECRET"] || "";

  if (!key || !secret) return null;

  return {
    consumerKey: key,
    consumerSecret: secret,
    environment: (map["pesapal_environment"] as PesapalEnvironment) || "live",
    currency: map["pesapal_currency"] || "UGX",
    ipnId: map["pesapal_ipn_id"] || undefined,
  };
}

export async function getAccessToken(config: PesapalConfig): Promise<string> {
  const cacheKey = `${config.consumerKey}:${config.environment}`;
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.token;
  }

  const url = `${baseUrl(config.environment)}/api/Auth/RequestToken`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: config.consumerKey, consumer_secret: config.consumerSecret }),
  });

  const data = (await res.json()) as { token?: string; expiryDate?: string; error?: unknown; status?: string };
  if (!res.ok || !data.token) {
    logger.error({ data }, "Pesapal auth failed");
    throw new Error("Pesapal authentication failed");
  }

  const expiresAt = data.expiryDate ? new Date(data.expiryDate).getTime() : Date.now() + 4.5 * 60 * 1000;
  tokenCache[cacheKey] = { token: data.token, expiresAt };
  return data.token;
}

export async function ensureIPN(config: PesapalConfig, token: string, ipnUrl: string): Promise<string> {
  if (config.ipnId) return config.ipnId;

  const url = `${baseUrl(config.environment)}/api/URLSetup/RegisterIPN`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });

  const data = (await res.json()) as { ipn_id?: string; error?: unknown; status?: string };
  if (!res.ok || !data.ipn_id) {
    logger.error({ data }, "Pesapal IPN registration failed");
    throw new Error("Pesapal IPN registration failed");
  }

  await db.execute(
    sql`INSERT INTO settings (key, value, updated_at) VALUES ('pesapal_ipn_id', ${data.ipn_id}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  );

  logger.info({ ipnId: data.ipn_id }, "Pesapal IPN registered");
  return data.ipn_id;
}

export interface SubmitOrderInput {
  merchantRef: string;
  amount: number;
  callbackUrl: string;
  notificationId: string;
  currency: string;
  description?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface SubmitOrderResult {
  orderTrackingId: string;
  merchantReference: string;
  redirectUrl: string;
}

export async function submitOrder(
  config: PesapalConfig,
  token: string,
  input: SubmitOrderInput
): Promise<SubmitOrderResult> {
  const url = `${baseUrl(config.environment)}/api/Transactions/SubmitOrderRequest`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: input.merchantRef,
      currency: input.currency,
      amount: input.amount,
      description: input.description || `ATA wallet deposit ${input.merchantRef}`,
      callback_url: input.callbackUrl,
      redirect_mode: "TOP_WINDOW",
      notification_id: input.notificationId,
      billing_address: {
        email_address: input.email || "",
        phone_number: input.phone || "",
        country_code: "UG",
        first_name: input.firstName || "",
        last_name: input.lastName || "",
      },
    }),
  });

  const data = (await res.json()) as {
    order_tracking_id?: string;
    merchant_reference?: string;
    redirect_url?: string;
    error?: unknown;
    status?: string;
  };

  if (!res.ok || !data.redirect_url) {
    logger.error({ data }, "Pesapal SubmitOrderRequest failed");
    throw new Error("Pesapal order submission failed");
  }

  return {
    orderTrackingId: data.order_tracking_id!,
    merchantReference: data.merchant_reference!,
    redirectUrl: data.redirect_url,
  };
}

export interface TransactionStatus {
  paymentMethod: string;
  amount: number;
  currency: string;
  confirmationCode: string;
  statusCode: number;
  merchantReference: string;
  paymentAccount: string;
  message: string;
}

// Raw snake_case shape returned by Pesapal API
interface PesapalStatusRaw {
  payment_method?: string;
  amount?: number;
  currency?: string;
  confirmation_code?: string;
  status_code?: number;
  merchant_reference?: string;
  payment_account?: string;
  message?: string;
  error?: unknown;
  status?: string;
}

export async function getTransactionStatus(
  config: PesapalConfig,
  token: string,
  orderTrackingId: string
): Promise<TransactionStatus> {
  const url = `${baseUrl(config.environment)}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  const data = (await res.json()) as PesapalStatusRaw;
  if (!res.ok) {
    logger.error({ data }, "Pesapal GetTransactionStatus failed");
    throw new Error("Pesapal status check failed");
  }

  // Map snake_case API response → camelCase interface
  return {
    paymentMethod: data.payment_method ?? "",
    amount: data.amount ?? 0,
    currency: data.currency ?? "",
    confirmationCode: data.confirmation_code ?? "",
    statusCode: data.status_code ?? -1,
    merchantReference: data.merchant_reference ?? "",
    paymentAccount: data.payment_account ?? "",
    message: data.message ?? "",
  };
}
