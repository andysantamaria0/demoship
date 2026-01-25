"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/feedback-modal";
import type { User } from "@supabase/supabase-js";

interface FeedbackButtonProps {
  user: User | null;
}

export function FeedbackButton({ user }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const githubUsername = user.user_metadata?.user_name || user.email;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg"
        size="icon-lg"
        aria-label="Share feedback"
      >
        <MessageIcon className="w-5 h-5" />
      </Button>

      <FeedbackModal
        open={isOpen}
        onOpenChange={setIsOpen}
        githubUsername={githubUsername}
      />
    </>
  );
}

function MessageIcon({ className }: { className?: string }) {
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
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
