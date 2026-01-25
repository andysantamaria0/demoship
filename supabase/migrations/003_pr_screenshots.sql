-- PR Screenshots migration
-- Stores UI screenshots extracted from PR comments (Vercel, Chromatic, Percy bots)

CREATE TABLE pr_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  source TEXT NOT NULL, -- 'vercel', 'chromatic', 'percy', 'generic'
  comment_id BIGINT NOT NULL,
  comment_author TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_pr_screenshots_video_id ON pr_screenshots(video_id);

-- Enable Row Level Security
ALTER TABLE pr_screenshots ENABLE ROW LEVEL SECURITY;

-- pr_screenshots policies (inherit from videos table)
CREATE POLICY "Users can view own screenshots"
  ON pr_screenshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = pr_screenshots.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create screenshots for own videos"
  ON pr_screenshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = pr_screenshots.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own screenshots"
  ON pr_screenshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = pr_screenshots.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view screenshots by share_id"
  ON pr_screenshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = pr_screenshots.video_id
      AND videos.share_id IS NOT NULL
    )
  );

-- Add screenshot_count to videos table
ALTER TABLE videos ADD COLUMN screenshot_count INTEGER DEFAULT 0;
