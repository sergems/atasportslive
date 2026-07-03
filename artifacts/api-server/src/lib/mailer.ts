import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

async function getSmtpSettings(): Promise<Record<string, string>> {
  const rows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key LIKE 'smtp_%'`
  );
  const obj: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) {
    obj[row.key] = row.value ?? "";
  }
  return obj;
}

async function createTransporter() {
  const s = await getSmtpSettings();
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) return null;
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: Number(s.smtp_port) || 587,
    secure: s.smtp_secure === "true",
    auth: { user: s.smtp_user, pass: s.smtp_pass },
    tls: { rejectUnauthorized: false },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      logger.warn("SMTP not configured — skipping email");
      return false;
    }
    const s = await getSmtpSettings();
    const from = s.smtp_from || `ATA Sports Live <${s.smtp_user}>`;
    await transporter.sendMail({ from, ...opts });
    logger.info({ to: opts.to, subject: opts.subject }, "Email sent");
    return true;
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send email");
    return false;
  }
}

// ── Email templates ──────────────────────────────────────────────

const BASE = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#0f1623; font-family:system-ui,-apple-system,sans-serif; color:#e2e8f0; }
    .wrap { max-width:560px; margin:0 auto; padding:24px 16px; }
    .card { background:#1e293b; border-radius:12px; padding:28px 24px; border:1px solid #334155; }
    .logo { font-size:20px; font-weight:800; color:#14b8a6; letter-spacing:-0.5px; margin-bottom:24px; }
    .logo span { color:#f59e0b; }
    h2 { margin:0 0 12px; font-size:20px; color:#f8fafc; }
    p { margin:0 0 14px; font-size:14px; line-height:1.6; color:#94a3b8; }
    .amount { font-family:monospace; font-size:28px; font-weight:700; color:#f8fafc; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; }
    .badge-amber { background:#451a03; color:#fbbf24; border:1px solid #78350f; }
    .badge-teal  { background:#042f2e; color:#2dd4bf; border:1px solid #134e4a; }
    .badge-blue  { background:#172554; color:#93c5fd; border:1px solid #1e3a5f; }
    .badge-green { background:#052e16; color:#4ade80; border:1px solid #14532d; }
    .badge-red   { background:#450a0a; color:#f87171; border:1px solid #7f1d1d; }
    .info-box { background:#0f172a; border:1px solid #334155; border-radius:8px; padding:14px; margin:16px 0; }
    .info-row { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; }
    .info-label { color:#64748b; }
    .info-value { color:#e2e8f0; font-family:monospace; }
    .cta { display:inline-block; margin-top:16px; padding:10px 20px; background:#14b8a6; color:#022c22; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none; }
    .footer { margin-top:24px; text-align:center; font-size:11px; color:#475569; }
    hr { border:none; border-top:1px solid #334155; margin:20px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">ATA <span>Sports</span> Live</div>
      ${content}
    </div>
    <div class="footer">ATA Sports Live &mdash; Nsambya, Kampala, Uganda<br>This is an automated message, please do not reply.</div>
  </div>
</body>
</html>`;

export const templates = {
  withdrawalApprovedUser: (opts: { name: string; amount: number; method: string; account: string }) =>
    BASE(`
      <h2>Withdrawal Approved ✓</h2>
      <p>Hi ${opts.name},</p>
      <p>Your withdrawal request has been approved by our admin team and sent to the finance department for processing.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value amount" style="font-size:18px">$${opts.amount.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Method</span><span class="info-value">${opts.method}</span></div>
        <div class="info-row"><span class="info-label">Account</span><span class="info-value">${opts.account}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="badge badge-blue">At Finance</span></div>
      </div>
      <p>Our finance team will process this payment and you will receive another notification once it has been sent to your account.</p>
    `),

  withdrawalPaidUser: (opts: { name: string; amount: number; method: string; account: string }) =>
    BASE(`
      <h2>Payment Sent 🎉</h2>
      <p>Hi ${opts.name},</p>
      <p>Your withdrawal has been processed and the payment has been sent to your account.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value amount" style="font-size:18px">$${opts.amount.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Method</span><span class="info-value">${opts.method}</span></div>
        <div class="info-row"><span class="info-value">${opts.account}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="badge badge-teal">Paid</span></div>
      </div>
      <p>Please check your ${opts.method} account. If you have any issues, contact us at <a href="mailto:info@atasportslive.com" style="color:#14b8a6">info@atasportslive.com</a>.</p>
    `),

  withdrawalRejectedUser: (opts: { name: string; amount: number; note?: string }) =>
    BASE(`
      <h2>Withdrawal Rejected</h2>
      <p>Hi ${opts.name},</p>
      <p>Unfortunately your withdrawal request for <strong style="color:#f8fafc">$${opts.amount.toFixed(2)}</strong> has been rejected and the funds have been returned to your wallet balance.</p>
      ${opts.note ? `<div class="info-box"><p style="margin:0;color:#94a3b8"><strong style="color:#e2e8f0">Reason: </strong>${opts.note}</p></div>` : ''}
      <p>If you have any questions please contact us at <a href="mailto:info@atasportslive.com" style="color:#14b8a6">info@atasportslive.com</a>.</p>
    `),

  withdrawalFinanceAlert: (opts: { count: number; totalValue: number; userName: string; amount: number; method: string; account: string }) =>
    BASE(`
      <h2>New Payment to Process</h2>
      <p>A withdrawal has been approved by admin and is ready for payment.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">User</span><span class="info-value">${opts.userName}</span></div>
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value amount" style="font-size:18px">$${opts.amount.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Send to</span><span class="info-value">${opts.method}</span></div>
        <div class="info-row"><span class="info-label">Account</span><span class="info-value">${opts.account}</span></div>
      </div>
      ${opts.count > 1 ? `<p>There are currently <strong style="color:#fbbf24">${opts.count} payments</strong> in the queue totalling <strong style="color:#fbbf24">$${opts.totalValue.toFixed(2)}</strong>.</p>` : ''}
      <a class="cta" href="https://atasportslive.com/finance/withdrawals">Open Payment Queue →</a>
    `),

  betMatched: (opts: { name: string; stake: number; outcome: string; potentialReturn: number; gameName: string }) =>
    BASE(`
      <h2>Bet Matched! 🎯</h2>
      <p>Hi ${opts.name},</p>
      <p>Great news — your bet on <strong style="color:#f8fafc">${opts.gameName}</strong> has been matched with another player.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Your pick</span><span class="info-value">${opts.outcome.replace(/_/g, ' ')}</span></div>
        <div class="info-row"><span class="info-label">Stake</span><span class="info-value">$${opts.stake.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Potential return</span><span class="info-value" style="color:#4ade80">$${opts.potentialReturn.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="badge badge-teal">Matched</span></div>
      </div>
      <p>Good luck! Results will be posted once the match is over.</p>
    `),

  betWon: (opts: { name: string; stake: number; payout: number; gameName: string }) =>
    BASE(`
      <h2>You Won! 🏆</h2>
      <p>Hi ${opts.name},</p>
      <p>Congratulations — you won your bet on <strong style="color:#f8fafc">${opts.gameName}</strong>!</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Stake</span><span class="info-value">$${opts.stake.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Payout</span><span class="info-value amount" style="font-size:18px;color:#4ade80">+$${opts.payout.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="badge badge-green">Won</span></div>
      </div>
      <p>Winnings have been credited to your wallet. Place another bet or withdraw your balance.</p>
      <a class="cta" href="https://atasportslive.com/wallet">View Wallet →</a>
    `),

  betLost: (opts: { name: string; stake: number; gameName: string }) =>
    BASE(`
      <h2>Better luck next time</h2>
      <p>Hi ${opts.name},</p>
      <p>Your bet on <strong style="color:#f8fafc">${opts.gameName}</strong> did not win this time.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Stake lost</span><span class="info-value" style="color:#f87171">$${opts.stake.toFixed(2)}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="badge badge-red">Lost</span></div>
      </div>
      <p>Keep playing — check out upcoming matches and place your next bet!</p>
      <a class="cta" href="https://atasportslive.com/games">View Games →</a>
    `),
};
