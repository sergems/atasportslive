import { pgTable, serial, text, timestamp, pgEnum, boolean, integer, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["guest", "user", "moderator", "content_editor", "manager", "finance", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  surname: text("surname"),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  refreshToken: text("refresh_token"),
  sessionToken: text("session_token"),
  username: text("username").unique(),
  usernameChangesCount: integer("username_changes_count").notNull().default(0),
  googleId: text("google_id").unique(),
  mustSetPassword: boolean("must_set_password").notNull().default(false),
  setPasswordNonce: text("set_password_nonce"),
  setPasswordNonceExpiry: timestamp("set_password_nonce_expiry", { withTimezone: true }),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  dateOfBirth: text("date_of_birth"),
  idType: text("id_type"),
  idNumber: text("id_number"),
  country: text("country"),
  ficaCompleted: boolean("fica_completed").notNull().default(false),
  isInfluencer: boolean("is_influencer").notNull().default(false),
  isSuperInfluencer: boolean("is_super_influencer").notNull().default(false),
  superInfluencerCommissionRate: numeric("super_influencer_commission_rate", { precision: 5, scale: 2 }),
  referralCodeCustomized: boolean("referral_code_customized").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
