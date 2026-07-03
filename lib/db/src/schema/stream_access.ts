import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { streamsTable } from "./streams";

export const streamAccessTable = pgTable("stream_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  streamId: integer("stream_id").notNull().references(() => streamsTable.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  subscriptionType: text("subscription_type").notNull().default("daily"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStreamAccessSchema = createInsertSchema(streamAccessTable).omit({ id: true, createdAt: true });
export type InsertStreamAccess = z.infer<typeof insertStreamAccessSchema>;
export type StreamAccess = typeof streamAccessTable.$inferSelect;
