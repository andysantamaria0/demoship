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

export interface PRDataWithNumber extends PRData {
  prNumber: number;
}

export function formatMultiplePRsForAI(
  prDataList: PRDataWithNumber[],
  owner: string,
  repo: string
): string {
  const totalFiles = prDataList.reduce((sum, pr) => sum + pr.filesChanged, 0);
  const totalAdditions = prDataList.reduce((sum, pr) => sum + pr.additions, 0);
  const totalDeletions = prDataList.reduce((sum, pr) => sum + pr.deletions, 0);

  let content = `# Combined Pull Requests for ${owner}/${repo}\n\n`;
  content += `**Total PRs:** ${prDataList.length}\n`;
  content += `**Total Files Changed:** ${totalFiles}\n`;
  content += `**Total Additions:** +${totalAdditions}\n`;
  content += `**Total Deletions:** -${totalDeletions}\n\n`;
  content += `---\n\n`;

  // Calculate max files per PR to stay within token budget
  // More PRs = fewer files per PR to analyze
  const maxFilesPerPR = Math.max(3, Math.floor(15 / prDataList.length));

  for (let i = 0; i < prDataList.length; i++) {
    const prData = prDataList[i];
    content += `## PR #${prData.prNumber}: ${prData.title}\n\n`;
    content += `**Author:** ${prData.author}\n`;
    content += `**Files Changed:** ${prData.filesChanged}\n`;
    content += `**Additions:** +${prData.additions}\n`;
    content += `**Deletions:** -${prData.deletions}\n\n`;

    if (prData.description) {
      content += `### Description\n${prData.description}\n\n`;
    }

    content += `### Commits\n`;
    // Limit commits per PR for multi-PR analysis
    const maxCommits = Math.min(5, prData.commits.length);
    for (let j = 0; j < maxCommits; j++) {
      const commit = prData.commits[j];
      content += `- ${commit.sha}: ${commit.message}\n`;
    }
    if (prData.commits.length > maxCommits) {
      content += `- ... and ${prData.commits.length - maxCommits} more commits\n`;
    }
    content += "\n";

    content += `### Key Files Changed\n`;
    // Limit files per PR based on total PR count
    const filesToShow = prData.files.slice(0, maxFilesPerPR);
    for (const file of filesToShow) {
      content += `\n#### ${file.filename} (${file.status})\n`;
      content += `+${file.additions} -${file.deletions}\n`;
      if (file.patch) {
        // Shorter patches for multi-PR analysis
        const truncatedPatch = truncatePatchForMultiPR(file.patch, 200);
        content += "```diff\n" + truncatedPatch + "\n```\n";
      }
    }
    if (prData.files.length > maxFilesPerPR) {
      content += `\n*... and ${prData.files.length - maxFilesPerPR} more files*\n`;
    }

    if (i < prDataList.length - 1) {
      content += `\n---\n\n`;
    }
  }

  return content;
}

function truncatePatchForMultiPR(patch: string, maxLines: number): string {
  const lines = patch.split("\n");
  if (lines.length <= maxLines) return patch;

  return (
    lines.slice(0, maxLines).join("\n") +
    `\n... (${lines.length - maxLines} more lines truncated)`
  );
}
