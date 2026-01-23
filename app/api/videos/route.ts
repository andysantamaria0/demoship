import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parsePRUrl, fetchPRData } from "@/lib/github";
import { analyzePR } from "@/lib/claude";
import { generateVoice } from "@/lib/elevenlabs";
import { nanoid } from "nanoid";
import type { Video } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: videos, error } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(videos);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { prUrl } = body;

  if (!prUrl) {
    return NextResponse.json(
      { error: "PR URL is required" },
      { status: 400 }
    );
  }

  // Parse the PR URL
  const prInfo = parsePRUrl(prUrl);
  if (!prInfo) {
    return NextResponse.json(
      { error: "Invalid GitHub PR URL" },
      { status: 400 }
    );
  }

  // Create the video record
  const shareId = nanoid(10);
  const { data: video, error: insertError } = await supabase
    .from("videos")
    .insert({
      user_id: user.id,
      pr_url: prUrl,
      pr_owner: prInfo.owner,
      pr_repo: prInfo.repo,
      pr_number: prInfo.number,
      share_id: shareId,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Start async processing (don't await)
  processVideo(video.id).catch(console.error);

  return NextResponse.json(video);
}

async function processVideo(videoId: string) {
  const supabase = createServiceClient();

  try {
    // Get the video record
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      throw new Error("Video not found");
    }

    // Update status to analyzing
    await supabase
      .from("videos")
      .update({ status: "analyzing" })
      .eq("id", videoId);

    // Fetch PR data from GitHub
    const prData = await fetchPRData(
      video.pr_owner,
      video.pr_repo,
      video.pr_number
    );

    // Update with PR metadata
    await supabase
      .from("videos")
      .update({
        pr_title: prData.title,
        pr_description: prData.description,
        pr_author: prData.author,
        pr_author_avatar: prData.authorAvatar,
        pr_files_changed: prData.filesChanged,
        pr_additions: prData.additions,
        pr_deletions: prData.deletions,
      })
      .eq("id", videoId);

    // Analyze with Claude
    const analysis = await analyzePR(prData);

    await supabase
      .from("videos")
      .update({
        ai_summary: analysis.summary,
        ai_script: analysis.script,
        change_type: analysis.changeType,
        status: "generating_audio",
      })
      .eq("id", videoId);

    // Generate voice with ElevenLabs
    const audioBuffer = await generateVoice(analysis.script);

    // Upload audio to Supabase Storage
    const audioFileName = `${videoId}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(`audio/${audioFileName}`, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    const {
      data: { publicUrl: audioUrl },
    } = supabase.storage.from("media").getPublicUrl(`audio/${audioFileName}`);

    await supabase
      .from("videos")
      .update({
        audio_url: audioUrl,
        status: "rendering",
      })
      .eq("id", videoId);

    // Trigger video rendering on Railway
    const remotionServerUrl = process.env.REMOTION_SERVER_URL;
    if (remotionServerUrl) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/render-complete`;

      const renderResponse = await fetch(`${remotionServerUrl}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REMOTION_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({
          videoId,
          prData: {
            title: prData.title,
            description: prData.description,
            author: prData.author,
            authorAvatar: prData.authorAvatar,
            filesChanged: prData.filesChanged,
            additions: prData.additions,
            deletions: prData.deletions,
            files: prData.files,
            repo: `${video.pr_owner}/${video.pr_repo}`,
          },
          aiSummary: analysis.summary,
          aiScript: analysis.script,
          audioUrl,
          callbackUrl: webhookUrl,
        }),
      });

      if (!renderResponse.ok) {
        const errorText = await renderResponse.text();
        throw new Error(`Failed to start render: ${errorText}`);
      }
    } else {
      // No remotion server configured - mark as complete without video
      // This is useful for development/testing
      await supabase
        .from("videos")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoId);
    }
  } catch (error) {
    console.error("Error processing video:", error);

    // Update status to failed
    await supabase
      .from("videos")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", videoId);
  }
}
