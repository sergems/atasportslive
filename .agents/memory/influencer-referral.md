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

## API Routes
- `GET /api/influencers/my-referrals` — influencer's referral list + stats
- `GET /api/influencers/my-commission-history` — paginated commission history
- `PATCH /api/admin/users/:id/set-influencer` — toggle influencer status
- `GET /api/admin/influencers` — all influencers with stats
- `GET /api/admin/influencers/:id/referrals` — referrals for one influencer

## Frontend
- `admin/influencers.tsx` — expandable influencer list page (route: `/admin/influencers`)
- Star (⭐) icon button in admin users table toggles influencer status with local override map
- Settings page has influencer commission rate card (amber-themed)
- Profile page: when `user.isInfluencer`, shows `InfluencerDashboard` instead of regular Refer & Earn
