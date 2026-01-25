-- Screen Recordings migration
-- Stores user-uploaded screen recordings to embed in demo videos

CREATE TABLE screen_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_screen_recordings_video_id ON screen_recordings(video_id);
CREATE INDEX idx_screen_recordings_user_id ON screen_recordings(user_id);

-- Enable Row Level Security
ALTER TABLE screen_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies

-- Users can view their own screen recordings
CREATE POLICY "Users can view own screen recordings"
  ON screen_recordings FOR SELECT
  USING (user_id = auth.uid());

-- Users can view screen recordings for videos with share_id (public videos)
CREATE POLICY "Anyone can view screen recordings for shared videos"
  ON screen_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = screen_recordings.video_id
      AND videos.share_id IS NOT NULL
    )
  );

-- Users can insert screen recordings for their own videos
CREATE POLICY "Users can create screen recordings for own videos"
  ON screen_recordings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = screen_recordings.video_id
      AND videos.user_id = auth.uid()
    )
  );

-- Users can update their own screen recordings
CREATE POLICY "Users can update own screen recordings"
  ON screen_recordings FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own screen recordings
CREATE POLICY "Users can delete own screen recordings"
  ON screen_recordings FOR DELETE
  USING (user_id = auth.uid());

-- Add screen_recording_url to videos table for the rendered recording URL
ALTER TABLE videos ADD COLUMN screen_recording_url TEXT;
