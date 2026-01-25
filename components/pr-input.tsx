"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ParsedPRInfo } from "@/lib/types";

interface PRInputProps {
  onSuccess?: (videoId: string) => void;
}

const MAX_PRS = 10;

function parsePRUrl(url: string): ParsedPRInfo | null {
  const match = url.match(
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
    url,
  };
}

export function PRInput({ onSuccess }: PRInputProps) {
  const [urls, setUrls] = useState<string[]>([""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Parse the first valid URL to detect repo
  const detectedRepo = useCallback((): { owner: string; repo: string } | null => {
    for (const url of urls) {
      const parsed = parsePRUrl(url);
      if (parsed) {
        return { owner: parsed.owner, repo: parsed.repo };
      }
    }
    return null;
  }, [urls]);

  const repo = detectedRepo();

  // Validate a URL against the detected repo
  const validateUrl = useCallback(
    (url: string): { valid: boolean; error?: string; parsed?: ParsedPRInfo } => {
      if (!url.trim()) {
        return { valid: false };
      }

      const parsed = parsePRUrl(url);
      if (!parsed) {
        return { valid: false, error: "Invalid GitHub PR URL" };
      }

      // Check if matches detected repo
      if (repo && (parsed.owner !== repo.owner || parsed.repo !== repo.repo)) {
        return {
          valid: false,
          error: `PR must be from ${repo.owner}/${repo.repo}`,
          parsed,
        };
      }

      // Check for duplicates
      const allParsed = urls
        .filter((u) => u !== url)
        .map((u) => parsePRUrl(u))
        .filter((p): p is ParsedPRInfo => p !== null);

      if (allParsed.some((p) => p.number === parsed.number)) {
        return { valid: false, error: "Duplicate PR", parsed };
      }

      return { valid: true, parsed };
    },
    [urls, repo]
  );

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
    setError(null);
  };

  const addUrl = () => {
    if (urls.length < MAX_PRS) {
      setUrls([...urls, ""]);
    }
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Filter out empty URLs and validate
      const validUrls = urls.filter((url) => url.trim());

      if (validUrls.length === 0) {
        throw new Error("At least one PR URL is required");
      }

      // Validate all URLs
      for (const url of validUrls) {
        const validation = validateUrl(url);
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid PR URL");
        }
      }

      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrls: validUrls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create video");
      }

      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/video/${data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if form is valid for submission
  const validUrls = urls.filter((url) => {
    const validation = validateUrl(url);
    return validation.valid;
  });
  const canSubmit = validUrls.length > 0 && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      {/* Repository badge */}
      {repo && (
        <div className="mb-4">
          <Badge variant="secondary" className="text-sm">
            <GitHubIcon className="w-3 h-3 mr-1.5" />
            {repo.owner}/{repo.repo}
          </Badge>
        </div>
      )}

      {/* PR URL inputs */}
      <div className="space-y-3">
        {urls.map((url, index) => {
          const validation = url.trim() ? validateUrl(url) : { valid: false };
          const hasError = url.trim() && !validation.valid && validation.error;
          const isValid = validation.valid;

          return (
            <div key={index} className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type="url"
                  placeholder={
                    index === 0
                      ? "https://github.com/owner/repo/pull/123"
                      : "Add another PR from the same repo"
                  }
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  className={`h-12 text-base pr-10 ${
                    hasError
                      ? "border-destructive focus-visible:ring-destructive"
                      : isValid
                      ? "border-green-500 focus-visible:ring-green-500"
                      : ""
                  }`}
                  disabled={isLoading}
                />
                {isValid && (
                  <CheckIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              {urls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => removeUrl(index)}
                  disabled={isLoading}
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add another PR button */}
      {urls.length < MAX_PRS && repo && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 text-muted-foreground"
          onClick={addUrl}
          disabled={isLoading}
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add another PR ({urls.length}/{MAX_PRS})
        </Button>
      )}

      {/* Error message */}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Submit button */}
      <div className="mt-4">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-12 px-8 text-base font-medium w-full sm:w-auto"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              Processing...
            </span>
          ) : validUrls.length > 1 ? (
            `Generate Video (${validUrls.length} PRs)`
          ) : (
            "Generate Video"
          )}
        </Button>
      </div>

      {/* Help text */}
      <p className="mt-3 text-sm text-muted-foreground">
        {validUrls.length > 1
          ? "Multiple PRs will be combined into a unified narrative"
          : "Paste a GitHub pull request URL to generate a shareable demo video"}
      </p>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
