-- Audio duration migration
-- Stores the duration of generated voice narration to ensure video length matches audio

ALTER TABLE videos ADD COLUMN audio_duration_ms INTEGER;
