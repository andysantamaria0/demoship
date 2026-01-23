import Anthropic from "@anthropic-ai/sdk";
import type { PRData } from "./github";
import { formatPRDataForAI } from "./github";

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
