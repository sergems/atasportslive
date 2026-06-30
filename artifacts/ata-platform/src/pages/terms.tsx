import React from 'react';
import { useSEO } from '@/lib/seo';

export default function Terms() {
  useSEO({
    title: 'Terms and Conditions',
    path: '/terms',
    description: "Read the Terms and Conditions for using ATA Sports Live — Africa's premier live sports streaming and P2P betting exchange. Governing rules for streaming, betting, wallets, and payments.",
  });
  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Terms and Conditions</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the ATA Sports Live platform, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. Eligibility</h2>
          <p>
            You must be at least 18 years of age to use this platform. By registering, you confirm that you are of legal age and are permitted to participate in sports betting and streaming services in your jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. Account Responsibility</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. ATA Sports Live is not liable for any loss resulting from unauthorised access to your account. You must notify us immediately of any suspected breach at{' '}
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Streaming Services</h2>
          <p>
            Live stream access is provided at $1.50 per day. Access is granted per user account and may not be shared. Stream quality and availability may vary depending on network conditions. ATA Sports Live is not liable for interruptions beyond our control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. P2P Betting Exchange</h2>
          <p>
            ATA Sports Live operates as a peer-to-peer betting exchange. We facilitate matching of bets between users and charge a 10% brokerage fee on winnings. We do not act as a bookmaker. All bets are binding once matched. Users accept all associated financial risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Deposits and Withdrawals</h2>
          <p>
            Deposits are processed via MTN MoMo, Airtel Money, or BTC. Withdrawals are subject to review and may take 1–3 business days. We reserve the right to request identity verification before processing withdrawals above certain thresholds.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">7. Prohibited Conduct</h2>
          <p>The following are strictly prohibited:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Creating multiple accounts to exploit promotions or avoid restrictions</li>
            <li>Using the platform for money laundering or fraud</li>
            <li>Attempting to manipulate match outcomes or betting markets</li>
            <li>Sharing account credentials or stream access with other users</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">8. Account Suspension</h2>
          <p>
            We reserve the right to suspend or permanently ban accounts that violate these terms without prior notice. Funds in suspended accounts may be withheld pending investigation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">9. Limitation of Liability</h2>
          <p>
            ATA Sports Live is not liable for any indirect, incidental, or consequential losses arising from use of the platform. Our total liability to you shall not exceed the balance held in your wallet at the time of the dispute.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">10. Governing Law</h2>
          <p>
            These terms are governed by the laws of the Republic of Uganda. Any disputes shall be resolved in the courts of Kampala, Uganda.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">11. Contact</h2>
          <p>
            For legal enquiries:<br />
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a><br />
            Nsambya, Kampala, Uganda
          </p>
        </section>
      </div>
    </div>
  );
}
