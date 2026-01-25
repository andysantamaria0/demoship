import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateApiKey } from "@/lib/api-auth";

// GET /api/v1/videos/[id] - Get video status via API key authentication
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate API key
  const authHeader = request.headers.get("Authorization");
  const validation = await validateApiKey(authHeader);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 401 }
    );
  }

  const supabase = createServiceClient();

  // Get the video record
  const { data: video, error } = await supabase
    .from("videos")
    .select("id, user_id, status, share_id, video_url, error_message, created_at, completed_at")
    .eq("id", id)
    .single();

  if (error || !video) {
    return NextResponse.json(
      { error: "Video not found" },
      { status: 404 }
    );
  }

  // Verify the video belongs to the API key owner
  if (video.user_id !== validation.userId) {
    return NextResponse.json(
      { error: "Video not found" },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://demoship.dev";

  return NextResponse.json({
    video_id: video.id,
    status: video.status,
    share_url: video.share_id ? `${appUrl}/v/${video.share_id}` : null,
    video_url: video.video_url,
    error: video.error_message,
    created_at: video.created_at,
    completed_at: video.completed_at,
  });
}
