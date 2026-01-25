"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiKey } from "@/lib/types";

interface ApiKeyWithFullKey extends ApiKey {
  key?: string; // Only present when first created
}

export function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyWithFullKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch existing API keys
  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch {
      setError("Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      setNewlyCreatedKey(data);
      setNewKeyName("");
      fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke API key");
      }

      fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted/50 rounded"></div>
        <div className="h-20 bg-muted/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create new key */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h3 className="font-medium mb-3">Create New API Key</h3>
        <form onSubmit={handleCreateKey} className="flex gap-3">
          <Input
            placeholder="Key name (e.g., GitHub Actions)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1"
            disabled={isCreating}
          />
          <Button type="submit" disabled={isCreating || !newKeyName.trim()}>
            {isCreating ? "Creating..." : "Create Key"}
          </Button>
        </form>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Newly created key */}
      {newlyCreatedKey?.key && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium text-green-500">API Key Created</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewlyCreatedKey(null)}
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <code className="flex-1 p-3 bg-background border rounded text-sm font-mono break-all">
              {newlyCreatedKey.key}
            </code>
            <Button
              variant="outline"
              onClick={() => handleCopyKey(newlyCreatedKey.key!)}
            >
              {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Existing keys */}
      <div>
        <h3 className="font-medium mb-3">Your API Keys</h3>
        {apiKeys.filter(k => !k.revoked_at).length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <KeyIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No API keys yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one to use with the DemoShip GitHub Action
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys
              .filter((k) => !k.revoked_at)
              .map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{apiKey.name}</div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <code className="px-2 py-0.5 bg-background rounded">
                        {apiKey.key_prefix}...
                      </code>
                      <span>Created {formatDate(apiKey.created_at)}</span>
                      {apiKey.last_used_at && (
                        <span>Last used {formatDate(apiKey.last_used_at)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeKey(apiKey.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Usage instructions */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h3 className="font-medium mb-3">Usage</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Add this workflow to your repository to automatically generate demo videos when PRs are merged:
        </p>
        <pre className="p-3 bg-background border rounded text-sm overflow-x-auto">
          <code>{`# .github/workflows/demo-video.yml
name: Generate Demo Video
on:
  pull_request:
    types: [closed]

jobs:
  demo:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: demoship/generate-video@v1
        with:
          api-key: \${{ secrets.DEMOSHIP_API_KEY }}`}</code>
        </pre>
        <p className="text-sm text-muted-foreground mt-3">
          Add your API key as a repository secret named <code className="px-1 py-0.5 bg-background rounded">DEMOSHIP_API_KEY</code>
        </p>
      </div>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}
