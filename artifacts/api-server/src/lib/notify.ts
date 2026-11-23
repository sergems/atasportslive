import { db, notificationsTable } from "@workspace/db";
import type { InferInsertModel } from "drizzle-orm";
import type { WebSocket } from "ws";
import { sendPushToUser } from "./push";

export const wsClients = new Map<number, WebSocket>();
export const wsStreamClients = new Map<number, Set<WebSocket>>();

export function broadcastToStream(streamId: number, message: object): void {
  const clients = wsStreamClients.get(streamId);
  if (!clients) return;
  const payload = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

type NotificationType = InferInsertModel<typeof notificationsTable>["type"];

export async function notify(
  userId: number,
  type: NotificationType,
  title: string,
  message: string
): Promise<void> {
  const [notification] = await db
    .insert(notificationsTable)
    .values({ userId, type, title, message, read: false })
    .returning();

  const ws = wsClients.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type, title, message, id: notification.id }));
  }

  // Free FCM push to the user's devices (no-op until Firebase is configured).
  void sendPushToUser(userId, {
    title,
    body: message,
    url: "/(tabs)/more/dashboard",
    data: { notificationId: String(notification.id), type },
  });
}
