"use client";

import { useState, useSyncExternalStore } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/feedback-modal";

interface FeedbackPromptProps {
  videoId: string;
  prUrl: string;
  githubUsername?: string;
  createdAt: string;
  completedAt: string | null;
}

function getStorageKey(videoId: string) {
  return `feedback-dismissed-${videoId}`;
}

function useLocalStorageDismissed(videoId: string) {
  const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  };

  const getSnapshot = () => {
    return localStorage.getItem(getStorageKey(videoId)) === "true";
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function FeedbackPrompt({
  videoId,
  prUrl,
  githubUsername,
  createdAt,
  completedAt,
}: FeedbackPromptProps) {
  const storageDismissed = useLocalStorageDismissed(videoId);
  const [localDismissed, setLocalDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isDismissed = storageDismissed || localDismissed;

  const handleDismiss = () => {
    localStorage.setItem(getStorageKey(videoId), "true");
    setLocalDismissed(true);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      // Dismiss after successful submission
      handleDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  // Calculate time to complete in milliseconds
  const timeToComplete = completedAt
    ? new Date(completedAt).getTime() - new Date(createdAt).getTime()
    : undefined;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎉</span>
                <h3 className="font-semibold">Your video is ready!</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                We&apos;d love to hear about your experience creating this demo video.
                Your feedback helps us improve DemoShip.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleOpenModal}>
                  Share Feedback
                </Button>
                <Button variant="ghost" onClick={handleDismiss}>
                  Maybe Later
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      <FeedbackModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        githubUsername={githubUsername}
        prUrl={prUrl}
        videoId={videoId}
        timeToComplete={timeToComplete}
      />
    </>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
