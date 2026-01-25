import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/video-player";
import { GenerationStatus } from "@/components/generation-status";
import { CopyShareLink } from "@/components/copy-share-link";
import { RetryButton } from "@/components/retry-button";
import { RecordingUpload } from "@/components/recording-upload";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getChangeTypeConfig } from "@/lib/design";
import type { Video, VideoWithPRs, VideoPR } from "@/lib/types";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: video, error } = await supabase
    .from("videos")
    .select("*, video_prs(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !video) {
    notFound();
  }

  // Fetch screen recording if exists
  const { data: screenRecording } = await supabase
    .from("screen_recordings")
    .select("*")
    .eq("video_id", id)
    .single();

  // Get public URL for screen recording if it exists
  let existingRecording = null;
  if (screenRecording) {
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(screenRecording.storage_path);
    existingRecording = {
      url: publicUrl,
      duration_ms: screenRecording.duration_ms,
      file_size_bytes: screenRecording.file_size_bytes,
    };
  }

  const videoWithPRs = video as VideoWithPRs;
  const videoPRs: VideoPR[] = (videoWithPRs.video_prs || []).sort(
    (a, b) => a.display_order - b.display_order
  );
  const isMultiPR = videoPRs.length > 1;

  const isComplete = video.status === "complete";
  const canRetry = video.status === "failed" || video.status === "rendering";
  const canUploadRecording = !["complete", "rendering"].includes(video.status);
  const changeTypeConfig = video.change_type
    ? getChangeTypeConfig(video.change_type)
    : null;

  const shareUrl = video.share_id
    ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/v/${video.share_id}`
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Video player or status */}
        <div className="mb-8">
          {isComplete && video.video_url ? (
            <VideoPlayer
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              title={video.pr_title || undefined}
            />
          ) : (
            <div className="space-y-4">
              <GenerationStatus video={video as Video} />
              {canRetry && (
                <div className="flex justify-center">
                  <RetryButton videoId={video.id} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback prompt for completed videos */}
        {isComplete && (
          <div className="mb-8">
            <FeedbackPrompt
              videoId={video.id}
              prUrl={video.pr_url}
              githubUsername={user.user_metadata?.user_name}
              createdAt={video.created_at}
              completedAt={video.completed_at}
            />
          </div>
        )}

        {/* Video info */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold">
                  {video.pr_title || `PR #${video.pr_number}`}
                </h1>
                <div className="flex items-center gap-2">
                  {isMultiPR && (
                    <Badge variant="secondary">
                      {videoPRs.length} PRs combined
                    </Badge>
                  )}
                  {changeTypeConfig && (
                    <Badge
                      style={{
                        backgroundColor: changeTypeConfig.bg,
                        color: changeTypeConfig.text,
                      }}
                    >
                      {changeTypeConfig.label}
                    </Badge>
                  )}
                </div>
              </div>
              <a
                href={`https://github.com/${video.pr_owner}/${video.pr_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                {video.pr_owner}/{video.pr_repo}
              </a>
            </div>

            {/* Multi-PR list */}
            {isMultiPR && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Included Pull Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {videoPRs.map((pr) => (
                    <div key={pr.id} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <a
                          href={pr.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline text-sm"
                        >
                          #{pr.pr_number}: {pr.pr_title || `PR #${pr.pr_number}`}
                        </a>
                        {pr.pr_author && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {pr.pr_author}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {pr.pr_files_changed !== null && (
                          <span>{pr.pr_files_changed} files</span>
                        )}
                        {pr.pr_additions !== null && (
                          <span className="text-green-600">+{pr.pr_additions}</span>
                        )}
                        {pr.pr_deletions !== null && (
                          <span className="text-red-600">-{pr.pr_deletions}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {video.ai_summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{video.ai_summary}</p>
                </CardContent>
              </Card>
            )}

            {video.ai_script && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Narration Script</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {video.ai_script}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Screen Recording Upload */}
            {canUploadRecording && (
              <RecordingUpload
                videoId={video.id}
                existingRecording={existingRecording}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Author */}
            {video.pr_author && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Author</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={video.pr_author_avatar || undefined} />
                      <AvatarFallback>
                        {video.pr_author.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{video.pr_author}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isMultiPR ? "Total Changes" : "Changes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isMultiPR && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pull requests</span>
                    <span>{videoPRs.length}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Files changed</span>
                  <span>
                    {isMultiPR
                      ? video.total_files_changed || 0
                      : video.pr_files_changed || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Additions</span>
                  <span className="text-green-600">
                    +{isMultiPR
                      ? video.total_additions || 0
                      : video.pr_additions || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deletions</span>
                  <span className="text-red-600">
                    -{isMultiPR
                      ? video.total_deletions || 0
                      : video.pr_deletions || 0}
                  </span>
                </div>
                {video.view_count > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Views</span>
                    <span>{video.view_count}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Share */}
            {isComplete && shareUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Share</CardTitle>
                </CardHeader>
                <CardContent>
                  <CopyShareLink url={shareUrl} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}
