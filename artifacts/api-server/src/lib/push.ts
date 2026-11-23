import { initializeApp, getApps, cert, applicationDefault, type ServiceAccount, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { db, pushTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Free push delivery via Firebase Cloud Messaging.
 * Configure FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON) or
 * FIREBASE_SERVICE_ACCOUNT_PATH (path to the JSON file). When neither is set,
 * push is a no-op so installs without Firebase keep working.
 */
function getApp(): App | null {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let credential;
  try {
    if (raw) credential = cert(JSON.parse(raw) as ServiceAccount);
    else if (file) credential = cert(require(file) as ServiceAccount);
    else credential = applicationDefault();
  } catch (err) {
    logger.warn({ err }, "invalid Firebase credentials, push disabled");
    return null;
  }
  try {
    return initializeApp({ credential });
  } catch (err) {
    logger.warn({ err }, "Firebase init failed, push disabled");
    return null;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  /** Optional in-app route, e.g. "/(tabs)/live". */
  url?: string;
  data?: Record<string, string>;
};

function toFcmData(payload: PushPayload, userId: number): Record<string, string> {
  const data: Record<string, string> = { ...(payload.data ?? {}) };
  if (payload.url) data.url = payload.url;
  data.userId = String(userId);
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)]),
  );
}

async function dispatch(tokens: string[], payload: PushPayload, userIds: number[]): Promise<void> {
  const app = getApp();
  if (!app || tokens.length === 0) return;

  // FCM accepts up to 500 tokens per multicast message.
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const result = await getMessaging(app).sendEachForMulticast({
        notification: { title: payload.title, body: payload.body },
        data: toFcmData(payload, userIds[i] ?? 0),
        tokens: chunk,
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
      });

      const invalid = result.responses
        .map((response, idx) => ({ response, token: chunk[idx]! }))
        .filter(({ response }) => !response.success &&
          ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]
            .includes(response.error?.code ?? ""))
        .map(({ token }) => token);
      if (invalid.length) {
        await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, invalid));
      }
    } catch (err) {
      logger.warn({ err }, "FCM send failed");
    }
  }
}

/** Send a push to every registered device of one user. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  try {
    const rows = await db.select({ token: pushTokensTable.token }).from(pushTokensTable).where(eq(pushTokensTable.userId, userId));
    await dispatch(rows.map((r) => r.token), payload, rows.map(() => userId));
  } catch (err) {
    logger.warn({ err }, "push lookup failed");
  }
}

/** Send a push to all registered devices (e.g. when a channel goes live). */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  try {
    const rows = await db.select({ token: pushTokensTable.token, userId: pushTokensTable.userId }).from(pushTokensTable);
    await dispatch(rows.map((r) => r.token), payload, rows.map((r) => r.userId));
  } catch (err) {
    logger.warn({ err }, "push lookup failed");
  }
}
