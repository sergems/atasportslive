import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { broadcastToStream } from "../lib/notify";

const ALLOWED_EMOJIS = new Set(["🔥", "❤️", "💪", "👏", "😂", "🎯"]);

const router = Router({ mergeParams: true });

router.post("/", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const streamId = parseInt((req.params as { id: string }).id);
  if (isNaN(streamId)) {
    res.status(400).json({ error: "Invalid stream id" });
    return;
  }

  const { emoji } = req.body as { emoji?: string };
  if (!emoji || !ALLOWED_EMOJIS.has(emoji)) {
    res.status(400).json({ error: "Invalid emoji" });
    return;
  }

  broadcastToStream(streamId, {
    type: "stream_reaction",
    emoji,
    userId: req.userId,
  });

  res.status(200).json({ ok: true });
});

export default router;
