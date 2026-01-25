import type { PRComment } from "./github";
import type { PRScreenshot, ScreenshotSource } from "./types";

// Maximum number of screenshots to include in a video
const MAX_SCREENSHOTS = 6;

// Bot usernames that typically post preview screenshots
const SCREENSHOT_BOTS: Record<string, ScreenshotSource> = {
  "vercel": "vercel",
  "vercel[bot]": "vercel",
  "chromatic-com": "chromatic",
  "chromatic-com[bot]": "chromatic",
  "chromatic": "chromatic",
  "percy-bot": "percy",
  "percy[bot]": "percy",
  "percy": "percy",
};

// URL patterns that indicate screenshot sources
const SOURCE_URL_PATTERNS: Array<{ pattern: RegExp; source: ScreenshotSource }> = [
  { pattern: /vercel\.com|vercel\.app|\.vercel\.sh/i, source: "vercel" },
  { pattern: /chromatic\.com|chromaticqa\.com/i, source: "chromatic" },
  { pattern: /percy\.io/i, source: "percy" },
];

// Patterns to filter out non-screenshot images
const EXCLUDE_PATTERNS = [
  // GitHub avatars
  /avatars\.githubusercontent\.com/i,
  /github\.com\/.*\.avatar/i,
  // Common badges and shields
  /shields\.io/i,
  /badge\.fury\.io/i,
  /badgen\.net/i,
  /img\.shields\.io/i,
  /codecov\.io\/.*\/badge/i,
  /coveralls\.io\/repos\/.*\/badge/i,
  /travis-ci\.(org|com)\/.*\.svg/i,
  /circleci\.com\/.*\.svg/i,
  /github\.com\/.*\/workflows\/.*\/badge/i,
  /github\.com\/.*\/actions\/workflows\/.*\.svg/i,
  // Icons and small images
  /\.ico$/i,
  /favicon/i,
  /icon[-_]?\d*\.(png|svg|jpg|gif)/i,
  // Emojis and symbols
  /emoji/i,
  /twemoji/i,
  // Bot indicators/status icons
  /status-icon/i,
  /status\.svg/i,
  /indicator/i,
];

// Minimum dimensions to be considered a screenshot (if detectable from URL)
const MIN_DIMENSION_HINTS = ["64x", "32x", "16x", "24x", "48x"];

/**
 * Parse screenshots from PR comments
 */
export function parseScreenshotsFromComments(
  comments: PRComment[]
): Omit<PRScreenshot, "id" | "video_id" | "created_at">[] {
  const screenshots: Omit<PRScreenshot, "id" | "video_id" | "created_at">[] = [];

  for (const comment of comments) {
    const images = extractImagesFromMarkdown(comment.body);

    for (const image of images) {
      if (!isValidScreenshotUrl(image.url)) {
        continue;
      }

      const source = identifyScreenshotSource(comment.user.login, image.url);

      screenshots.push({
        url: image.url,
        alt_text: image.alt || null,
        source,
        comment_id: comment.id,
        comment_author: comment.user.login,
        display_order: screenshots.length,
      });

      // Limit total screenshots
      if (screenshots.length >= MAX_SCREENSHOTS) {
        return screenshots;
      }
    }
  }

  return screenshots;
}

/**
 * Extract image URLs from markdown content
 */
function extractImagesFromMarkdown(content: string): Array<{ url: string; alt: string | null }> {
  const images: Array<{ url: string; alt: string | null }> = [];

  // Match markdown image syntax: ![alt](url)
  const markdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = markdownPattern.exec(content)) !== null) {
    const alt = match[1] || null;
    const url = match[2].trim();
    images.push({ url, alt });
  }

  // Match HTML img tags: <img src="url" alt="alt">
  const htmlPattern = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;

  while ((match = htmlPattern.exec(content)) !== null) {
    const url = match[1].trim();
    const alt = match[2] || null;
    // Avoid duplicates from markdown already parsed
    if (!images.some(img => img.url === url)) {
      images.push({ url, alt });
    }
  }

  // Also check for img tags with alt before src
  const htmlAltFirstPattern = /<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi;

  while ((match = htmlAltFirstPattern.exec(content)) !== null) {
    const alt = match[1] || null;
    const url = match[2].trim();
    if (!images.some(img => img.url === url)) {
      images.push({ url, alt });
    }
  }

  return images;
}

/**
 * Identify the source of a screenshot based on author and URL
 */
export function identifyScreenshotSource(
  author: string,
  url: string
): ScreenshotSource {
  // Check if author is a known bot
  const authorLower = author.toLowerCase();
  if (SCREENSHOT_BOTS[authorLower]) {
    return SCREENSHOT_BOTS[authorLower];
  }

  // Check URL patterns
  for (const { pattern, source } of SOURCE_URL_PATTERNS) {
    if (pattern.test(url)) {
      return source;
    }
  }

  return "generic";
}

/**
 * Check if a URL is likely a valid screenshot (not an avatar, badge, or icon)
 */
export function isValidScreenshotUrl(url: string): boolean {
  // Must be a valid URL
  try {
    new URL(url);
  } catch {
    return false;
  }

  // Check exclude patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(url)) {
      return false;
    }
  }

  // Check for small dimension hints in URL
  for (const hint of MIN_DIMENSION_HINTS) {
    if (url.includes(hint)) {
      return false;
    }
  }

  // Must have an image extension or be from known image hosts
  const imageExtensions = /\.(png|jpg|jpeg|gif|webp|avif)(\?.*)?$/i;
  const knownImageHosts = [
    "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com",
    "imgur.com",
    "i.imgur.com",
    "cloudinary.com",
    "res.cloudinary.com",
    "imagekit.io",
    "ik.imagekit.io",
  ];

  const parsedUrl = new URL(url);
  const isKnownHost = knownImageHosts.some(host =>
    parsedUrl.hostname.includes(host)
  );

  return imageExtensions.test(url) || isKnownHost;
}
