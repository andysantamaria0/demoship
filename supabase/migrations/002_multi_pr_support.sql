-- Multi-PR support migration
-- Allows users to add up to 10 PRs from the same repository for unified video generation

-- Create video_prs table for individual PR data (one-to-many with videos)
CREATE TABLE video_prs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  pr_url TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  pr_title TEXT,
  pr_description TEXT,
  pr_author TEXT,
  pr_author_avatar TEXT,
  pr_files_changed INTEGER,
  pr_additions INTEGER,
  pr_deletions INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(video_id, pr_number)
);

-- Add aggregate fields to videos table for multi-PR support
ALTER TABLE videos
  ADD COLUMN pr_count INTEGER DEFAULT 1,
  ADD COLUMN total_files_changed INTEGER,
  ADD COLUMN total_additions INTEGER,
  ADD COLUMN total_deletions INTEGER;

-- Index for efficient lookups
CREATE INDEX idx_video_prs_video_id ON video_prs(video_id);

-- Enable Row Level Security
ALTER TABLE video_prs ENABLE ROW LEVEL SECURITY;

-- video_prs policies (inherit from videos table)
CREATE POLICY "Users can view own video PRs"
  ON video_prs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_prs.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create video PRs for own videos"
  ON video_prs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_prs.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own video PRs"
  ON video_prs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_prs.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view video PRs by share_id"
  ON video_prs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_prs.video_id
      AND videos.share_id IS NOT NULL
    )
  );
