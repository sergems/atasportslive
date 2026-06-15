import { Router } from "express";
import { db, announcementsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

const toAnnouncement = (a: typeof announcementsTable.$inferSelect) => ({
  id: a.id,
  title: a.title,
  content: a.content,
  isActive: a.isActive,
  priority: a.priority,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

router.get("/", async (_req, res): Promise<void> => {
  const rows = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.priority), desc(announcementsTable.createdAt));
  res.json(rows.map(toAnnouncement));
});

router.get("/active", async (_req, res): Promise<void> => {
  const rows = await db.select().from(announcementsTable)
    .where(eq(announcementsTable.isActive, true))
    .orderBy(desc(announcementsTable.priority), desc(announcementsTable.createdAt));
  res.json(rows.map(toAnnouncement));
});

router.post("/", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const { title, content, isActive, priority } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: "title and content required" });
    return;
  }
  const [row] = await db.insert(announcementsTable).values({
    title,
    content,
    isActive: isActive ?? true,
    priority: priority ?? 0,
  }).returning();
  res.status(201).json(toAnnouncement(row));
});

router.patch("/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, content, isActive, priority } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (isActive !== undefined) updates.isActive = isActive;
  if (priority !== undefined) updates.priority = priority;
  const [row] = await db.update(announcementsTable).set(updates).where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toAnnouncement(row));
});

router.delete("/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  await db.delete(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
  res.json({ message: "Deleted" });
});

export default router;
