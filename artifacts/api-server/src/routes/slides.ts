import { Router } from "express";
import { db, heroSlidesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

const toSlide = (s: typeof heroSlidesTable.$inferSelect) => ({
  id: s.id,
  title: s.title,
  subtitle: s.subtitle,
  buttonText: s.buttonText,
  buttonUrl: s.buttonUrl,
  imageUrl: s.imageUrl,
  sortOrder: s.sortOrder,
  isActive: s.isActive,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

router.get("/", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(heroSlidesTable)
    .where(eq(heroSlidesTable.isActive, true))
    .orderBy(asc(heroSlidesTable.sortOrder), asc(heroSlidesTable.createdAt));
  res.json(rows.map(toSlide));
});

router.get("/all", authMiddleware, requireRole("admin", "manager", "content_editor"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(heroSlidesTable)
    .orderBy(asc(heroSlidesTable.sortOrder), asc(heroSlidesTable.createdAt));
  res.json(rows.map(toSlide));
});

router.post("/", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const { title, subtitle, buttonText, buttonUrl, imageUrl, sortOrder, isActive } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(heroSlidesTable)
    .values({
      title,
      subtitle: subtitle ?? null,
      buttonText: buttonText ?? null,
      buttonUrl: buttonUrl ?? null,
      imageUrl: imageUrl ?? null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })
    .returning();
  res.status(201).json(toSlide(row));
});

router.patch("/:id", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, subtitle, buttonText, buttonUrl, imageUrl, sortOrder, isActive } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (buttonText !== undefined) updates.buttonText = buttonText;
  if (buttonUrl !== undefined) updates.buttonUrl = buttonUrl;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;
  const [row] = await db
    .update(heroSlidesTable)
    .set(updates)
    .where(eq(heroSlidesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Slide not found" }); return; }
  res.json(toSlide(row));
});

router.delete("/:id", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  await db.delete(heroSlidesTable).where(eq(heroSlidesTable.id, Number(req.params.id)));
  res.json({ message: "Deleted" });
});

export default router;
