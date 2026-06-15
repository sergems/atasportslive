import React from 'react';

export default function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Refund Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. General Policy</h2>
          <p>
            At ATA Sports Live, all deposits made into your wallet are generally non-refundable once processed. We encourage users to review all transactions carefully before confirming them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. Stream Access Purchases</h2>
          <p>
            Stream access fees ($1.50/day) are non-refundable once access has been granted and the stream has commenced. If a stream is cancelled before it begins, the full access fee will be automatically refunded to your wallet balance within 24 hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. Bets and Wagering</h2>
          <p>
            Matched bets are binding and cannot be cancelled or refunded once confirmed. If an event is cancelled or postponed before completion, all stakes will be refunded to the original wallet balance. Brokerage fees are non-refundable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Withdrawal Requests</h2>
          <p>
            Approved withdrawals are processed within 1–3 business days via MTN MoMo, Airtel Money, or BTC. Withdrawal requests that are pending or rejected can be cancelled, and the funds will be returned to your available balance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. Disputes</h2>
          <p>
            If you believe a transaction was processed in error, please contact us within 7 days at{' '}
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a>. We will investigate and respond within 5 business days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Contact Us</h2>
          <p>
            For any refund-related enquiries, reach us at:<br />
            <a href="mailto:info@atasportslive.com" className="text-teal-400 hover:underline">info@atasportslive.com</a><br />
            <a href="tel:+256772364513" className="text-teal-400 hover:underline">+256 772 364 513</a>
          </p>
        </section>
      </div>
    </div>
  );
}
