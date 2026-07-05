import { pgTable, serial, text, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sportEnum = pgEnum("sport_type", ["pool", "boxing", "darts", "fifa", "chess", "futsal", "tournament", "other"]);
export const streamStatusEnum = pgEnum("stream_status", ["upcoming", "live", "ended", "cancelled"]);

export const streamsTable = pgTable("streams", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("single"),
  parentId: integer("parent_id"),
  title: text("title").notNull(),
  description: text("description"),
  sport: sportEnum("sport").notNull().default("pool"),
  thumbnailUrl: text("thumbnail_url"),
  hlsUrl: text("hls_url"),
  streamKey: text("stream_key"),
  status: streamStatusEnum("status").notNull().default("upcoming"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  viewerCount: integer("viewer_count").notNull().default(0),
  accessPrice: numeric("access_price", { precision: 6, scale: 2 }).notNull().default("1.50"),
  city: text("city"),
  country: text("country"),
  playerA: text("player_a"),
  playerB: text("player_b"),
  playerACountry: text("player_a_country"),
  playerBCountry: text("player_b_country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStreamSchema = createInsertSchema(streamsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Stream = typeof streamsTable.$inferSelect;
