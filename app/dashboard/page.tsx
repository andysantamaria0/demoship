import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRInput } from "@/components/pr-input";
import { VideoCard } from "@/components/video-card";
import type { Video } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Generate and manage your demo videos
          </p>
        </div>

        {/* PR Input */}
        <div className="mb-12 p-6 bg-muted/30 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Create New Video</h2>
          <PRInput />
        </div>

        {/* Videos List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Videos</h2>
          {videos && videos.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {videos.map((video: Video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground mb-2">No videos yet</p>
              <p className="text-sm text-muted-foreground">
                Paste a GitHub PR URL above to generate your first video
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
