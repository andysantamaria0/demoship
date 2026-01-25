"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyShareLinkProps {
  url: string;
}

export function CopyShareLink({ url }: CopyShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        readOnly
        value={url}
        className="w-full px-3 py-2 text-sm bg-muted rounded-none"
      />
      <Button variant="outline" size="sm" className="w-full" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy Link"}
      </Button>
    </div>
  );
}
