import React from 'react';
import { useSEO } from '@/lib/seo';

export default function AppPrivacy() {
  useSEO({
    title: 'ATA Sports Live App — Privacy Policy',
    path: '/app/privacy',
    description: 'Privacy policy for the ATA Sports Live mobile app, including permissions, privacy disclosures and how to delete your account.',
  });

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <a href="/app" className="text-xs font-semibold text-teal-400 hover:underline">← Back to the app</a>
      <h1 className="mt-6 text-2xl font-bold text-white mb-2">ATA Sports Live App — Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: November 2026 · Applies to the ATA Sports Live iOS and Android apps</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. About this policy</h2>
          <p>
            This policy explains how ATA Sports Live (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles information when you use our
            mobile apps. The app connects to the same account and backend as our website, so your account, wallet and
            predictions are shared between platforms. This policy is specific to the mobile app; the website has its own
            <a href="/privacy-policy" className="text-teal-400 hover:underline"> Privacy Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-white">Account details:</strong> name, email address, phone number, username and profile information you provide.</li>
            <li><strong className="text-white">Identity verification (FICA):</strong> date of birth, country, ID type and ID number, only if you choose to complete verification to withdraw funds.</li>
            <li><strong className="text-white">Wallet data:</strong> balances, deposits, withdrawals, vouchers, bonus codes and transaction history.</li>
            <li><strong className="text-white">Activity data:</strong> streams you watch, predictions you place, subscriptions you purchase and device signals needed to deliver the service securely.</li>
            <li><strong className="text-white">Device security setting:</strong> whether you have enabled Face ID / fingerprint unlock. Your biometric data itself never leaves your device.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. How we use your information</h2>
          <p>We use your information to sign you in, deliver live streams, process wallet transactions and subscriptions, settle predictions, verify your identity where required, prevent fraud, and support you when you contact us. We do not sell your personal information.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Privacy disclosures</h2>
          <p>We only disclose information in the following circumstances:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-white">Service providers:</strong> payment and mobile-money gateways (such as PawaPay and Pesapal), video delivery providers, cloud hosting and email delivery. They receive only the data needed to perform their service.</li>
            <li><strong className="text-white">Legal and safety:</strong> when required by law, regulation, court order, or to protect the rights, safety and integrity of ATA Sports Live, our users or the public.</li>
            <li><strong className="text-white">With your direction:</strong> when you ask us to connect a third-party service or share a referral link.</li>
            <li><strong className="text-white">Business transfers:</strong> in connection with a merger, acquisition or sale of assets, subject to appropriate protections.</li>
          </ul>
          <p className="mt-3">We do not sell or rent your personal data, and we do not use it for third-party advertising.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. Permissions requested by the app</h2>
          <p>The app asks only for permissions it needs to function:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-white">Internet / network access:</strong> required to sign in, stream live video and use wallet and prediction features.</li>
            <li><strong className="text-white">Face ID / fingerprint (iOS) / Biometric prompt (Android):</strong> optional. Used only to unlock the app locally. Your biometric data is handled by the device operating system and is never stored by us or transmitted to our servers.</li>
            <li><strong className="text-white">Notifications:</strong> optional, used for live-channel and prediction alerts. You can disable them at any time in your device settings.</li>
            <li><strong className="text-white">Local secure storage:</strong> the app stores your access and refresh tokens in the device keychain / secure storage so you stay signed in. This is local to your device.</li>
          </ul>
          <p className="mt-3">You can revoke notifications or biometric unlock at any time in your device or app settings without losing access to the rest of the app.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Data security and retention</h2>
          <p>We use encryption in transit, role-based access controls and secure token storage. Tokens are kept on your device, not in plain text on our servers. We retain account and transaction records for as long as your account is active and for the period required by financial and anti-money-laundering regulations.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">7. Your rights</h2>
          <p>Depending on where you live, you may have the right to access, correct, export or delete your personal data, and to object to or restrict certain processing. You can update most account details in the app under More → Profile. For anything else, contact us using the details below.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">8. Account deletion</h2>
          <p>You can delete your ATA Sports Live account at any time from inside the app:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Open <strong className="text-white">More → Profile</strong>, scroll to the bottom and choose <strong className="text-white">Delete account</strong>.</li>
            <li>Read the warning and choose <strong className="text-white">Continue</strong>, or <strong className="text-white">Keep my account</strong> to cancel.</li>
            <li>Type <strong className="text-white">DELETE</strong> to confirm. You can still go back at this point — nothing is removed until you press <strong className="text-white">Delete my account</strong>.</li>
          </ul>
          <p className="mt-3">
            Alternatively, email <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>
            with the subject &ldquo;Account Deletion&rdquo; and the email address linked to your account. We may ask you to confirm
            ownership before proceeding.
          </p>
          <p className="mt-3">
            We verify the request, then delete or anonymise your account, profile, activity history and stored personal information
            within <strong className="text-white">30 days</strong>. Withdrawable balances are returned to you before deletion where
            possible. We may retain limited records (for example transaction or verification records) where required by law or to
            resolve disputes, and these are kept only for as long as legally necessary. After deletion you can register again as a
            new user, but previous history cannot be restored.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">9. Children&rsquo;s privacy</h2>
          <p>The app is not intended for children under 18. We do not knowingly collect personal information from children. If you believe a child has created an account, contact us and we will remove it.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">10. Changes to this policy</h2>
          <p>We may update this policy as the app evolves. The &ldquo;Last updated&rdquo; date at the top will always reflect the current version, and material changes will be communicated in the app or by email.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">11. Contact</h2>
          <p>Questions, requests or complaints: <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>. You can also write to ATA Sports Live, Uganda.</p>
        </section>
      </div>
    </div>
  );
}
