import { pgTable, serial, integer, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
  type: text("type").notNull().default("automatic"),
  bonusType: text("bonus_type").notNull().default("percentage"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  fixedAmount: numeric("fixed_amount", { precision: 12, scale: 2 }),
  minDeposit: numeric("min_deposit", { precision: 12, scale: 2 }).notNull().default("0"),
  maxBonus: numeric("max_bonus", { precision: 12, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  bannerImageUrl: text("banner_image_url"),
  termsConditions: text("terms_conditions"),
  bonusExpiryDays: integer("bonus_expiry_days"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Promotion = typeof promotionsTable.$inferSelect;

export const bonusTransactionsTable = pgTable("bonus_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  promotionId: integer("promotion_id").references(() => promotionsTable.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  description: text("description"),
  revokedBy: integer("revoked_by").references(() => usersTable.id),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BonusTransaction = typeof bonusTransactionsTable.$inferSelect;

export const promotionTermsAcceptanceTable = pgTable("promotion_terms_acceptance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  promotionId: integer("promotion_id").notNull().references(() => promotionsTable.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  version: text("version").notNull().default("1.0"),
});

export type PromotionTermsAcceptance = typeof promotionTermsAcceptanceTable.$inferSelect;
