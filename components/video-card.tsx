"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Video } from "@/lib/types";
import { getStatusConfig, getChangeTypeConfig } from "@/lib/design";

interface VideoCardProps {
  video: Video;
  onDelete?: () => void;
}

export function VideoCard({ video, onDelete }: VideoCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const statusConfig = getStatusConfig(video.status);
  const changeTypeConfig = video.change_type
    ? getChangeTypeConfig(video.change_type)
    : null;

  const isProcessing = ["pending", "analyzing", "generating_audio", "rendering"].includes(
    video.status
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      setShowConfirm(false);
      onDelete?.();
      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete video. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative group">
      {/* Delete button - appears on hover */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground p-1.5 rounded-none hover:bg-destructive/90"
        aria-label="Delete video"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="absolute inset-0 z-20 bg-background/95 flex flex-col items-center justify-center p-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-medium mb-2">Delete this video?</p>
          <p className="text-xs text-muted-foreground mb-4">
            This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      )}

      <Link href={`/video/${video.id}`}>
        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* Thumbnail or placeholder */}
        <div className="aspect-video bg-muted relative">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.pr_title || "Video thumbnail"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className={`status-dot ${video.status}`} />
                  <span className="text-sm text-muted-foreground">
                    {statusConfig.label}
                  </span>
                </div>
              ) : video.status === "failed" ? (
                <span className="text-sm text-destructive">
                  Generation failed
                </span>
              ) : (
                <VideoIcon className="w-12 h-12 text-muted-foreground/50" />
              )}
            </div>
          )}

          {/* Duration badge */}
          {video.duration_seconds && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-none">
              {formatDuration(video.duration_seconds)}
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium line-clamp-2">
              {video.pr_title || `PR #${video.pr_number}`}
            </h3>
            {changeTypeConfig && (
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: changeTypeConfig.bg,
                  color: changeTypeConfig.text,
                }}
              >
                {changeTypeConfig.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="w-5 h-5">
                <AvatarImage src={video.pr_author_avatar || undefined} />
                <AvatarFallback>
                  {video.pr_author?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span>{video.pr_owner}/{video.pr_repo}</span>
            </div>
            <span>{formatRelativeTime(video.created_at)}</span>
          </div>

          {/* Stats row */}
          {video.pr_files_changed !== null && (
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>{video.pr_files_changed} files</span>
              <span className="text-green-600">+{video.pr_additions}</span>
              <span className="text-red-600">-{video.pr_deletions}</span>
              {video.view_count > 0 && (
                <span>{video.view_count} views</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
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
        strokeWidth={1.5}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
