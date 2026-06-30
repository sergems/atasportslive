import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const streamCommentsTable = pgTable("stream_comments", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StreamComment = typeof streamCommentsTable.$inferSelect;
