import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getAuditSummary, getCostSummary } from '@kontextmind/core';

function parseSince(since: string | undefined): Date | undefined {
  if (!since) return undefined;

  const match = since.match(/^(\d+)([hmsd])$/);
  if (!match) return undefined;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case 's':
      return new Date(now.getTime() - value * 1000);
    case 'm':
      return new Date(now.getTime() - value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

export async function auditCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const json = Boolean(options.json);
  const sinceStr = options.since as string | undefined;
  const since = parseSince(sinceStr);

  if (!json) {
    console.log(chalk.bold('KontextMind Audit Summary'));
    if (since) {
      console.log(`Since: ${since.toISOString()}`);
    }
    console.log('');
  }

  const audit = getAuditSummary(since);
  const cost = getCostSummary(since);

  if (json) {
    console.log(
      JSON.stringify(
        {
          audit,
          cost: {
            totalCost: cost.totalCost,
            totalInputTokens: cost.totalInputTokens,
            totalOutputTokens: cost.totalOutputTokens,
            estimatedCostUSD: cost.totalCost.toFixed(6),
          },
          since: since?.toISOString() || null,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(chalk.bold('Activity Metrics'));
  console.log('-'.repeat(50));
  console.log(`  Total Questions:        ${audit.totalQuestions}`);
  console.log(`  Raw Code Reads:        ${audit.rawCodeReads}`);
  console.log(`  Blocked Attempts:      ${audit.blockedAttempts}`);
  console.log(`  Secrets Detected:      ${audit.secretsDetected}`);
  console.log(`  Summaries Generated:   ${audit.summariesGenerated}`);
  console.log(`  Stale Summaries:       ${audit.staleSummaries}`);
  console.log(`  Security Events:       ${audit.securityEvents}`);
  console.log(`  API Requests:          ${audit.apiRequests}`);
  console.log(`  MCP Calls:              ${audit.mcpCalls}`);
  console.log('');

  console.log(chalk.bold('Cost Summary'));
  console.log('-'.repeat(50));
  console.log(`  Estimated Total Cost:  $${cost.totalCost.toFixed(6)} USD`);
  console.log(`  Input Tokens:          ${cost.totalInputTokens.toLocaleString()}`);
  console.log(`  Output Tokens:         ${cost.totalOutputTokens.toLocaleString()}`);

  if (Object.keys(cost.operationCounts).length > 0) {
    console.log(chalk.bold('\n  Operations by Type'));
    for (const [op, count] of Object.entries(cost.operationCounts)) {
      console.log(`    ${op}: ${count}`);
    }
  }

  if (audit.mostAccessedFiles.length > 0) {
    console.log(chalk.bold('\n  Most Accessed Files'));
    for (const { path: filePath, count } of audit.mostAccessedFiles.slice(0, 5)) {
      const displayPath = filePath.length > 50 ? '...' + filePath.slice(-47) : filePath;
      console.log(`    ${count}x ${displayPath}`);
    }
  }

  if (audit.lastBlockedEvent) {
    console.log(chalk.bold('\n  Last Blocked Event'));
    console.log(`    ${new Date(audit.lastBlockedEvent).toLocaleString()}`);
  }

  console.log('');
}