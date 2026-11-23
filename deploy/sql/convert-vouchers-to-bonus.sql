-- Convert mistakenly-issued cash vouchers into Bonus Deposits.
-- Run in two steps because PostgreSQL requires the new enum value to be
-- committed before it can be used in the same session.

-- STEP 1 (autocommit, no BEGIN/COMMIT):
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'bonus_deposit';

-- STEP 2: data conversion (run as one transaction).
BEGIN;

WITH totals AS (
  SELECT user_id, SUM(amount) AS amt
  FROM public.transactions
  WHERE type = 'voucher_redeem' AND status = 'completed'
  GROUP BY user_id
),
balances AS (
  SELECT t.user_id, t.amt, w.bonus_balance, w.balance,
         w.available_balance, w.withdrawable_balance
  FROM totals t
  JOIN public.wallets w ON w.user_id = t.user_id
)
UPDATE public.wallets w
SET bonus_balance        = b.bonus_balance + b.amt,
    -- Cash may already have been spent; never drive a balance negative.
    balance              = GREATEST(0, b.balance - b.amt),
    available_balance    = GREATEST(0, b.available_balance - b.amt),
    withdrawable_balance = GREATEST(0, b.withdrawable_balance - b.amt),
    updated_at           = NOW()
FROM balances b
WHERE w.user_id = b.user_id;

UPDATE public.transactions
SET type = 'bonus_deposit',
    description = COALESCE(description, '') || ' (converted to Bonus Deposit)'
WHERE type = 'voucher_redeem';

INSERT INTO public.bonus_transactions
  (user_id, type, amount, balance_before, balance_after, reference, description)
SELECT t.user_id,
       'earned',
       t.amount,
       w.bonus_balance - t.amount,
       w.bonus_balance,
       t.transaction_id,
       'Converted voucher redemption to Bonus Deposit'
FROM public.transactions t
JOIN public.wallets w ON w.user_id = t.user_id
WHERE t.type = 'bonus_deposit'
  AND t.transaction_id LIKE 'VCH-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.bonus_transactions bt
    WHERE bt.reference = t.transaction_id
  );

COMMIT;

-- Verify:
-- SELECT type, count(*) FROM public.transactions WHERE type IN ('voucher_redeem','bonus_deposit') GROUP BY type;
-- SELECT count(*) FROM public.bonus_transactions WHERE description = 'Converted voucher redemption to Bonus Deposit';
