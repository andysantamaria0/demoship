"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Video, VideoStatus } from "@/lib/types";
import { getStatusConfig } from "@/lib/design";

interface GenerationStatusProps {
  video: Video;
  onRetry?: () => void;
  onComplete?: (video: Video) => void;
}

const POLL_INTERVAL = 2000; // 2 seconds

const STATUS_STEPS: VideoStatus[] = [
  "pending",
  "analyzing",
  "generating_audio",
  "rendering",
  "complete",
];

export function GenerationStatus({
  video: initialVideo,
  onRetry,
  onComplete,
}: GenerationStatusProps) {
  const [video, setVideo] = useState(initialVideo);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setVideo(initialVideo);
  }, [initialVideo]);

  // Poll for updates while processing
  useEffect(() => {
    if (
      video.status === "complete" ||
      video.status === "failed"
    ) {
      if (video.status === "complete" && onComplete) {
        onComplete(video);
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/videos/${video.id}`);
        if (response.ok) {
          const updatedVideo = await response.json();
          setVideo(updatedVideo);
        }
      } catch (error) {
        console.error("Failed to poll status:", error);
      }
    };

    const interval = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [video.id, video.status, onComplete]);

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await fetch(`/api/videos/${video.id}/retry`, { method: "POST" });
      onRetry();
    } catch (error) {
      console.error("Failed to retry:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  const currentStepIndex = STATUS_STEPS.indexOf(video.status);
  const statusConfig = getStatusConfig(video.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generation Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {video.status === "failed" ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {video.error_message || "Video generation failed"}
              </AlertDescription>
            </Alert>
            {onRetry && (
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? "Retrying..." : "Retry Generation"}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress steps */}
            <div className="flex items-center gap-2">
              {STATUS_STEPS.slice(0, -1).map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = step === video.status;
                const stepConfig = getStatusConfig(step);

                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-none text-sm font-medium transition-colors ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground animate-pulse-subtle"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {index < STATUS_STEPS.length - 2 && (
                      <div
                        className={`w-8 h-0.5 ${
                          isCompleted ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current status */}
            <div className="flex items-center gap-3">
              <div className={`status-dot ${video.status}`} />
              <span className="font-medium">{statusConfig.label}</span>
            </div>

            {/* Status description */}
            <p className="text-sm text-muted-foreground">
              {getStatusDescription(video.status)}
            </p>

            {/* Show AI summary once available */}
            {video.ai_summary && video.status !== "complete" && (
              <div className="mt-4 p-3 bg-muted rounded-none">
                <p className="text-sm font-medium mb-1">Summary Preview</p>
                <p className="text-sm text-muted-foreground">
                  {video.ai_summary}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusDescription(status: VideoStatus): string {
  switch (status) {
    case "pending":
      return "Your video is queued for processing...";
    case "analyzing":
      return "Analyzing pull request changes with AI...";
    case "generating_audio":
      return "Generating voice narration...";
    case "rendering":
      return "Rendering video with Remotion...";
    case "complete":
      return "Your video is ready!";
    case "failed":
      return "Something went wrong during generation.";
    default:
      return "Processing...";
  }
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
