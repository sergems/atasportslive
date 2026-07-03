import { pgTable, serial, integer, timestamp, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const platformSubscriptionsTable = pgTable("platform_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  subscriptionType: text("subscription_type").notNull().default("daily"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  transactionId: text("transaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlatformSubscriptionSchema = createInsertSchema(platformSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertPlatformSubscription = z.infer<typeof insertPlatformSubscriptionSchema>;
export type PlatformSubscription = typeof platformSubscriptionsTable.$inferSelect;
