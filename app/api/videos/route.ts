import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parsePRUrl, fetchPRData, fetchPRComments } from "@/lib/github";
import { parseScreenshotsFromComments, extractPreviewUrlsFromComments } from "@/lib/screenshots";
import { capturePreviewScreenshots } from "@/lib/preview-capture";
import { analyzePR, analyzeMultiplePRs } from "@/lib/claude";
import { generateVoice } from "@/lib/elevenlabs";
import { nanoid } from "nanoid";
import type { Video, VideoWithPRs, VideoPR, ParsedPRInfo, PRScreenshot } from "@/lib/types";
import type { PRDataWithNumber } from "@/lib/github";

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
  // Support both old single prUrl and new prUrls array
  const prUrls: string[] = body.prUrls || (body.prUrl ? [body.prUrl] : []);

  if (!prUrls.length) {
    return NextResponse.json(
      { error: "At least one PR URL is required" },
      { status: 400 }
    );
  }

  if (prUrls.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 PRs allowed per video" },
      { status: 400 }
    );
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

  // Create the video record (use first PR as primary for backward compatibility)
  const shareId = nanoid(10);
  const { data: video, error: insertError } = await supabase
    .from("videos")
    .insert({
      user_id: user.id,
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
    return NextResponse.json({ error: insertError.message }, { status: 500 });
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
      return NextResponse.json({ error: videoPRsError.message }, { status: 500 });
    }
  }

  // Start async processing (don't await)
  processVideo(video.id).catch(console.error);

  return NextResponse.json(video);
}

async function processVideo(videoId: string) {
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

    // Fetch comments for all PRs to extract screenshots
    const commentsPromises = sortedPRs.map((vpr) =>
      fetchPRComments(video.pr_owner, video.pr_repo, vpr.pr_number)
    );

    const [prDataResults, commentsResults] = await Promise.all([
      Promise.all(prDataPromises),
      Promise.all(commentsPromises),
    ]);

    // Parse screenshots from all PR comments
    const allComments = commentsResults.flat();
    let screenshots = parseScreenshotsFromComments(allComments);

    // If no screenshots found, try auto-capture from preview URLs
    const remotionServerUrl = process.env.REMOTION_SERVER_URL;
    const webhookSecret = process.env.REMOTION_WEBHOOK_SECRET;

    if (screenshots.length === 0 && remotionServerUrl && webhookSecret) {
      console.log(`[${videoId}] No screenshots found, attempting auto-capture...`);

      // Extract preview URLs from comments
      const previewUrls = extractPreviewUrlsFromComments(allComments);

      if (previewUrls.length > 0) {
        // Use the first preview URL for auto-capture
        const firstPreviewUrl = previewUrls[0];
        console.log(`[${videoId}] Found preview URL: ${firstPreviewUrl.url}`);

        try {
          const capturedScreenshots = await capturePreviewScreenshots(
            { url: firstPreviewUrl.url, routes: ["/"] },
            remotionServerUrl,
            webhookSecret
          );

          if (capturedScreenshots.length > 0) {
            console.log(`[${videoId}] Auto-captured ${capturedScreenshots.length} screenshots`);

            // Upload captured screenshots to Supabase storage
            for (let i = 0; i < capturedScreenshots.length; i++) {
              const captured = capturedScreenshots[i];
              const filename = `screenshots/${videoId}-${i}.png`;

              const { error: uploadError } = await supabase.storage
                .from("media")
                .upload(filename, captured.buffer, {
                  contentType: "image/png",
                  upsert: true,
                });

              if (uploadError) {
                console.warn(`Failed to upload screenshot ${i}:`, uploadError.message);
                continue;
              }

              const {
                data: { publicUrl },
              } = supabase.storage.from("media").getPublicUrl(filename);

              screenshots.push({
                url: publicUrl,
                alt_text: `Auto-captured: ${captured.route}`,
                source: "auto-capture",
                comment_id: 0,
                comment_author: null,
                display_order: i,
              });
            }
          }
        } catch (captureError) {
          console.warn(`[${videoId}] Auto-capture failed:`, captureError);
          // Non-fatal: continue without auto-captured screenshots
        }
      }
    }

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

    // Calculate totals and use first PR as primary display
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

      const { error: screenshotsError } = await supabase
        .from("pr_screenshots")
        .insert(screenshotsData);

      if (screenshotsError) {
        console.warn("Failed to store screenshots:", screenshotsError.message);
        // Non-fatal: continue processing without screenshots
      }
    }

    // Analyze with Claude - use multi-PR or single-PR analysis
    let analysis;
    let displayTitle: string;

    if (isMultiPR) {
      // Build PRDataWithNumber array for multi-PR analysis
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

      // Update pr_title with unified title for multi-PR
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
    if (remotionServerUrl) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/render-complete`;

      // Collect all PR titles for multi-PR display
      const prTitles = isMultiPR
        ? prDataResults.map((pr) => pr.title)
        : undefined;

      // Format screenshots for Remotion
      const remotionScreenshots = screenshots.map((s, index) => ({
        url: s.url,
        alt_text: s.alt_text,
        source: s.source,
        display_order: index,
      }));

      // Fetch screen recording if exists
      const { data: screenRecording } = await supabase
        .from("screen_recordings")
        .select("storage_path, duration_ms")
        .eq("video_id", videoId)
        .single();

      let remotionScreenRecording: { url: string; durationMs: number } | undefined;
      if (screenRecording) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(screenRecording.storage_path);
        remotionScreenRecording = {
          url: publicUrl,
          durationMs: screenRecording.duration_ms,
        };
      }

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
            screenRecording: remotionScreenRecording,
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
