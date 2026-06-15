import { pgTable, serial, text, timestamp, numeric, integer, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameSportEnum = pgEnum("game_sport", ["pool", "boxing", "football", "athletics", "basketball"]);
export const gameStatusEnum = pgEnum("game_status", ["upcoming", "live", "completed", "cancelled"]);
export const gameResultEnum = pgEnum("game_result", ["player_a_wins", "player_b_wins", "draw"]);

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("single"),
  parentId: integer("parent_id"),
  sport: gameSportEnum("sport").notNull(),
  playerA: text("player_a").notNull(),
  playerB: text("player_b").notNull(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  eventTime: text("event_time").notNull(),
  eventEndDate: date("event_end_date", { mode: "string" }),
  eventEndTime: text("event_end_time"),
  playerACountry: text("player_a_country"),
  playerBCountry: text("player_b_country"),
  city: text("city"),
  country: text("country"),
  status: gameStatusEnum("status").notNull().default("upcoming"),
  result: gameResultEnum("result"),
  totalBetPool: numeric("total_bet_pool", { precision: 12, scale: 2 }).notNull().default("0"),
  openBetsCount: integer("open_bets_count").notNull().default(0),
  matchedBetsCount: integer("matched_bets_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
