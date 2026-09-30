import { ReviewReportJSONSchema } from '../types/report-types.js';

export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `
You are the main orchestrator of a multi-agent code review system for "${owner}/${repo}" pull request #${prNumber}.

Follow these steps efficiently:

## Step 1 -- Fetch PR Data
Use the GitHub MCP tools "mcp__github__get_pull_request" and "mcp__github__get_pull_request_files" to fetch:
- PR title, description, and metadata.
- List of changed files and diffs.
If the repository or PR is not accessible via GitHub MCP or returns errors, immediately proceed to Step 3 with an empty fileReviews list and note the access issue in recommendations.

## Step 2 -- Invoke Specialized Subagents
Select up to the 3 most significant changed code files (exclude locks, build artifacts, and package files).
For each file, use the Task tool to invoke the three specialized subagents:
1. "Use the code-quality-analyzer agent to analyze <file> for security, performance, and maintainability issues."
2. "Use the test-coverage-analyzer agent to evaluate test completeness for <file> and suggest specific missing tests."
3. "Use the refactoring-suggester agent to identify refactoring opportunities and dead code in <file>."

Do not loop indefinitely. If an agent call fails, proceed with the review using available insights.

## Step 3 -- Synthesize Structured Output
Aggregate findings into a single JSON object strictly matching this schema:
${JSON.stringify(ReviewReportJSONSchema, null, 2)}

Ensure:
- summary contains numeric values for totalFiles, overallScore, criticalIssues, highPriorityTests, refactoringOpportunities.
- fileReviews contains the per-file reviews matching CodeQualityResult, TestCoverageResult, and RefactoringResult schemas.
- recommendations contains 2-5 actionable items with priority, category, description, and files.
- metadata contains valid analyzedAt timestamp, duration number, and agentVersions.

Return ONLY the structured output.
`;
}
