# Firebase Cloud Messaging setup (free)

Push uses **Firebase Cloud Messaging on the free Spark plan** — no payment required.
Nothing here is committed to git: the credential files and service-account JSON are gitignored.

## 1. What I need from you (Firebase console)

1. **Create / choose a Firebase project** (https://console.firebase.google.com) → *Add project*.
   The free Spark plan is enough.

2. **Register the Android app**
   - Android package name: `com.atasportslive.app`
   - Download `google-services.json`
   - Put it at `apps/mobile/google-services.json`

3. **Register the iOS app**
   - iOS bundle ID: `com.atasportslive.app`
   - Download `GoogleService-Info.plist`
   - Put it at `apps/mobile/GoogleService-Info.plist`

   Placeholders showing the expected shape are in `google-services.example.json` and
   `GoogleService-Info.example.plist`.

4. **Backend service account** (so the API on Linode can *send* messages)
   - Firebase console → ⚙ Project settings → **Service accounts** →
     **Generate new private key** (downloads a JSON file).
   - Give that JSON to the backend via either:
     - `FIREBASE_SERVICE_ACCOUNT_JSON` = the entire JSON as a single-line env value, or
     - `FIREBASE_SERVICE_ACCOUNT_PATH` = absolute path to the JSON file on the Linode server.
   - Keep this file secret. Never commit it.

5. **iOS APNs key** (needed for iOS delivery)
   - Firebase console → Project settings → **Cloud Messaging** → **Apple app configuration**
     → upload your Apple Push Notification certificate / key (.p8).
   - For EAS builds the corresponding APNs key must also be configured in EAS.

## 2. Production database migration (run on the LIVE database on Linode)

The code uses `DATABASE_URL` from the environment, so it will use the production DB.
Run this once on production:

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(user_id);
```

## 3. Environment variables on the Linode API server

```bash
DATABASE_URL=postgresql://...@.../ata_db        # live database
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# or: FIREBASE_SERVICE_ACCOUNT_PATH=/etc/ata/firebase-service-account.json
```

If neither Firebase variable is set, push is a safe no-op (in-app notifications still work).

## 4. Build notes

- Remote push does **not** work in Expo Go on Android (SDK 53+). You need a development
  build (`eas build --profile development`) or the store build.
- iOS simulator can obtain a token on Xcode 14+, but real delivery needs the APNs key.
- The app config already contains `@react-native-firebase/app`,
  `@react-native-firebase/messaging`, `expo-build-properties` (iOS dynamic frameworks),
  and the `googleServicesFile` paths.

## 5. What is wired already

- Token registered with the backend on sign-in and refreshed on token change.
- Tokens removed from the server on logout and account deletion.
- Push sent automatically for every existing in-app notification (bet results, refunds,
  wallet credits, etc.) via `notify()`.
- A broadcast is sent when an event transitions to `live`.
- Tapping a notification deep-links using the `url` field in the payload.
