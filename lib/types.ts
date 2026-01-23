export interface Profile {
  id: string;
  github_username: string | null;
  avatar_url: string | null;
  videos_generated_this_month: number;
  created_at: string;
}

export type VideoStatus =
  | "pending"
  | "analyzing"
  | "generating_audio"
  | "rendering"
  | "complete"
  | "failed";

export type ChangeType = "feature" | "bugfix" | "refactor" | "docs" | "other";

export interface Video {
  id: string;
  user_id: string;

  // Input
  pr_url: string;
  pr_owner: string;
  pr_repo: string;
  pr_number: number;

  // PR metadata
  pr_title: string | null;
  pr_description: string | null;
  pr_author: string | null;
  pr_author_avatar: string | null;
  pr_files_changed: number | null;
  pr_additions: number | null;
  pr_deletions: number | null;

  // AI analysis
  ai_summary: string | null;
  ai_script: string | null;
  change_type: ChangeType | null;

  // Generated assets
  audio_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;

  // Status
  status: VideoStatus;
  error_message: string | null;
  duration_seconds: number | null;

  // Sharing
  share_id: string | null;
  view_count: number;

  created_at: string;
  completed_at: string | null;
}

export interface CreateVideoInput {
  prUrl: string;
}

export interface VideoWithProfile extends Video {
  profiles: Profile | null;
}
