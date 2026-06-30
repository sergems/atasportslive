import { db, notificationsTable } from "@workspace/db";
import type { WebSocket } from "ws";

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

type NotificationType =
  | "bet_matched"
  | "near_match"
  | "deposit_received"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "stream_expiring"
  | "bet_won"
  | "bet_lost"
  | "match_result"
  | "bet_refunded"
  | "low_balance";

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
}
