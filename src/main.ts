import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';
import { ReviewError, formatError } from './utils/error-handler.js';

// Load environment configuration from .env file
dotenv.config();

/**
 * Validates CLI arguments and configuration.
 */
function parseAndValidateArgs(): { owner: string; repo: string; prNumber: number } {
  const cliArgs = process.argv.slice(2);
  const owner = cliArgs[0];
  const repo = cliArgs[1];
  const prRaw = cliArgs[2];

  if (!owner || !repo || !prRaw) {
    console.error('Error: Insufficient arguments provided.');
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- airaamane simple-todo-app 1');
    process.exit(1);
  }

  const parsedPrNumber = parseInt(prRaw, 10);

  if (Number.isNaN(parsedPrNumber) || parsedPrNumber <= 0 || String(parsedPrNumber) !== prRaw.trim()) {
    console.error(`Error: Invalid pull request number "${prRaw}". Must be a positive integer.`);
    process.exit(1);
  }

  return { owner, repo, prNumber: parsedPrNumber };
}

/**
 * Validates environment variables for API authentication and model setup.
 */
function validateEnvironment(): void {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    console.error('Configuration Error: ANTHROPIC_MODEL environment variable is required.');
    console.error('Example: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929');
    process.exit(1);
  }

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasBedrockConfig = Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );

  if (!hasAnthropicKey && !hasBedrockConfig) {
    console.error('Authentication Error: Missing LLM API credentials.');
    console.error('Configure either:');
    console.error('  1. ANTHROPIC_API_KEY in .env (Anthropic Direct API)');
    console.error('  2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION in .env (Amazon Bedrock)');
    process.exit(1);
  }

  if (hasBedrockConfig && !hasAnthropicKey) {
    logger.info('Authenticating via Amazon Bedrock credentials');
  } else {
    logger.info('Authenticating via Anthropic API credentials');
  }

  if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.warn('Notice: GITHUB_TOKEN is not configured. Requests will run unauthenticated and subject to strict GitHub rate limits.');
  }
}

/**
 * Main application entrypoint.
 */
async function run(): Promise<void> {
  const { owner, repo, prNumber } = parseAndValidateArgs();
  validateEnvironment();

  console.log(`\n======================================================`);
  console.log(`  Multi-Agent Code Review Orchestrator`);
  console.log(`  Target: ${owner}/${repo} #PR ${prNumber}`);
  console.log(`======================================================\n`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const outputDirectory = path.resolve(process.cwd(), 'reports');
    await fs.mkdir(outputDirectory, { recursive: true });

    const baseName = `${owner}_${repo}_${prNumber}`;
    const jsonFile = path.join(outputDirectory, `${baseName}.json`);
    const mdFile = path.join(outputDirectory, `${baseName}.md`);
    const htmlFile = path.join(outputDirectory, `${baseName}.html`);

    await Promise.all([
      fs.writeFile(jsonFile, reportGenerator.generateJSONReport(report), 'utf-8'),
      fs.writeFile(mdFile, reportGenerator.generateMarkdownReport(report), 'utf-8'),
      fs.writeFile(htmlFile, reportGenerator.generateHTMLReport(report), 'utf-8')
    ]);

    console.log('\n[SUCCESS] Code review analysis successfully generated:');
    console.log(`  • Overall Score: ${report.summary.overallScore}/100`);
    console.log(`  • Files Evaluated: ${report.summary.totalFiles}`);
    console.log(`  • Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`  • Generated JSON:     ${jsonFile}`);
    console.log(`  • Generated Markdown: ${mdFile}`);
    console.log(`  • Generated HTML:     ${htmlFile}`);
  } catch (error) {
    if (error instanceof ReviewError) {
      console.error(`\n[REVIEW ERROR] [${error.code}]: ${error.message}`);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    } else {
      console.error('\n[UNEXPECTED ERROR]:', formatError(error));
    }
    process.exit(1);
  }
}

run();
