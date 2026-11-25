# Mobile API map

The mobile app talks to the existing ATA backend. Base URL: `EXPO_PUBLIC_API_URL`
(default `https://atasportslive.com/api`). Protected calls use
`Authorization: Bearer <accessToken>` from `expo-secure-store`.

| Feature | Endpoint | Status |
|---|---|---|
| Register | `POST /auth/register` | Implemented (`register.tsx`, supports `?ref=`) |
| Login | `POST /auth/login` | Implemented |
| Refresh | `POST /auth/refresh` | Implemented (single-flight, rotating token safe) |
| Logout | `POST /auth/logout` | Implemented (also revokes server push tokens) |
| Me | `GET /auth/me` | Implemented |
| Forgot password | `POST /auth/forgot-password` | Implemented (`forgot-password.tsx`) |
| Reset password | `POST /auth/reset-password` | Implemented; email link has an "Open in app" deep link on the website |
| Wallet | `GET /wallet` | Implemented (cash + bonus always shown) |
| Deposits | Voucher redemption + Google Play credit tiers | Vouchers are admin-generated; Play sells $1/$2/$5/$10/$20/$50 credits via RevenueCat (Android only) |
| Withdrawals | `POST /wallet/withdraw` | Implemented; gated on FICA + payout method |
| Payout method | `GET/POST /wallet/payout-method` | Implemented (one-time setup with confirmation) |
| Vouchers | `POST /wallet/redeem-voucher` | Implemented |
| Bonus codes | `POST /promotions/validate-code`, `/promotions/apply-code` | Implemented |
| Streams | `GET /streams/upcoming`, `GET /streams/:id` | Implemented |
| Stream access | `POST /streams/:id/access`, `GET /streams/:id/access/check` | Implemented |
| Subscription prices / purchase | `GET /subscriptions/prices`, `POST /subscriptions/purchase` | Implemented |
| Comments / chat | `GET /streams/:id/comments`, `POST`, WebSocket `/ws` | Implemented |
| Notifications | `GET /notifications`, mark read, FCM token | Implemented |
| Referrals | `GET /influencers/my-referrals`, `/my-commission-history`, `PATCH /my-referral-code` | Implemented (More → Referrals) |
| Fixtures | `GET /streams/upcoming` | Implemented (More → Fixtures, streams only) |
| Highlights | `GET /highlights` | Implemented (More → Highlights) |
| Games / betting | `GET /games`, `POST /bets`, `GET /bets/my` | **Not in the app — browser only** |
| Full transaction history | `GET /wallet/transactions` | Browser only; app shows recent 8 in Wallet / 5 on Dashboard |
| Google link/unlink, avatar upload, set-password, legal pages, notification settings | various | **Not in the app by design** |

Notes:
- Wallet has **cash** (`availableBalance`) and **bonus** (`bonusBalance`) balances.
  Bonus is streaming-only, never withdrawable or bettable — same server rules as web.
- Deposit promo codes are not sent by the app (the backend's deposit endpoints
  do not accept a promo code); use a bonus code in the Bonus Code field.
- The OpenAPI spec (`../../lib/api-spec/openapi.yaml`) does not yet cover
  subscriptions, payments or comments — the typed mobile client is hand-maintained.
- Preview the app on an Expo Simulator (Android Emulator / iOS Simulator), never
  in a local browser. Only the main website is previewed locally at port 5000.
- iOS testing uses **Expo Simulators (EAS)**, not a local Mac simulator.
