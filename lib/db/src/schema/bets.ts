import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { gamesTable } from "./games";

export const betOutcomeEnum = pgEnum("bet_outcome", ["player_a_wins", "player_b_wins"]);
export const betStatusEnum = pgEnum("bet_status", ["pending", "matched", "live", "won", "lost", "refunded", "cancelled"]);

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameId: integer("game_id").notNull().references(() => gamesTable.id),
  outcome: betOutcomeEnum("outcome").notNull(),
  stake: numeric("stake", { precision: 12, scale: 2 }).notNull(),
  potentialReturn: numeric("potential_return", { precision: 12, scale: 2 }).notNull().default("0"),
  status: betStatusEnum("status").notNull().default("pending"),
  matchedBetId: integer("matched_bet_id"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
