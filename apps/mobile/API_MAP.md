# Mobile API map (Phase 0)

The mobile app talks to the **existing** ATA backend. Base URL: `EXPO_PUBLIC_API_URL`
(default `https://atasportslive.com/api`). All protected calls use
`Authorization: Bearer <accessToken>` from `expo-secure-store`.

| Feature | Endpoint | Status |
|---|---|---|
| Register | `POST /auth/register` | Web endpoint, mobile screen in Phase 2 |
| Login | `POST /auth/login` | Implemented |
| Refresh | `POST /auth/refresh` | Implemented |
| Logout | `POST /auth/logout` | Local clear implemented |
| Me | `GET /auth/me` | Implemented |
| Forgot password | `POST /auth/forgot-password` | Screen in Phase 2 (SMTP must be enabled on Linode) |
| Reset password | `POST /auth/reset-password` | Screen in Phase 2 |
| Wallet | `GET /wallet` | Implemented (cash + bonus always shown) |
| Deposits / withdrawals | `POST /wallet/deposit`, `/wallet/withdraw` | Phase 4 |
| Streams | `GET /streams`, `/streams/upcoming` | Implemented |
| Stream access / entitlement | `POST /streams/{id}/access`, `GET /streams/{id}/access/check` | Phase 3 |
| Subscription prices / purchase | `GET /subscriptions/prices`, `POST /subscriptions/purchase` | Phase 4 |
| Games | `GET /games`, `/games/upcoming`, `GET /games/{id}` | Phase 5 |
| Bets | `POST /bets`, `GET /bets/my` | Phase 5 |
| Notifications | `GET /notifications` | Phase 6 |
| Comments / chat | `GET /streams/{id}/comments`, WebSocket `/ws` | Phase 3 |

Notes:
- Wallet has **cash** (`availableBalance`) and **bonus** (`bonusBalance`) balances.
  Bonus is streaming-only, never withdrawable or bettable — same server rules as web.
- The OpenAPI spec (`../../lib/api-spec/openapi.yaml`) does not yet list every
  endpoint above (subscriptions, payments, comments). Phase 0 follow-up: add them
  to the spec so a typed mobile client can be generated from it.
- iOS testing uses **Expo Simulators (EAS)**, not a local Mac simulator.
