import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
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

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the video to verify ownership and get asset URLs
  const { data: video, error: fetchError } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Delete associated files from storage
  const filesToDelete: string[] = [];

  if (video.audio_url) {
    const audioPath = extractStoragePath(video.audio_url);
    if (audioPath) filesToDelete.push(audioPath);
  }

  if (video.video_url) {
    const videoPath = extractStoragePath(video.video_url);
    if (videoPath) filesToDelete.push(videoPath);
  }

  if (video.thumbnail_url) {
    const thumbPath = extractStoragePath(video.thumbnail_url);
    if (thumbPath) filesToDelete.push(thumbPath);
  }

  // Delete files from storage (ignore errors - files may not exist)
  if (filesToDelete.length > 0) {
    await supabase.storage.from("media").remove(filesToDelete);
  }

  // Delete the video record (cascades to video_prs, pr_screenshots, screen_recordings)
  const { error: deleteError } = await supabase
    .from("videos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Failed to delete video:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// Extract storage path from full URL
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
