import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Verify webhook secret
  const authHeader = request.headers.get("authorization");
  const expectedSecret = `Bearer ${process.env.REMOTION_WEBHOOK_SECRET}`;

  if (authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { videoId, videoUrl, thumbnailUrl, durationSeconds, error } = body;

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  if (error) {
    // Render failed
    await supabase
      .from("videos")
      .update({
        status: "failed",
        error_message: error,
      })
      .eq("id", videoId);

    return NextResponse.json({ success: true });
  }

  // Render succeeded
  await supabase
    .from("videos")
    .update({
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      duration_seconds: durationSeconds,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", videoId);

  return NextResponse.json({ success: true });
}
