import { Router } from "express";
import { db, transactionsTable, streamAccessTable, betsTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

function getDateRange(period: string, from?: string, to?: string): { start: Date; end: Date; labels: string[] } {
  const now = new Date();
  const labels: string[] = [];
  let start: Date;
  let end = to ? new Date(to) : now;

  if (from) {
    start = new Date(from);
    return { start, end, labels: [] };
  }

  if (period === "daily") {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" }));
    }
  } else if (period === "weekly") {
    start = new Date(now);
    start.setDate(now.getDate() - 28);
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      labels.push(`Week of ${d.toLocaleDateString()}`);
    }
  } else if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString("default", { month: "short", year: "2-digit" }));
    }
  } else {
    start = new Date(now.getFullYear() - 3, 0, 1);
    for (let i = 3; i >= 0; i--) {
      labels.push((now.getFullYear() - i).toString());
    }
  }
  return { start, end, labels };
}

router.get("/streaming", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);

  const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, start)));
  const [{ totalAccesses }] = await db.select({ totalAccesses: sql<number>`count(*)` }).from(streamAccessTable).where(gte(streamAccessTable.createdAt, start));

  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, totalRevenue: parseFloat(totalRevenue as any) || 0, totalAccesses: Number(totalAccesses), data });
});

router.get("/betting", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);

  const [{ brokerageRevenue }] = await db.select({ brokerageRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, start)));
  const [{ totalBetsPlaced }] = await db.select({ totalBetsPlaced: sql<number>`count(*)` }).from(betsTable).where(gte(betsTable.createdAt, start));
  const [{ totalBetsMatched }] = await db.select({ totalBetsMatched: sql<number>`count(*)` }).from(betsTable).where(and(eq(betsTable.status, "matched"), gte(betsTable.createdAt, start)));
  const [{ totalBetPool }] = await db.select({ totalBetPool: sql<number>`coalesce(sum(stake::numeric), 0)` }).from(betsTable).where(gte(betsTable.createdAt, start));

  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, brokerageRevenue: parseFloat(brokerageRevenue as any) || 0, totalBetsPlaced: Number(totalBetsPlaced), totalBetsMatched: Number(totalBetsMatched), totalBetPool: parseFloat(totalBetPool as any) || 0, data });
});

router.get("/wallets", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);

  const [{ totalDeposits }] = await db.select({ totalDeposits: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, start)));
  const [{ totalWithdrawals }] = await db.select({ totalWithdrawals: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, start)));

  const dep = parseFloat(totalDeposits as any) || 0;
  const wit = parseFloat(totalWithdrawals as any) || 0;
  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, totalDeposits: dep, totalWithdrawals: wit, netFlow: dep - wit, data });
});

export default router;
