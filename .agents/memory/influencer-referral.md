---
name: Influencer Referral Program
description: Architecture and key decisions for the influencer commission feature
---

## Implementation Pattern
- `isInfluencer` boolean on `users` table (not a new role) — influencers keep regular user access
- Influencer code replaces existing `referralCode` with `INF`-prefixed format on promotion; reverts to plain code on demotion
- Commission stored in `settings` table under key `influencer_commission_rate` (default: 30)
- Commission type: `influencer_commission` added to `transactionTypeEnum`

## Commission Flow (ATOMIC)
- Pre-transaction: fetch buyer's `referredBy`, check if referrer `isInfluencer`, compute commission amount from settings
- Inside the main DB transaction: credit wallet + insert `influencer_commission` transaction atomically
- Post-transaction: fire-and-forget notify only (never blocks purchase)
- **Why:** Commission and subscription purchase must succeed or fail together; ledger integrity

## PII Policy
- Influencer-facing `/api/influencers/my-referrals` intentionally excludes referral `email` (PII exposure risk)
- Admin endpoints DO include email since admins already have access

## Super Influencer Extension
- `isSuperInfluencer` boolean + `superInfluencerCommissionRate` NUMERIC(5,2) columns added to `users`
- Super Influencers get a `SINF`-prefixed referral code; demoting reverts to `INF`-prefix (stays regular influencer)
- Promoting to Super also sets `isInfluencer = true` automatically
- Commission logic in `subscriptions.ts`: if referrer `isSuperInfluencer` AND `superInfluencerCommissionRate` is set → use personal rate; else fall back to global `influencer_commission_rate` setting
- Crown (👑) button in admin users table toggles super influencer status; star button is disabled while user is super influencer
- Rate editor is inline on the influencers list — click the rate text to edit per-super-influencer percentage

## API Routes
- `GET /api/influencers/my-referrals` — influencer's referral list + stats
- `GET /api/influencers/my-commission-history` — paginated commission history
- `PATCH /api/admin/users/:id/set-influencer` — toggle influencer status
- `PATCH /api/admin/users/:id/set-super-influencer` — toggle super influencer status
- `PATCH /api/admin/users/:id/super-influencer-rate` — set personalised commission rate (super influencers only)
- `GET /api/admin/influencers` — all influencers with stats (includes isSuperInfluencer + rate)
- `GET /api/admin/influencers/:id/referrals` — referrals for one influencer

## One-Time Code Customization
- Influencers can set a custom referral code/link exactly once via `PATCH /api/influencers/my-referral-code`
- One-time enforcement pattern: atomic conditional `UPDATE ... WHERE id = ? AND referral_code_customized = false` (same pattern as the one-time username change) — never check-then-write across two queries
- `referral_code_customized` boolean column added to `users` (default false); schema changes in this project go through psql directly since drizzle-kit push needs a TTY

## Frontend
- `admin/influencers.tsx` — expandable influencer list page (route: `/admin/influencers`)
- Star (⭐) icon button in admin users table toggles influencer status with local override map
- Settings page has influencer commission rate card (amber-themed)
- Profile page: when `user.isInfluencer`, shows `InfluencerDashboard` instead of regular Refer & Earn
