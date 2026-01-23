-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT,
  avatar_url TEXT,
  videos_generated_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video generation jobs
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Input
  pr_url TEXT NOT NULL,
  pr_owner TEXT NOT NULL,
  pr_repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,

  -- PR metadata (cached)
  pr_title TEXT,
  pr_description TEXT,
  pr_author TEXT,
  pr_author_avatar TEXT,
  pr_files_changed INTEGER,
  pr_additions INTEGER,
  pr_deletions INTEGER,

  -- AI analysis
  ai_summary TEXT,
  ai_script TEXT,
  change_type TEXT, -- 'feature', 'bugfix', 'refactor', 'docs', 'other'

  -- Generated assets
  audio_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'analyzing', 'generating_audio', 'rendering', 'complete', 'failed'
  error_message TEXT,
  duration_seconds INTEGER,

  -- Sharing
  share_id TEXT UNIQUE, -- short ID for sharing (e.g., "abc123")
  view_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for share links
CREATE INDEX idx_videos_share_id ON videos(share_id);

-- Index for user's videos
CREATE INDEX idx_videos_user_id ON videos(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Videos policies
CREATE POLICY "Users can view own videos"
  ON videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own videos"
  ON videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view videos by share_id"
  ON videos FOR SELECT
  USING (share_id IS NOT NULL);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, github_username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for audio and video files
-- Note: Run this in Supabase dashboard or via API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
