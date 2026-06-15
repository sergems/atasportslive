import { pgTable, serial, numeric, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isRedeemed: boolean("is_redeemed").notNull().default(false),
  redeemedBy: integer("redeemed_by").references(() => usersTable.id),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
