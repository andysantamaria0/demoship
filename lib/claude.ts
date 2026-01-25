import Anthropic from "@anthropic-ai/sdk";
import type { PRData } from "./github";
import { formatPRDataForAI, formatMultiplePRsForAI } from "./github";
import type { PRDataWithNumber } from "./github";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AIAnalysis {
  summary: string;
  script: string;
  changeType: "feature" | "bugfix" | "refactor" | "docs" | "other";
}

const SYSTEM_PROMPT = `You are an expert at translating technical code changes into clear, compelling business narratives.

Your audience is business stakeholders, CEOs, and engineering managers - NOT developers. They want to understand:
1. WHAT is being shipped (in plain English)
2. WHY it matters to the business/users
3. The value being delivered

Guidelines:
- Lead with business value, never technical details
- Use active voice and confident language
- Avoid ALL technical jargon (no "refactored", "middleware", "API endpoints", "modules", "components")
- Translate technical changes into user/business impact
- Be concise - every sentence should add value
- Sound professional but not robotic

Example transformations:
- "Added input validation" → "New safeguards ensure customer data is entered correctly"
- "Refactored database queries" → "The app now loads faster, improving customer experience"
- "Fixed null pointer exception" → "Resolved an issue causing errors for some customers"
- "Updated dependencies" → "Security improvements to keep customer data safe"`;

const USER_PROMPT = `Analyze this pull request and generate two things:

1. A brief SUMMARY (2-3 sentences) explaining what this change does and why it matters, written for a non-technical executive.

2. A NARRATION SCRIPT for a 60-90 second video demo. The script should follow this structure:

   **Hook (5-10 seconds)**: Lead with the business value
   - Example: "This update adds real-time notifications so customers never miss important updates"

   **What Changed (20-30 seconds)**: Explain changes in plain English, focusing on user-facing impact
   - Example: "Users will now see a badge when they have unread messages"

   **Why It Matters (15-20 seconds)**: Connect to business goals
   - Example: "This addresses the #1 customer complaint from last quarter"

   **Wrap-up (5-10 seconds)**: Summarize the value delivered
   - Example: "Ready for review and deployment"

3. Classify the change type as one of: feature, bugfix, refactor, docs, other

Respond in this exact JSON format:
{
  "summary": "Your 2-3 sentence summary here",
  "script": "Your full narration script here",
  "changeType": "feature|bugfix|refactor|docs|other"
}

Here's the pull request data:

`;

export async function analyzePR(prData: PRData): Promise<AIAnalysis> {
  const prContent = formatPRDataForAI(prData);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: USER_PROMPT + prContent,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  // Extract text content from the response
  const textContent = message.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude response");
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    summary: result.summary,
    script: result.script,
    changeType: result.changeType,
  };
}

export interface MultiPRAIAnalysis extends AIAnalysis {
  unifiedTitle: string;
}

const MULTI_PR_SYSTEM_PROMPT = `You are an expert at synthesizing multiple technical code changes into a clear, compelling, UNIFIED business narrative.

Your audience is business stakeholders, CEOs, and engineering managers - NOT developers. They want to understand:
1. The OVERARCHING THEME or goal that connects these changes
2. WHAT is being shipped (in plain English)
3. WHY it matters to the business/users
4. The combined value being delivered

CRITICAL: You must find the common thread that ties all PRs together. DO NOT create a list or summary of each PR separately. Instead, tell ONE cohesive story.

Guidelines:
- Find and emphasize the unifying narrative across all PRs
- Lead with business value, never technical details
- Use active voice and confident language
- Avoid ALL technical jargon (no "refactored", "middleware", "API endpoints", "modules", "components")
- Translate technical changes into user/business impact
- Be concise - every sentence should add value
- Sound professional but not robotic

Example transformations:
- Multiple auth-related PRs → "A complete security overhaul that protects customer accounts"
- Mix of UI and API changes → "A faster, more intuitive experience for customers"
- Multiple bug fixes → "Critical reliability improvements ensuring consistent service"`;

const MULTI_PR_USER_PROMPT = `Analyze these combined pull requests and generate:

1. A UNIFIED TITLE (5-10 words) that captures the overall theme of all changes. This should be a compelling headline, not a list.
   Good: "Complete checkout experience redesign"
   Bad: "PR #123, PR #124, and PR #125"
   Bad: "Authentication, UI fixes, and API updates"

2. A brief SUMMARY (2-3 sentences) explaining what these combined changes accomplish and why it matters, written for a non-technical executive. Emphasize the unified goal.

3. A NARRATION SCRIPT for a 90-120 second video demo. The script should follow this structure:

   **Hook (10-15 seconds)**: Lead with the overarching business value
   - Example: "This release transforms the customer onboarding experience with three major improvements working together"

   **Unified Story (40-50 seconds)**: Weave all changes into ONE narrative, not separate sections per PR
   - Focus on how changes work together
   - Explain the combined user-facing impact
   - Example: "Users will now see faster load times AND cleaner interfaces AND better error messages - all working together for a seamless experience"

   **Why It Matters (20-25 seconds)**: Connect to business goals
   - Example: "These improvements directly address the top customer pain points from Q4"

   **Wrap-up (10-15 seconds)**: Summarize the combined value delivered
   - Example: "Together, these changes represent our biggest user experience improvement this quarter"

4. Classify the OVERALL change type as one of: feature, bugfix, refactor, docs, other
   Choose based on the primary theme, not individual PRs.

Respond in this exact JSON format:
{
  "unifiedTitle": "Your 5-10 word unified title here",
  "summary": "Your 2-3 sentence unified summary here",
  "script": "Your full narration script here (90-120 seconds)",
  "changeType": "feature|bugfix|refactor|docs|other"
}

Here are the combined pull requests:

`;

export async function analyzeMultiplePRs(
  prDataList: PRDataWithNumber[],
  owner: string,
  repo: string
): Promise<MultiPRAIAnalysis> {
  const prContent = formatMultiplePRsForAI(prDataList, owner, repo);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: MULTI_PR_USER_PROMPT + prContent,
      },
    ],
    system: MULTI_PR_SYSTEM_PROMPT,
  });

  // Extract text content from the response
  const textContent = message.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude response");
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    unifiedTitle: result.unifiedTitle,
    summary: result.summary,
    script: result.script,
    changeType: result.changeType,
  };
}
