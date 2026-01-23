import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getChangeTypeConfig } from "@/lib/design";
import { design } from "@/lib/design";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ shareId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const supabase = createServiceClient();

  const { data: video } = await supabase
    .from("videos")
    .select("pr_title, ai_summary, pr_owner, pr_repo")
    .eq("share_id", shareId)
    .eq("status", "complete")
    .single();

  if (!video) {
    return {
      title: "Video Not Found",
    };
  }

  return {
    title: `${video.pr_title} - ${design.brand.name}`,
    description: video.ai_summary || `Demo video for ${video.pr_owner}/${video.pr_repo}`,
    openGraph: {
      title: video.pr_title || "Demo Video",
      description: video.ai_summary || "Watch this demo video",
      type: "video.other",
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { shareId } = await params;
  const supabase = createServiceClient();

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("share_id", shareId)
    .eq("status", "complete")
    .single();

  if (error || !video) {
    notFound();
  }

  // Increment view count
  await supabase
    .from("videos")
    .update({ view_count: video.view_count + 1 })
    .eq("id", video.id);

  const changeTypeConfig = video.change_type
    ? getChangeTypeConfig(video.change_type)
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Video player */}
        <div className="mb-8">
          {video.video_url ? (
            <VideoPlayer
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              title={video.pr_title || undefined}
            />
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Video not available</p>
            </div>
          )}
        </div>

        {/* Video info */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold">
                  {video.pr_title || `PR #${video.pr_number}`}
                </h1>
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
              <a
                href={video.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                {video.pr_owner}/{video.pr_repo}#{video.pr_number}
              </a>
            </div>

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
                <CardTitle className="text-base">Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Files changed</span>
                  <span>{video.pr_files_changed || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Additions</span>
                  <span className="text-green-600">
                    +{video.pr_additions || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deletions</span>
                  <span className="text-red-600">
                    -{video.pr_deletions || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Generate your own demo videos from GitHub pull requests.
                </p>
                <Link href="/">
                  <Button className="w-full">Try {design.brand.name}</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Watermark */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          Made with{" "}
          <Link href="/" className="font-medium hover:underline">
            {design.brand.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
