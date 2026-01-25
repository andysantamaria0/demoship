import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateApiKey, checkRateLimit } from "@/lib/api-auth";
import { parsePRUrl, fetchPRData, fetchPRComments } from "@/lib/github";
import { parseScreenshotsFromComments } from "@/lib/screenshots";
import { analyzePR, analyzeMultiplePRs } from "@/lib/claude";
import { generateVoice } from "@/lib/elevenlabs";
import { nanoid } from "nanoid";
import type { VideoPR, ParsedPRInfo } from "@/lib/types";
import type { PRDataWithNumber } from "@/lib/github";

// POST /api/v1/videos - Create a video via API key authentication
export async function POST(request: Request) {
  // Validate API key
  const authHeader = request.headers.get("Authorization");
  const validation = await validateApiKey(authHeader);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 401 }
    );
  }

  // Check rate limit (10 requests per minute per API key)
  const rateLimit = checkRateLimit(validation.keyId!, 10, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support both pr_urls and prUrls for flexibility
  const prUrls: string[] = body.pr_urls || body.prUrls || [];
  const webhookUrl: string | undefined = body.webhook_url;

  if (!prUrls.length) {
    return NextResponse.json(
      { error: "At least one PR URL is required in pr_urls array" },
      { status: 400 }
    );
  }

  if (prUrls.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 PRs allowed per video" },
      { status: 400 }
    );
  }

  // Validate webhook URL if provided
  if (webhookUrl) {
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook_url format" },
        { status: 400 }
      );
    }
  }

  // Parse and validate all PR URLs
  const parsedPRs: ParsedPRInfo[] = [];
  for (const url of prUrls) {
    const prInfo = parsePRUrl(url);
    if (!prInfo) {
      return NextResponse.json(
        { error: `Invalid GitHub PR URL: ${url}` },
        { status: 400 }
      );
    }
    parsedPRs.push({ ...prInfo, url });
  }

  // Validate all PRs are from the same repository
  const firstPR = parsedPRs[0];
  for (const pr of parsedPRs) {
    if (pr.owner !== firstPR.owner || pr.repo !== firstPR.repo) {
      return NextResponse.json(
        { error: "All PRs must be from the same repository" },
        { status: 400 }
      );
    }
  }

  // Check for duplicate PR numbers
  const prNumbers = parsedPRs.map((pr) => pr.number);
  const uniqueNumbers = new Set(prNumbers);
  if (uniqueNumbers.size !== prNumbers.length) {
    return NextResponse.json(
      { error: "Duplicate PRs are not allowed" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Create the video record
  const shareId = nanoid(10);
  const { data: video, error: insertError } = await supabase
    .from("videos")
    .insert({
      user_id: validation.userId,
      pr_url: firstPR.url,
      pr_owner: firstPR.owner,
      pr_repo: firstPR.repo,
      pr_number: firstPR.number,
      pr_count: parsedPRs.length,
      share_id: shareId,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating video:", insertError);
    return NextResponse.json(
      { error: "Failed to create video" },
      { status: 500 }
    );
  }

  // Insert all PRs into video_prs table
  if (parsedPRs.length > 0) {
    const videoPRsData = parsedPRs.map((pr, index) => ({
      video_id: video.id,
      pr_url: pr.url,
      pr_number: pr.number,
      display_order: index,
    }));

    const { error: videoPRsError } = await supabase
      .from("video_prs")
      .insert(videoPRsData);

    if (videoPRsError) {
      // Clean up the video record if PR inserts fail
      await supabase.from("videos").delete().eq("id", video.id);
      console.error("Error inserting video_prs:", videoPRsError);
      return NextResponse.json(
        { error: "Failed to create video" },
        { status: 500 }
      );
    }
  }

  // Start async processing
  processVideoWithWebhook(video.id, webhookUrl).catch(console.error);

  // Return immediately with video info
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://demoship.dev";
  return NextResponse.json(
    {
      video_id: video.id,
      status: "pending",
      share_url: `${appUrl}/v/${shareId}`,
      status_url: `${appUrl}/api/v1/videos/${video.id}`,
    },
    {
      status: 202,
      headers: {
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
      },
    }
  );
}

async function processVideoWithWebhook(videoId: string, webhookUrl?: string) {
  const supabase = createServiceClient();

  try {
    // Get the video record with associated PRs
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("*, video_prs(*)")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      throw new Error("Video not found");
    }

    const videoPRs: VideoPR[] = video.video_prs || [];
    const isMultiPR = videoPRs.length > 1;

    // Update status to analyzing
    await supabase
      .from("videos")
      .update({ status: "analyzing" })
      .eq("id", videoId);

    // Fetch PR data and comments from GitHub in parallel
    const sortedPRs = videoPRs.length > 0
      ? videoPRs.sort((a, b) => a.display_order - b.display_order)
      : [{ pr_number: video.pr_number }];

    const prDataPromises = sortedPRs.map((vpr) =>
      fetchPRData(video.pr_owner, video.pr_repo, vpr.pr_number)
    );

    const commentsPromises = sortedPRs.map((vpr) =>
      fetchPRComments(video.pr_owner, video.pr_repo, vpr.pr_number)
    );

    const [prDataResults, commentsResults] = await Promise.all([
      Promise.all(prDataPromises),
      Promise.all(commentsPromises),
    ]);

    // Parse screenshots from all PR comments
    const allComments = commentsResults.flat();
    const screenshots = parseScreenshotsFromComments(allComments);

    // Update each video_pr with its metadata
    if (videoPRs.length > 0) {
      for (let i = 0; i < videoPRs.length; i++) {
        const prData = prDataResults[i];
        await supabase
          .from("video_prs")
          .update({
            pr_title: prData.title,
            pr_description: prData.description,
            pr_author: prData.author,
            pr_author_avatar: prData.authorAvatar,
            pr_files_changed: prData.filesChanged,
            pr_additions: prData.additions,
            pr_deletions: prData.deletions,
          })
          .eq("id", videoPRs[i].id);
      }
    }

    // Calculate totals
    const firstPRData = prDataResults[0];
    const totalFilesChanged = prDataResults.reduce((sum, pr) => sum + pr.filesChanged, 0);
    const totalAdditions = prDataResults.reduce((sum, pr) => sum + pr.additions, 0);
    const totalDeletions = prDataResults.reduce((sum, pr) => sum + pr.deletions, 0);

    // Update video with PR metadata and totals
    await supabase
      .from("videos")
      .update({
        pr_title: firstPRData.title,
        pr_description: firstPRData.description,
        pr_author: firstPRData.author,
        pr_author_avatar: firstPRData.authorAvatar,
        pr_files_changed: firstPRData.filesChanged,
        pr_additions: firstPRData.additions,
        pr_deletions: firstPRData.deletions,
        total_files_changed: totalFilesChanged,
        total_additions: totalAdditions,
        total_deletions: totalDeletions,
        screenshot_count: screenshots.length,
      })
      .eq("id", videoId);

    // Store screenshots in database
    if (screenshots.length > 0) {
      const screenshotsData = screenshots.map((screenshot, index) => ({
        video_id: videoId,
        url: screenshot.url,
        alt_text: screenshot.alt_text,
        source: screenshot.source,
        comment_id: screenshot.comment_id,
        comment_author: screenshot.comment_author,
        display_order: index,
      }));

      await supabase.from("pr_screenshots").insert(screenshotsData);
    }

    // Analyze with Claude
    let analysis;
    let displayTitle: string;

    if (isMultiPR) {
      const prDataWithNumbers: PRDataWithNumber[] = prDataResults.map((prData, index) => ({
        ...prData,
        prNumber: videoPRs[index].pr_number,
      }));

      const multiAnalysis = await analyzeMultiplePRs(
        prDataWithNumbers,
        video.pr_owner,
        video.pr_repo
      );
      analysis = multiAnalysis;
      displayTitle = multiAnalysis.unifiedTitle;

      await supabase
        .from("videos")
        .update({ pr_title: displayTitle })
        .eq("id", videoId);
    } else {
      analysis = await analyzePR(firstPRData);
      displayTitle = firstPRData.title;
    }

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

    // Trigger video rendering
    const remotionServerUrl = process.env.REMOTION_SERVER_URL;
    if (remotionServerUrl) {
      const internalWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/render-complete`;

      const prTitles = isMultiPR
        ? prDataResults.map((pr) => pr.title)
        : undefined;

      const remotionScreenshots = screenshots.map((s, index) => ({
        url: s.url,
        alt_text: s.alt_text,
        source: s.source,
        display_order: index,
      }));

      const renderResponse = await fetch(`${remotionServerUrl}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REMOTION_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({
          videoId,
          prData: {
            title: displayTitle,
            description: firstPRData.description,
            author: firstPRData.author,
            authorAvatar: firstPRData.authorAvatar,
            filesChanged: isMultiPR ? totalFilesChanged : firstPRData.filesChanged,
            additions: isMultiPR ? totalAdditions : firstPRData.additions,
            deletions: isMultiPR ? totalDeletions : firstPRData.deletions,
            files: firstPRData.files,
            repo: `${video.pr_owner}/${video.pr_repo}`,
            prCount: video.pr_count || 1,
            prTitles,
            screenshots: remotionScreenshots.length > 0 ? remotionScreenshots : undefined,
          },
          aiSummary: analysis.summary,
          aiScript: analysis.script,
          audioUrl,
          callbackUrl: internalWebhookUrl,
          externalWebhookUrl: webhookUrl, // Pass through for external notification
        }),
      });

      if (!renderResponse.ok) {
        const errorText = await renderResponse.text();
        throw new Error(`Failed to start render: ${errorText}`);
      }
    } else {
      // No remotion server - mark as complete
      await supabase
        .from("videos")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      // Send webhook notification if configured
      if (webhookUrl) {
        await sendWebhookNotification(webhookUrl, videoId, "complete");
      }
    }
  } catch (error) {
    console.error("Error processing video:", error);

    await supabase
      .from("videos")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", videoId);

    // Send failure webhook if configured
    if (webhookUrl) {
      await sendWebhookNotification(webhookUrl, videoId, "failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
}

async function sendWebhookNotification(
  webhookUrl: string,
  videoId: string,
  status: string,
  error?: string
) {
  try {
    const supabase = createServiceClient();
    const { data: video } = await supabase
      .from("videos")
      .select("share_id, video_url")
      .eq("id", videoId)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://demoship.dev";

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        status,
        share_url: video?.share_id ? `${appUrl}/v/${video.share_id}` : null,
        video_url: video?.video_url || null,
        error: error || null,
      }),
    });
  } catch (err) {
    console.error("Failed to send webhook notification:", err);
  }
}
