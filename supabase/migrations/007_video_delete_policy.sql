-- Add DELETE policy to videos table
-- Allows users to delete their own videos

CREATE POLICY "Users can delete own videos"
  ON videos
  FOR DELETE
  USING (auth.uid() = user_id);
