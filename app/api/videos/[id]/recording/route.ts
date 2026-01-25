import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;
// Max duration: 60 seconds
const MAX_DURATION_MS = 60 * 1000;
// Allowed MIME types
const ALLOWED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the video belongs to the user
  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id, user_id, status")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (videoError || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Only allow uploads for videos that haven't been rendered yet
  if (video.status === "complete" || video.status === "rendering") {
    return NextResponse.json(
      { error: "Cannot upload recording for videos that are already rendering or complete" },
      { status: 400 }
    );
  }

  // Parse form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const durationMs = Number(formData.get("duration_ms"));

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: MP4, WebM, MOV" },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 50MB" },
      { status: 400 }
    );
  }

  // Validate duration
  if (!durationMs || durationMs <= 0) {
    return NextResponse.json(
      { error: "Duration is required" },
      { status: 400 }
    );
  }

  if (durationMs > MAX_DURATION_MS) {
    return NextResponse.json(
      { error: "Recording too long. Maximum duration is 60 seconds" },
      { status: 400 }
    );
  }

  // Check for existing recording
  const { data: existingRecording } = await supabase
    .from("screen_recordings")
    .select("id, storage_path")
    .eq("video_id", videoId)
    .single();

  // If there's an existing recording, delete it from storage
  if (existingRecording) {
    await supabase.storage
      .from("media")
      .remove([existingRecording.storage_path]);

    await supabase
      .from("screen_recordings")
      .delete()
      .eq("id", existingRecording.id);
  }

  // Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer();
  const storagePath = `recordings/${videoId}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload recording" },
      { status: 500 }
    );
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(storagePath);

  // Insert record into screen_recordings table
  const { data: recording, error: insertError } = await supabase
    .from("screen_recordings")
    .insert({
      video_id: videoId,
      user_id: user.id,
      storage_path: storagePath,
      duration_ms: durationMs,
      file_size_bytes: file.size,
      display_order: 0,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    // Clean up uploaded file
    await supabase.storage.from("media").remove([storagePath]);
    return NextResponse.json(
      { error: "Failed to save recording metadata" },
      { status: 500 }
    );
  }

  // Update the video with the recording URL
  await supabase
    .from("videos")
    .update({ screen_recording_url: publicUrl })
    .eq("id", videoId);

  return NextResponse.json({
    id: recording.id,
    url: publicUrl,
    duration_ms: durationMs,
    file_size_bytes: file.size,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the recording
  const { data: recording, error: findError } = await supabase
    .from("screen_recordings")
    .select("id, storage_path, user_id")
    .eq("video_id", videoId)
    .single();

  if (findError || !recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  // Verify ownership
  if (recording.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("media")
    .remove([recording.storage_path]);

  if (storageError) {
    console.error("Storage delete error:", storageError);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from("screen_recordings")
    .delete()
    .eq("id", recording.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }

  // Clear the URL from the video
  await supabase
    .from("videos")
    .update({ screen_recording_url: null })
    .eq("id", videoId);

  return NextResponse.json({ success: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the recording
  const { data: recording, error } = await supabase
    .from("screen_recordings")
    .select("*")
    .eq("video_id", videoId)
    .single();

  if (error || !recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(recording.storage_path);

  return NextResponse.json({
    ...recording,
    url: publicUrl,
  });
}
