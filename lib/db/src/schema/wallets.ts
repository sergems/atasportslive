import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  pendingBalance: numeric("pending_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  withdrawableBalance: numeric("withdrawable_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  bonusBalance: numeric("bonus_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
