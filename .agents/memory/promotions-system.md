---
name: Promotions & Bonus System
description: How the bonus wallet, promotions, and promo code system is architected
---

# Promotions & Bonus System Architecture

## Key design decisions

- `bonus_balance` is a separate column on the `wallets` table (not a join). Cash and bonus are always separate.
- Bonus can ONLY be spent on `POST /api/streams/:id/access` — bonus-first logic deducts bonus then cash.
- Betting, withdrawal, transfers: only cash. Enforced server-side in streams.ts and bets.ts.

## Flow: Auto-bonus on deposit
1. Deposit confirmed → `findMatchingAutoPromo(amount)` checks active automatic/deposit_match/welcome/seasonal promos
2. API returns `pendingBonus` in deposit response (NOT auto-credited)
3. Frontend shows terms modal; user must check checkbox
4. On accept → `POST /api/promotions/claim` → records `promotion_terms_acceptance` + credits `bonus_balance`

**Why terms-first:** Spec requires explicit user acceptance before any bonus credit. DB records IP + version.

## Flow: Promo code
1. User enters code → `POST /api/promotions/validate-code` → returns validity + estimated amount
2. Frontend shows terms modal
3. On accept → `POST /api/promotions/apply-code` → validates code + credits bonus

## Flow: Pesapal deposit
- `confirmPesapalPayment()` in wallet.ts: if user already accepted terms for matching promo → auto-credits; otherwise sends notification to go claim it.

## Tables
- `promotions` — admin-managed campaigns (type: automatic/promo_code/welcome/seasonal/deposit_match)
- `bonus_transactions` — every bonus credit/debit (type: earned/used/revoked)
- `promotion_terms_acceptance` — (userId, promotionId) unique; records ip + version

## API endpoints
- `GET /api/promotions/active` — public list
- `POST /api/promotions/validate-code` — check code (auth)
- `POST /api/promotions/claim` — claim auto-promo bonus (auth)
- `POST /api/promotions/apply-code` — apply promo code (auth)
- `GET /api/promotions/my-bonuses` — user bonus history (auth)
- Admin CRUD at `GET/POST/PATCH/DELETE /api/admin/promotions`
- `POST /api/admin/promotions/:id/revoke/:userId` — revoke user bonus

## Helpers exported from promotions.ts
- `findMatchingAutoPromo(depositAmount)` — finds best active auto promo for deposit amount
- `creditBonus(userId, promo, depositAmount, ip?)` — credits bonus, records tx, sends notification

**Why:** wallet.ts imports these helpers to avoid duplicating the matching logic.
