import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed (jpeg, png, webp, gif)"));
  },
});

router.post(
  "/thumbnail",
  authMiddleware,
  requireRole("admin", "manager"),
  upload.single("thumbnail"),
  (req: AuthRequest, res): void => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  },
);

// POST /api/uploads/avatar — any authenticated user can update their own profile photo
router.post(
  "/avatar",
  authMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    const [updated] = await db
      .update(usersTable)
      .set({ avatarUrl: url })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ url, avatarUrl: url });
  },
);

export default router;
