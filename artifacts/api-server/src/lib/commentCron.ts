import { db, streamCommentsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 2 * 60 * 60 * 1000; // run every 2 hours

async function deleteExpiredComments(): Promise<void> {
  const cutoff = new Date(Date.now() - SIX_HOURS_MS);
  const deleted = await db
    .delete(streamCommentsTable)
    .where(lt(streamCommentsTable.createdAt, cutoff))
    .returning({ id: streamCommentsTable.id });

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Deleted expired stream comments (>6h old)");
  }
}

export function startCommentCron(): void {
  logger.info("Comment expiry cron started");

  let running = false;

  const tick = () => {
    if (running) {
      logger.warn("Comment expiry cron: previous run still in progress, skipping");
      return;
    }
    running = true;
    deleteExpiredComments()
      .catch((err) => logger.error({ err }, "Comment expiry run failed"))
      .finally(() => { running = false; });
  };

  tick();

  setInterval(tick, RUN_INTERVAL_MS);
}
