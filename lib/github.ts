export interface PRData {
  title: string;
  description: string;
  author: string;
  authorAvatar: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  files: PRFile[];
  commits: PRCommit[];
}

export interface PRFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRCommit {
  sha: string;
  message: string;
  author: string;
}

export function parsePRUrl(url: string): {
  owner: string;
  repo: string;
  number: number;
} | null {
  // Match patterns like:
  // https://github.com/owner/repo/pull/123
  // github.com/owner/repo/pull/123
  const match = url.match(
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
  );

  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}

export async function fetchPRData(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRData> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Fetch PR details
  const prResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers }
  );

  if (!prResponse.ok) {
    throw new Error(`Failed to fetch PR: ${prResponse.status}`);
  }

  const pr = await prResponse.json();

  // Fetch PR files
  const filesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    { headers }
  );

  if (!filesResponse.ok) {
    throw new Error(`Failed to fetch PR files: ${filesResponse.status}`);
  }

  const filesData = await filesResponse.json();

  // Fetch commits
  const commitsResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`,
    { headers }
  );

  if (!commitsResponse.ok) {
    throw new Error(`Failed to fetch PR commits: ${commitsResponse.status}`);
  }

  const commitsData = await commitsResponse.json();

  // Process files - truncate large patches
  const files: PRFile[] = filesData.map(
    (file: {
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
    }) => ({
      filename: file.filename,
      status: file.status as PRFile["status"],
      additions: file.additions,
      deletions: file.deletions,
      // Truncate patches to avoid exceeding token limits
      patch: file.patch ? truncatePatch(file.patch, 500) : undefined,
    })
  );

  // Process commits
  const commits: PRCommit[] = commitsData.slice(0, 10).map(
    (commit: {
      sha: string;
      commit: { message: string; author: { name: string } };
    }) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split("\n")[0], // First line only
      author: commit.commit.author.name,
    })
  );

  return {
    title: pr.title,
    description: pr.body || "",
    author: pr.user.login,
    authorAvatar: pr.user.avatar_url,
    filesChanged: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
    files,
    commits,
  };
}

function truncatePatch(patch: string, maxLines: number): string {
  const lines = patch.split("\n");
  if (lines.length <= maxLines) return patch;

  return (
    lines.slice(0, maxLines).join("\n") +
    `\n... (${lines.length - maxLines} more lines truncated)`
  );
}

export function formatPRDataForAI(prData: PRData): string {
  let content = `# Pull Request: ${prData.title}\n\n`;
  content += `**Author:** ${prData.author}\n`;
  content += `**Files Changed:** ${prData.filesChanged}\n`;
  content += `**Additions:** +${prData.additions}\n`;
  content += `**Deletions:** -${prData.deletions}\n\n`;

  if (prData.description) {
    content += `## Description\n${prData.description}\n\n`;
  }

  content += `## Commits\n`;
  for (const commit of prData.commits) {
    content += `- ${commit.sha}: ${commit.message}\n`;
  }
  content += "\n";

  content += `## Files Changed\n`;
  for (const file of prData.files) {
    content += `\n### ${file.filename} (${file.status})\n`;
    content += `+${file.additions} -${file.deletions}\n`;
    if (file.patch) {
      content += "```diff\n" + file.patch + "\n```\n";
    }
  }

  return content;
}
