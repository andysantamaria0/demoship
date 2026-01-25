import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { feedback, prUrl, videoId, timeToComplete } = body;

  // Validate feedback text
  if (!feedback || typeof feedback !== "string" || feedback.trim().length < 10) {
    return NextResponse.json(
      { error: "Feedback must be at least 10 characters" },
      { status: 400 }
    );
  }

  const githubUsername = user.user_metadata?.user_name || user.email || "Unknown";

  // Insert feedback into database
  const { error: insertError } = await supabase.from("feedback").insert({
    user_id: user.id,
    github_username: githubUsername,
    feedback: feedback.trim(),
    pr_url: prUrl || null,
    video_id: videoId || null,
    time_to_complete_ms: timeToComplete || null,
  });

  if (insertError) {
    console.error("Error inserting feedback:", insertError);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }

  // Send email via Resend
  try {
    const timeFormatted = timeToComplete ? formatDuration(timeToComplete) : "N/A";
    const resend = getResendClient();

    await resend.emails.send({
      from: "DemoShip Feedback <feedback@demoship.dev>",
      to: "andyjsantamaria@gmail.com",
      subject: `Feedback from ${githubUsername}`,
      text: `From: ${githubUsername}
PR: ${prUrl || "N/A"}
Time to complete: ${timeFormatted}

Feedback:
${feedback.trim()}`,
    });
  } catch (emailError) {
    // Log but don't fail the request - feedback is already saved
    console.error("Error sending feedback email:", emailError);
  }

  return NextResponse.json({ success: true });
}
