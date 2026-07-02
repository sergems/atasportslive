import { Router } from "express";
import { db, highlightsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

const toHighlight = (h: typeof highlightsTable.$inferSelect) => ({
  id: h.id,
  title: h.title,
  description: h.description,
  youtubeUrl: h.youtubeUrl,
  isPublished: h.isPublished,
  createdAt: h.createdAt,
  updatedAt: h.updatedAt,
});

router.get("/", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(highlightsTable)
    .where(eq(highlightsTable.isPublished, true))
    .orderBy(desc(highlightsTable.createdAt));
  res.json(rows.map(toHighlight));
});

router.get("/all", authMiddleware, requireRole("admin", "manager", "content_editor"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(highlightsTable).orderBy(desc(highlightsTable.createdAt));
  res.json(rows.map(toHighlight));
});

router.post("/", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const { title, description, youtubeUrl, isPublished } = req.body;
  if (!title || !youtubeUrl) {
    res.status(400).json({ error: "title and youtubeUrl are required" });
    return;
  }
  const [row] = await db
    .insert(highlightsTable)
    .values({ title, description: description || "", youtubeUrl, isPublished: isPublished ?? true })
    .returning();
  res.status(201).json(toHighlight(row));
});

router.patch("/:id", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, description, youtubeUrl, isPublished } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (youtubeUrl !== undefined) updates.youtubeUrl = youtubeUrl;
  if (isPublished !== undefined) updates.isPublished = isPublished;
  const [row] = await db.update(highlightsTable).set(updates).where(eq(highlightsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toHighlight(row));
});

router.delete("/:id", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  await db.delete(highlightsTable).where(eq(highlightsTable.id, Number(req.params.id)));
  res.json({ message: "Deleted" });
});

export default router;
