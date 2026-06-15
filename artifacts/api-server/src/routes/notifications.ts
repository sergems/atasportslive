import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const unreadOnly = req.query.unreadOnly === "true";
  const offset = (page - 1) * limit;
  const userId = req.userId!;

  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.read, false));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(and(...conditions));
  const [{ unreadCount }] = await db.select({ unreadCount: sql<number>`count(*)` }).from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ notifications, total: Number(count), unreadCount: Number(unreadCount), page, limit });
});

router.patch("/:id/read", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [notification] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.userId, req.userId!)))
    .returning();
  res.json(notification);
});

router.patch("/read-all", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, req.userId!));
  res.json({ message: "All notifications marked as read" });
});

export default router;
