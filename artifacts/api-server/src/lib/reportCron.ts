import { generateReportCsv } from "../routes/reports";
import { sendMail } from "./mailer";
import { logger } from "./logger";

const REPORT_EMAIL = "info@atasportslive.com";

async function sendWeeklyReport(): Promise<void> {
  const now = new Date();
  const toDate = new Date(now);
  toDate.setHours(23, 59, 59, 999);

  const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  fromDate.setHours(0, 0, 0, 0);

  logger.info({ from: fromDate, to: toDate }, "Generating weekly platform report");

  try {
    const csv = await generateReportCsv(fromDate, toDate);
    const filename = `ata-weekly-report-${fromDate.toISOString().slice(0, 10)}-to-${toDate.toISOString().slice(0, 10)}.csv`;

    const sent = await sendMail({
      to: REPORT_EMAIL,
      subject: `ATA Weekly Report — ${fromDate.toISOString().slice(0, 10)} to ${toDate.toISOString().slice(0, 10)}`,
      html: `
        <h2>ATA Sports Live — Weekly Platform Report</h2>
        <p>Your automated weekly platform report is attached as a CSV file.</p>
        <p>Period: <strong>${fromDate.toISOString().slice(0, 10)}</strong> to <strong>${toDate.toISOString().slice(0, 10)}</strong></p>
        <p>The report includes:</p>
        <ul>
          <li>Financial summary (revenue, deposits, withdrawals)</li>
          <li>All transactions in the period</li>
          <li>Bets placed and outcomes</li>
          <li>Stream access activity</li>
          <li>Current user wallet balances</li>
        </ul>
        <p style="color:#64748b;font-size:12px">This is an automated weekly report from ATA Sports Live. Next report will be sent in 7 days.</p>
      `,
      attachments: [{ filename, content: csv, contentType: "text/csv" }] as any,
    });

    if (sent) {
      logger.info({ to: REPORT_EMAIL, filename }, "Weekly report sent successfully");
    } else {
      logger.warn("Weekly report generated but SMTP not configured — skipping email");
    }
  } catch (err) {
    logger.error({ err }, "Failed to generate or send weekly report");
  }
}

function getMsUntilNextMonday8amEAT(): number {
  // EAT = UTC+3. Monday 8:00 EAT = Monday 05:00 UTC
  const now = new Date();
  const target = new Date(now);

  // Find the next Monday
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;

  target.setUTCDate(now.getUTCDate() + daysUntilMonday);
  target.setUTCHours(5, 0, 0, 0); // 05:00 UTC = 08:00 EAT

  const ms = target.getTime() - now.getTime();
  return ms;
}

export function startReportCron(): void {
  const msUntilFirst = getMsUntilNextMonday8amEAT();
  const days = Math.floor(msUntilFirst / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msUntilFirst % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  logger.info({ daysUntilFirst: days, hoursUntilFirst: hours }, "Weekly report cron scheduled (every Monday 08:00 EAT)");

  setTimeout(() => {
    sendWeeklyReport().catch((err) => logger.error({ err }, "Weekly report cron failed"));

    // Then repeat every 7 days
    setInterval(() => {
      sendWeeklyReport().catch((err) => logger.error({ err }, "Weekly report cron failed"));
    }, 7 * 24 * 60 * 60 * 1000);
  }, msUntilFirst);
}
