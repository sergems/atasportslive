import { Router } from "express";
import { db, usersTable, walletsTable, transactionsTable, streamsTable, betsTable, notificationsTable } from "@workspace/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/stats", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)` }).from(usersTable);
  const [{ activeUsers }] = await db.select({ activeUsers: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active"));
  const [{ totalWalletBalance }] = await db.select({ totalWalletBalance: sql<number>`sum(balance)` }).from(walletsTable);
  const [{ liveStreams }] = await db.select({ liveStreams: sql<number>`count(*)` }).from(streamsTable).where(eq(streamsTable.status, "live"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ streamingRevenue }] = await db.select({ streamingRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(eq(transactionsTable.type, "stream_access"));
  const [{ brokerageRevenue }] = await db.select({ brokerageRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(eq(transactionsTable.type, "brokerage_fee"));
  const [{ openBets }] = await db.select({ openBets: sql<number>`count(*)` }).from(betsTable).where(eq(betsTable.status, "pending"));
  const [{ matchedBets }] = await db.select({ matchedBets: sql<number>`count(*)` }).from(betsTable).where(eq(betsTable.status, "matched"));
  const [{ pendingWithdrawals }] = await db.select({ pendingWithdrawals: sql<number>`count(*)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [{ totalDepositsToday }] = await db.select({ totalDepositsToday: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, today)));
  const [{ totalWithdrawalsToday }] = await db.select({ totalWithdrawalsToday: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, today)));

  res.json({
    totalUsers: Number(totalUsers),
    activeUsers: Number(activeUsers),
    totalWalletBalance: parseFloat(totalWalletBalance as any) || 0,
    liveStreams: Number(liveStreams),
    totalRevenue: (parseFloat(streamingRevenue as any) || 0) + (parseFloat(brokerageRevenue as any) || 0),
    brokerageRevenue: parseFloat(brokerageRevenue as any) || 0,
    streamingRevenue: parseFloat(streamingRevenue as any) || 0,
    openBets: Number(openBets),
    matchedBets: Number(matchedBets),
    pendingWithdrawals: Number(pendingWithdrawals),
    totalDepositsToday: parseFloat(totalDepositsToday as any) || 0,
    totalWithdrawalsToday: parseFloat(totalWithdrawalsToday as any) || 0,
  });
});

router.get("/revenue", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";

  const data = [];
  const now = new Date();

  if (period === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  } else if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear() - i, 0, 1);
      const end = new Date(now.getFullYear() - i + 1, 0, 1);
      const label = d.getFullYear().toString();

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  }

  res.json({ period, data });
});

router.get("/activity", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  res.json(txs.map(({ tx, user }) => ({
    id: tx.id,
    type: tx.type,
    description: tx.description || `${tx.type} transaction`,
    userId: tx.userId,
    userFullName: user?.fullName || null,
    amount: parseFloat(tx.amount as string),
    createdAt: tx.createdAt,
  })));
});

router.get("/pending-withdrawals", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(txs.map(({ tx, user }) => ({
    id: tx.id,
    transactionId: tx.transactionId,
    userId: tx.userId,
    userFullName: user?.fullName || null,
    type: tx.type,
    amount: parseFloat(tx.amount as string),
    status: tx.status,
    paymentMethod: tx.paymentMethod,
    reference: tx.reference,
    description: tx.description,
    createdAt: tx.createdAt,
  })));
});

export default router;
