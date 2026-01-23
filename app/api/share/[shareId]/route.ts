import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const supabase = createServiceClient();

  // Fetch video by share ID (public access)
  const { data: video, error } = await supabase
    .from("videos")
    .select(
      `
      id,
      pr_url,
      pr_owner,
      pr_repo,
      pr_number,
      pr_title,
      pr_description,
      pr_author,
      pr_author_avatar,
      pr_files_changed,
      pr_additions,
      pr_deletions,
      ai_summary,
      change_type,
      video_url,
      thumbnail_url,
      status,
      duration_seconds,
      share_id,
      view_count,
      created_at
    `
    )
    .eq("share_id", shareId)
    .eq("status", "complete")
    .single();

  if (error || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Increment view count
  await supabase
    .from("videos")
    .update({ view_count: video.view_count + 1 })
    .eq("id", video.id);

  return NextResponse.json(video);
}
