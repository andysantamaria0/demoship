import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the video to verify ownership and status
  const { data: video, error: fetchError } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const retryableStatuses = ["failed", "rendering"];
  if (!retryableStatuses.includes(video.status)) {
    return NextResponse.json(
      { error: "Can only retry failed or stuck videos" },
      { status: 400 }
    );
  }

  // Reset the video status
  const { error: updateError } = await supabase
    .from("videos")
    .update({
      status: "pending",
      error_message: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Re-trigger processing by calling the videos API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${baseUrl}/api/videos/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId: id }),
  }).catch(console.error);

  return NextResponse.json({ success: true });
}
