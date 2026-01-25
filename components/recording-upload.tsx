"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecordingUploadProps {
  videoId: string;
  existingRecording?: {
    url: string;
    duration_ms: number;
    file_size_bytes: number;
  } | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION_MS = 60 * 1000; // 60 seconds
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export function RecordingUpload({
  videoId,
  existingRecording,
}: RecordingUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingRecording?.url || null
  );
  const [duration, setDuration] = useState<number | null>(
    existingRecording?.duration_ms || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError("Invalid file type. Please upload MP4, WebM, or MOV.");
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 50MB.");
      return;
    }

    setFile(selectedFile);

    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    // Get duration from video
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationMs = Math.round(video.duration * 1000);
      if (durationMs > MAX_DURATION_MS) {
        setError("Recording too long. Maximum duration is 60 seconds.");
        setFile(null);
        setPreviewUrl(null);
        URL.revokeObjectURL(url);
        return;
      }
      setDuration(durationMs);
    };
    video.src = url;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!file || !duration) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("duration_ms", duration.toString());

      const response = await fetch(`/api/videos/${videoId}/recording`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      setPreviewUrl(data.url);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/videos/${videoId}/recording`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Delete failed");
      }

      setPreviewUrl(null);
      setDuration(null);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClear = () => {
    if (previewUrl && file) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(existingRecording?.url || null);
    setDuration(existingRecording?.duration_ms || null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasExistingRecording = existingRecording && !file;
  const hasNewFile = file && previewUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <VideoIcon className="w-5 h-5" />
          Screen Recording
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        {previewUrl && (
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              className="w-full max-h-64"
            />
            {duration && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {formatDuration(duration)}
              </div>
            )}
          </div>
        )}

        {/* Upload zone (when no preview) */}
        {!previewUrl && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleInputChange}
              className="hidden"
            />
            <UploadIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">
              Drag and drop a screen recording
            </p>
            <p className="text-xs text-muted-foreground">
              MP4, WebM, or MOV (max 50MB, 60 seconds)
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        {/* File info */}
        {file && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{file.name}</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {hasNewFile && (
            <>
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? "Uploading..." : "Upload Recording"}
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </>
          )}

          {hasExistingRecording && (
            <>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                Replace Recording
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleInputChange}
                className="hidden"
              />
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={isDeleting}
              >
                {isDeleting ? "Removing..." : "Remove"}
              </Button>
            </>
          )}

          {!previewUrl && !file && (
            <p className="text-xs text-muted-foreground">
              Add a screen recording to show your feature in action. It will
              appear after the code diff in your demo video.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}
