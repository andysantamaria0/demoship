"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface RetryButtonProps {
  videoId: string;
}

export function RetryButton({ videoId }: RetryButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/videos/${videoId}/retry`, {
        method: "POST",
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to retry");
      }
    } catch (error) {
      alert("Failed to retry video generation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleRetry} disabled={isLoading} variant="outline">
      {isLoading ? "Retrying..." : "Retry Generation"}
    </Button>
  );
}
