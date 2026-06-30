import { Router } from "express";
import { db, streamCommentsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { broadcastToStream } from "../lib/notify";

const router = Router({ mergeParams: true });

// GET /api/streams/:id/comments  — last 100 comments, oldest first
router.get("/", async (req, res): Promise<void> => {
  const streamId = parseInt((req.params as { id: string }).id);
  if (isNaN(streamId)) { res.status(400).json({ error: "Invalid stream id" }); return; }

  const rows = await db
    .select()
    .from(streamCommentsTable)
    .where(eq(streamCommentsTable.streamId, streamId))
    .orderBy(desc(streamCommentsTable.createdAt))
    .limit(100);

  res.json({ comments: rows.reverse() });
});

// POST /api/streams/:id/comments — post a comment (auth required)
router.post("/", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const streamId = parseInt((req.params as { id: string }).id);
  if (isNaN(streamId)) { res.status(400).json({ error: "Invalid stream id" }); return; }

  const content = (req.body.content ?? "").trim();
  if (!content || content.length > 280) {
    res.status(400).json({ error: "Comment must be 1–280 characters" });
    return;
  }

  const userId = req.userId!;

  const [userRow] = await db
    .select({ fullName: usersTable.fullName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const username = userRow?.fullName || userRow?.email?.split("@")[0] || `user${userId}`;

  const [comment] = await db
    .insert(streamCommentsTable)
    .values({ streamId, userId, username, content })
    .returning();

  const payload = {
    type: "stream_comment",
    comment: {
      id: comment.id,
      userId: comment.userId,
      username: comment.username,
      content: comment.content,
      createdAt: comment.createdAt,
    },
  };

  broadcastToStream(streamId, payload);
  res.status(201).json(payload.comment);
});

export default router;
