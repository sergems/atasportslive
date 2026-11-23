import React from 'react';
import { useSEO } from '@/lib/seo';

export default function AppTerms() {
  useSEO({
    title: 'ATA Sports Live App — Terms & Conditions',
    path: '/app/terms',
    description: 'Terms and Conditions for the ATA Sports Live mobile app: accounts, subscriptions, wallet, predictions, live streaming and acceptable use.',
  });

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <a href="/app" className="text-xs font-semibold text-teal-400 hover:underline">← Back to the app</a>
      <h1 className="mt-6 text-3xl font-bold text-white mb-2">ATA Sports Live App — Terms &amp; Conditions</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: November 2026 · Applies to the ATA Sports Live iOS and Android apps</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of terms</h2>
          <p>By downloading, installing or using the ATA Sports Live mobile app, you agree to these Terms and Conditions and to our app <a href="/app/privacy" className="text-teal-400 hover:underline">Privacy Policy</a>. If you do not agree, do not use the app. These terms apply in addition to the terms governing the ATA Sports Live website.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. Eligibility</h2>
          <p>You must be at least 18 years old and legally able to enter into a contract in your jurisdiction to use the app. You may only use one account, and you must provide accurate information when registering and when completing identity verification.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. Your account and device security</h2>
          <p>You are responsible for keeping your account credentials and device secure. The app can optionally require Face ID or fingerprint unlock; this is a convenience and security feature on your device, and you remain responsible for all activity carried out through your account. Tell us immediately if you suspect unauthorised access.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Live streaming and subscriptions</h2>
          <p>Some live streams are free to watch and others require access. Access may be purchased per event or through a Daily, Weekly, Monthly or Yearly subscription. Subscription prices are shown in the app before purchase and may be changed by an administrator from time to time. Access begins when payment or wallet deduction is confirmed and lasts for the stated period. Subscriptions and event access are non-refundable except where required by law.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. Wallet, deposits and withdrawals</h2>
          <p>Wallet funds can be added through the available payment methods (including mobile money and card providers) or by redeeming a valid voucher or bonus code. Bonus funds are credited to a separate bonus wallet, are usable only for livestream access, and cannot be withdrawn or used for predictions. Withdrawals may require completed identity verification and may be reviewed before payment. Payment providers apply their own terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Predictions</h2>
          <p>The app allows you to place predictions on sporting events. Predictions are settled according to the published result and the rules shown with each event. Once a prediction is placed it cannot be changed. We may cancel or void a prediction where an event is cancelled, result is overturned, or fraud or abuse is suspected.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">7. Acceptable use</h2>
          <p>You agree not to: use the app for unlawful activity; attempt to interfere with its operation, security or streaming services; record, redistribute or rebroadcast any stream without permission; exploit bugs or promotions; create multiple accounts to abuse bonuses; or harass other users. We may suspend or terminate access where these rules are breached.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">8. Third-party services</h2>
          <p>The app relies on third-party services for video delivery, payment processing and notifications. Their availability and terms are outside our control. We are not liable for losses caused by third-party outages or payment-processing delays.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">9. Availability and changes</h2>
          <p>We may update, maintain or discontinue parts of the app at any time. Live channels, features and prices may change. We will make reasonable efforts to announce material changes, but do not guarantee uninterrupted availability.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">10. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, ATA Sports Live is not liable for indirect or consequential losses, loss of profits, or losses arising from events outside our reasonable control. Nothing in these terms limits liability that cannot lawfully be limited.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">11. Termination and account deletion</h2>
          <p>You may stop using the app at any time and may request deletion of your account as described in the app <a href="/app/privacy" className="text-teal-400 hover:underline">Privacy Policy</a>. We may suspend or close an account that breaches these terms or is required to be closed by law.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">12. Governing law and contact</h2>
          <p>These terms are governed by the laws applicable in Uganda, without prejudice to any mandatory consumer protections in your country. Questions about these terms can be sent to <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
