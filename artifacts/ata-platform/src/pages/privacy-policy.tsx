import React from 'react';
import { useSEO } from '@/lib/seo';

export default function PrivacyPolicy() {
  useSEO({
    title: 'Privacy Policy',
    path: '/privacy-policy',
    description: "ATA Sports Live privacy policy. How we collect, use, and protect your personal data on Africa's premier live sports streaming platform.",
  });
  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
          <p>We collect the following personal information when you register or use our platform:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Full name, email address, and phone number</li>
            <li>Payment method identifiers (MTN MoMo, Airtel Money, BTC wallet addresses)</li>
            <li>Usage data, including pages visited and streams watched</li>
            <li>Device information and IP address for security purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Process deposits, withdrawals, and transactions</li>
            <li>Provide access to live streams and event content</li>
            <li>Send account and transaction notifications</li>
            <li>Comply with legal and regulatory obligations in Uganda</li>
            <li>Improve platform performance and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. Data Sharing</h2>
          <p>
            We do not sell or rent your personal data to third parties. We may share data with payment processors solely to facilitate transactions, and with regulatory authorities when required by Ugandan law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Data Security</h2>
          <p>
            We use industry-standard encryption and security practices to protect your personal information. Passwords are hashed and never stored in plain text. Access to user data is restricted to authorised personnel only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. Your Rights</h2>
          <p>
            You have the right to access, correct, or request deletion of your personal data. To exercise these rights, contact us at{' '}
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Cookies</h2>
          <p>
            We use session tokens stored in your browser's local storage to keep you logged in. We do not use third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">7. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">8. Contact</h2>
          <p>
            For privacy-related enquiries:<br />
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a><br />
            Nsambya, Kampala, Uganda
          </p>
        </section>
      </div>
    </div>
  );
}
