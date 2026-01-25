import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPRData } from "@/lib/github";
import { analyzePR } from "@/lib/claude";
import { generateVoice } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const body = await request.json();
  const { videoId } = body;

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
  }

  // Start processing in background
  processVideo(videoId).catch(console.error);

  return NextResponse.json({ success: true });
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
    const { audioBuffer, durationMs: audioDurationMs } = await generateVoice(analysis.script);

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
        audio_duration_ms: audioDurationMs,
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
          audioDurationMs,
          callbackUrl: webhookUrl,
        }),
      });

      if (!renderResponse.ok) {
        const errorText = await renderResponse.text();
        throw new Error(`Failed to start render: ${errorText}`);
      }
    } else {
      // No remotion server configured - mark as complete without video
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
