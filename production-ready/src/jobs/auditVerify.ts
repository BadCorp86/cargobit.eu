/**
 * Audit Log Verification Job
 * 
 * Scheduled job to verify audit log integrity.
 * Can be run as a cron job or via a job scheduler.
 * 
 * Recommended schedule: Daily at 4:00 AM UTC
 */

import { verifyAuditChain, VerificationResult } from "../services/auditLog";

// ============================================
// Configuration
// ============================================

interface AuditVerifyConfig {
  /** Send alert on failure */
  alertOnFailure: boolean;
  /** Slack webhook URL for alerts */
  slackWebhookUrl?: string;
  /** Email recipients for alerts */
  emailRecipients?: string[];
  /** Log results to console */
  verbose: boolean;
  /** Exit with error code on failure (for CI/CD) */
  exitOnError: boolean;
}

const DEFAULT_CONFIG: AuditVerifyConfig = {
  alertOnFailure: true,
  verbose: true,
  exitOnError: false,
};

// ============================================
// Verification Job
// ============================================

export async function runAuditVerification(
  config: Partial<AuditVerifyConfig> = {}
): Promise<VerificationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (cfg.verbose) {
    console.log("[AuditVerify] Starting verification...");
    console.log(`[AuditVerify] Time: ${new Date().toISOString()}`);
  }

  const startTime = Date.now();

  try {
    // Run verification
    const result = await verifyAuditChain();

    const duration = Date.now() - startTime;

    if (cfg.verbose) {
      console.log(`[AuditVerify] Completed in ${duration}ms`);
      console.log(`[AuditVerify] Total entries: ${result.totalEntries}`);
      console.log(`[AuditVerify] Valid: ${result.valid}`);

      if (!result.valid) {
        console.error(`[AuditVerify] ERRORS FOUND: ${result.errors.length}`);
        result.errors.forEach((err) => {
          console.error(`  - Entry ${err.id}: ${err.error}`);
        });
      }
    }

    // Send alerts on failure
    if (!result.valid && cfg.alertOnFailure) {
      await sendFailureAlert(result, cfg);
    }

    // Exit with error code if configured
    if (!result.valid && cfg.exitOnError) {
      process.exit(1);
    }

    return result;
  } catch (error) {
    console.error("[AuditVerify] Verification failed with error:", error);

    if (cfg.alertOnFailure) {
      await sendErrorAlert(error as Error, cfg);
    }

    if (cfg.exitOnError) {
      process.exit(1);
    }

    throw error;
  }
}

// ============================================
// Alerting
// ============================================

async function sendFailureAlert(
  result: VerificationResult,
  config: AuditVerifyConfig
): Promise<void> {
  const message = `🚨 Audit Log Integrity Failure

${result.errors.length} integrity violations detected!

Total entries checked: ${result.totalEntries}

Errors:
${result.errors
  .slice(0, 10)
  .map((e) => `- Entry ${e.id}: ${e.error}`)
  .join("\n")}
${
  result.errors.length > 10
    ? `\n... and ${result.errors.length - 10} more`
    : ""
}

Time: ${result.verifiedAt.toISOString()}
`;

  // Send to Slack
  if (config.slackWebhookUrl) {
    try {
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
          attachments: [
            {
              color: "danger",
              title: "Audit Log Integrity Alert",
              text: message,
              fallback: message,
            },
          ],
        }),
      });
    } catch (error) {
      console.error("[AuditVerify] Failed to send Slack alert:", error);
    }
  }

  // TODO: Send email alerts
  // if (config.emailRecipients?.length) {
  //   await sendEmail({
  //     to: config.emailRecipients,
  //     subject: "🚨 Audit Log Integrity Failure",
  //     body: message,
  //   });
  // }
}

async function sendErrorAlert(
  error: Error,
  config: AuditVerifyConfig
): Promise<void> {
  const message = `🚨 Audit Verification Job Failed

Error: ${error.message}
Stack: ${error.stack}

Time: ${new Date().toISOString()}
`;

  if (config.slackWebhookUrl) {
    try {
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
        }),
      });
    } catch (err) {
      console.error("[AuditVerify] Failed to send error alert:", err);
    }
  }
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const args = process.argv.slice(2);

  const config: Partial<AuditVerifyConfig> = {
    alertOnFailure: !args.includes("--no-alert"),
    verbose: !args.includes("--quiet"),
    exitOnError: args.includes("--exit-on-error"),
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  };

  const result = await runAuditVerification(config);

  // Output JSON for programmatic use
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.valid ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("[AuditVerify] Fatal error:", error);
    process.exit(1);
  });
}

// ============================================
// Cron Schedule (for reference)
// ============================================

/**
 * Add to crontab:
 * 
 * # Daily audit verification at 4:00 AM UTC
 * 0 4 * * * cd /app && node dist/jobs/auditVerify.js --exit-on-error
 * 
 * Or use a job scheduler like BullMQ, Agenda, or Temporal.
 */
