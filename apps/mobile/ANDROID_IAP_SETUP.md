# Android in-app purchases + Play deployment

Wallet credits can now be bought with Google Play. Subscriptions still deduct the wallet first; if the balance is too low, the app offers a Play top-up. Vouchers remain admin-generated and are only redeemed in the app.

## How the money flows

1. User buys one of these Play **consumables** in the app:
   `ata_credit_1`, `ata_credit_2`, `ata_credit_5`, `ata_credit_10`, `ata_credit_20`, `ata_credit_50`.
2. Google Play confirms the charge → RevenueCat verifies the receipt.
3. RevenueCat calls `POST https://atasportslive.com/api/webhooks/revenuecat`.
4. The API verifies the webhook secret, records the transaction once, and credits the wallet.
5. The app refreshes the wallet on OK. The client never credits money itself.

## 1. What I need from you

- A **Google Play Developer account** (one-time $25) and the app created in Play Console with package **`com.atasportslive.app`**.
- A **Google Play service account JSON key** with access to the Play Developer API (needed by RevenueCat and by `eas submit`).
- A **RevenueCat** account (free tier is fine) and its **Android public SDK key**.
- A **webhook secret** — any long random string. Use the same value in RevenueCat and on the API server.
- A Google Play **license tester** account so you can complete test purchases without being charged.

## 2. Google Play Console

1. Play Console → **Create app** → name `ATA Sports Live`, default language English, free app.
2. In **Monetization → Products → In-app products**, create six **consumable** products:

   | Product ID | Price |
   |---|---|
   | `ata_credit_1` | $1.00 |
   | `ata_credit_2` | $2.00 |
   | `ata_credit_5` | $5.00 |
   | `ata_credit_10` | $10.00 |
   | `ata_credit_20` | $20.00 |
   | `ata_credit_50` | $50.00 |

   Set each to **Active** after creation.
3. Play Console → **Setup → License testing** → add your test Google account as a license tester.
4. Create the service account: Google Cloud Console → enable **Google Play Android Developer API** → create a service account → create a JSON key → in Play Console **Users & permissions** invite that service account email with **Release manager** access.

## 3. RevenueCat

1. Create a project → add an Android app with the same package `com.atasportslive.app`.
2. Connect Google Play using the service account JSON from step 2.
3. Add the six product IDs above as consumables in the RevenueCat dashboard.
4. Copy the **public SDK key** (it starts with `goog_...`) — it is safe to put in the app bundle.
5. Webhooks → add webhook:
   - URL: `https://atasportslive.com/api/webhooks/revenuecat`
   - Authorization header: `Bearer <your webhook secret>`
   - Enable events: **Initial purchase**, **Product change**, **Uncancellation** (all purchase/completion events).

## 4. Secrets / environment

On your **local machine**, for development builds:
```bash
# apps/mobile/.env (gitignored)
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxx
```
For EAS builds, add it as an environment variable/secret to the build profile (it is a public SDK key, but keep it out of git).

On the **production API server**:
```bash
REVENUECAT_WEBHOOK_SECRET=the-same-long-random-string
```
Then restart the API. If the secret is missing, the webhook returns `503` and no credits are added. `docker-compose.yml` and `deploy/.env.example` already include the variable.

## 5. Build and test on Android

Real IAP needs a native build — **Expo Go cannot make purchases** (the app detects this and shows a message).

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
```
Install the APK on a device/emulator signed in with your **license tester** Google account, then:
- Wallet → Deposit → buy a credit tier.
- Check the wallet balance updates and `/api/webhooks/revenuecat` was called.
- Subscription → try a plan with an empty wallet → "Top up" → buy credits → return and purchase.

## 6. Deploy to Google Play with Expo

`eas.json` already has a `production` build profile (AAB) and a `submit.production.android` profile targeting the **internal** track.

```bash
# one-time: upload the Play service account key to Expo
npx eas-cli@latest credentials --platform android
# choose production → Google Service Account → Set up a key → path to the JSON file

# build the .aab
npx eas-cli@latest build --platform android --profile production

# upload to Play internal testing
npx eas-cli@latest submit --platform android --profile production

# or build + submit in one step
npx eas-cli@latest build --platform android --profile production --auto-submit
```

The first release stays in **internal testing** until you complete the Play Console store listing, data-safety form and release checks. After testing, promote it from internal → production in Play Console. To upload straight to another track, change `track` in `apps/mobile/eas.json` (`internal`, `alpha`, `beta`, `production`) or set `releaseStatus: draft`.

## 7. Remaining Android readiness already done

- `com.android.vending.BILLING` permission added in `app.json`.
- `expo-notifications` config plugin added with `defaultChannel: ata-default` for Android notification channels.
- `react-native-purchases` installed via `npx expo install` (v11, SDK 58 compatible).
- Firebase files (`google-services.json`, `GoogleService-Info.plist`) are present; backend push only needs `FIREBASE_SERVICE_ACCOUNT_JSON` / `FIREBASE_SERVICE_ACCOUNT_PATH` on the server.
- `expo-doctor`: 20/20 checks pass.

Docs: https://docs.expo.dev/guides/in-app-purchases/ · https://docs.expo.dev/submit/android/ · https://docs.revenuecat.com/docs/
