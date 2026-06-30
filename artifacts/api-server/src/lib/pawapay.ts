import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type PawapayEnvironment = "sandbox" | "production";

export interface PawapayConfig {
  apiToken: string;
  environment: PawapayEnvironment;
  currency: string;
  exchangeRate: number;
}

function baseUrl(env: PawapayEnvironment): string {
  return env === "production"
    ? "https://api.pawapay.io"
    : "https://api.sandbox.pawapay.io";
}

export async function getPawapayConfig(): Promise<PawapayConfig | null> {
  const rows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'pawapay_api_token','pawapay_environment','pawapay_currency','pawapay_exchange_rate'
    )`
  );
  const map: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }

  const token = map["pawapay_api_token"] || process.env["PAWAPAY_API_TOKEN"] || "";
  if (!token) return null;

  return {
    apiToken: token,
    environment: (map["pawapay_environment"] as PawapayEnvironment) || "sandbox",
    currency: map["pawapay_currency"] || "UGX",
    exchangeRate: parseFloat(map["pawapay_exchange_rate"] || "3700"),
  };
}

export function toMsisdn(phone: string, defaultCountryCode = "256"): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);
  if (digits.startsWith(defaultCountryCode)) return digits;
  return defaultCountryCode + digits;
}

export function providerForMethod(payoutMethod: string): string {
  if (payoutMethod === "mtn_momo") return "MTN_MOMO_UGA";
  if (payoutMethod === "airtel_money") return "AIRTEL_OAPI_UGA";
  return "";
}

export interface InitiateDepositInput {
  depositId: string;
  amount: number;
  phoneNumber: string;
  provider: string;
  callbackUrl: string;
  clientReferenceId?: string;
}

export interface DepositInitResponse {
  depositId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  failureReason?: { failureCode: string; failureMessage: string };
  created?: string;
}

export async function initiateDeposit(
  config: PawapayConfig,
  input: InitiateDepositInput
): Promise<DepositInitResponse> {
  const localAmount = (input.amount * config.exchangeRate).toFixed(0);
  const url = `${baseUrl(config.environment)}/v2/deposits`;
  const body = {
    depositId: input.depositId,
    payer: {
      type: "MMO",
      accountDetails: {
        phoneNumber: toMsisdn(input.phoneNumber),
        provider: input.provider,
      },
    },
    amount: localAmount,
    currency: config.currency,
    clientReferenceId: input.clientReferenceId || input.depositId,
    customerMessage: "ATA Platform deposit",
    metadata: [{ orderId: input.clientReferenceId || input.depositId }],
  };

  logger.info({ url, depositId: input.depositId, provider: input.provider }, "PawaPay initiateDeposit");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as DepositInitResponse & { message?: string };
  if (!res.ok || (data.status !== "ACCEPTED" && data.status !== "DUPLICATE_IGNORED")) {
    logger.error({ data, status: res.status }, "PawaPay initiateDeposit failed");
    throw new Error(data.failureReason?.failureMessage || data.message || "PawaPay deposit initiation failed");
  }
  return data;
}

export interface DepositStatusData {
  depositId: string;
  status: "COMPLETED" | "FAILED" | "PENDING" | "IN_RECONCILIATION" | "CANCELLED";
  amount: string;
  currency: string;
  failureReason?: { failureCode: string; failureMessage: string };
  providerTransactionId?: string;
  payer?: { type: string; accountDetails: { phoneNumber: string; provider: string } };
}

export async function getDepositStatus(
  config: PawapayConfig,
  depositId: string
): Promise<DepositStatusData | null> {
  const url = `${baseUrl(config.environment)}/v2/deposits/${encodeURIComponent(depositId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (res.status === 404) return null;
  const data = (await res.json()) as { status: string; data?: DepositStatusData };
  if (!res.ok) {
    logger.error({ data }, "PawaPay getDepositStatus failed");
    throw new Error("PawaPay status check failed");
  }
  return data.data ?? null;
}

export interface InitiatePayoutInput {
  payoutId: string;
  amount: number;
  phoneNumber: string;
  provider: string;
}

export interface PayoutInitResponse {
  payoutId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  failureReason?: { failureCode: string; failureMessage: string };
  created?: string;
}

export async function initiatePayout(
  config: PawapayConfig,
  input: InitiatePayoutInput
): Promise<PayoutInitResponse> {
  const localAmount = (input.amount * config.exchangeRate).toFixed(0);
  const url = `${baseUrl(config.environment)}/v2/payouts`;
  const body: Record<string, unknown> = {
    payoutId: input.payoutId,
    amount: localAmount,
    currency: config.currency,
    recipient: {
      type: "MMO",
      accountDetails: {
        phoneNumber: toMsisdn(input.phoneNumber),
        provider: input.provider,
      },
    },
  };

  logger.info({ url, payoutId: input.payoutId, provider: input.provider }, "PawaPay initiatePayout");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as PayoutInitResponse & { message?: string };
  if (!res.ok || (data.status !== "ACCEPTED" && data.status !== "DUPLICATE_IGNORED")) {
    logger.error({ data, status: res.status }, "PawaPay initiatePayout failed");
    throw new Error(data.failureReason?.failureMessage || data.message || "PawaPay payout initiation failed");
  }
  return data;
}

export interface PayoutStatusData {
  payoutId: string;
  status: "COMPLETED" | "FAILED" | "PENDING" | "IN_RECONCILIATION" | "CANCELLED" | "ENQUEUED";
  amount: string;
  currency: string;
  failureReason?: { failureCode: string; failureMessage: string };
  providerTransactionId?: string;
}

export async function getPayoutStatus(
  config: PawapayConfig,
  payoutId: string
): Promise<PayoutStatusData | null> {
  const url = `${baseUrl(config.environment)}/v2/payouts/${encodeURIComponent(payoutId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (res.status === 404) return null;
  const data = (await res.json()) as { status: string; data?: PayoutStatusData };
  if (!res.ok) throw new Error("PawaPay payout status check failed");
  return data.data ?? null;
}
