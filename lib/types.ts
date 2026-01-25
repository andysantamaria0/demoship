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

  // PR metadata (for single PR or primary PR in multi-PR)
  pr_title: string | null;
  pr_description: string | null;
  pr_author: string | null;
  pr_author_avatar: string | null;
  pr_files_changed: number | null;
  pr_additions: number | null;
  pr_deletions: number | null;

  // Multi-PR aggregate fields
  pr_count: number;
  total_files_changed: number | null;
  total_additions: number | null;
  total_deletions: number | null;

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
  prUrls: string[];
}

export interface VideoPR {
  id: string;
  video_id: string;
  pr_url: string;
  pr_number: number;
  display_order: number;
  pr_title: string | null;
  pr_description: string | null;
  pr_author: string | null;
  pr_author_avatar: string | null;
  pr_files_changed: number | null;
  pr_additions: number | null;
  pr_deletions: number | null;
  created_at: string;
}

export interface VideoWithPRs extends Video {
  video_prs: VideoPR[];
}

export interface VideoWithProfile extends Video {
  profiles: Profile | null;
}

export interface ParsedPRInfo {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

// Screenshot types
export type ScreenshotSource = 'vercel' | 'chromatic' | 'percy' | 'generic';

export interface PRScreenshot {
  id?: string;
  video_id?: string;
  url: string;
  alt_text: string | null;
  source: ScreenshotSource;
  comment_id: number;
  comment_author: string | null;
  display_order: number;
  created_at?: string;
}

export interface VideoWithScreenshots extends Video {
  pr_screenshots: PRScreenshot[];
}
