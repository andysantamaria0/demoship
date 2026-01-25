import type { PRComment } from "./github";
import type { PRScreenshot, ScreenshotSource } from "./types";

// Maximum number of screenshots to include in a video
const MAX_SCREENSHOTS = 6;

// Bot usernames that typically post preview screenshots
const SCREENSHOT_BOTS: Record<string, ScreenshotSource> = {
  // Vercel
  "vercel": "vercel",
  "vercel[bot]": "vercel",
  // Chromatic
  "chromatic-com": "chromatic",
  "chromatic-com[bot]": "chromatic",
  "chromatic": "chromatic",
  // Percy
  "percy-bot": "percy",
  "percy[bot]": "percy",
  "percy": "percy",
  // Netlify
  "netlify": "netlify",
  "netlify[bot]": "netlify",
  // Cloudflare Pages
  "cloudflare-pages": "cloudflare",
  "cloudflare-pages[bot]": "cloudflare",
  "cloudflare": "cloudflare",
  // Railway
  "railway-app": "railway",
  "railway-app[bot]": "railway",
  "railway": "railway",
  // Render
  "render": "render",
  "render[bot]": "render",
  // Fly.io
  "fly": "fly",
  "fly[bot]": "fly",
  "fly-apps": "fly",
};

// URL patterns that indicate screenshot sources
const SOURCE_URL_PATTERNS: Array<{ pattern: RegExp; source: ScreenshotSource }> = [
  { pattern: /vercel\.com|vercel\.app|\.vercel\.sh/i, source: "vercel" },
  { pattern: /chromatic\.com|chromaticqa\.com/i, source: "chromatic" },
  { pattern: /percy\.io/i, source: "percy" },
  { pattern: /netlify\.app|netlify\.com/i, source: "netlify" },
  { pattern: /\.pages\.dev/i, source: "cloudflare" },
  { pattern: /\.railway\.app/i, source: "railway" },
  { pattern: /\.onrender\.com/i, source: "render" },
  { pattern: /\.fly\.dev/i, source: "fly" },
];

// Preview deployment URL patterns for auto-capture
const PREVIEW_URL_PATTERNS: Array<{ pattern: RegExp; source: ScreenshotSource }> = [
  { pattern: /https?:\/\/[a-z0-9-]+\.vercel\.app\b/gi, source: "vercel" },
  { pattern: /https?:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app\b/gi, source: "netlify" },
  { pattern: /https?:\/\/[a-z0-9-]+\.pages\.dev\b/gi, source: "cloudflare" },
  { pattern: /https?:\/\/[a-z0-9-]+\.railway\.app\b/gi, source: "railway" },
  { pattern: /https?:\/\/[a-z0-9-]+\.onrender\.com\b/gi, source: "render" },
  { pattern: /https?:\/\/[a-z0-9-]+\.fly\.dev\b/gi, source: "fly" },
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

/**
 * Extract preview deployment URLs from PR comments
 * Returns URLs from deployment bots that can be used for auto-capture
 */
export function extractPreviewUrlsFromComments(
  comments: PRComment[]
): Array<{ url: string; source: ScreenshotSource }> {
  const urls: Array<{ url: string; source: ScreenshotSource }> = [];
  const seenUrls = new Set<string>();

  for (const comment of comments) {
    const authorLower = comment.user.login.toLowerCase();

    // Check if comment is from a known deployment bot
    const isDeploymentBot = Object.keys(SCREENSHOT_BOTS).some(
      bot => authorLower === bot.toLowerCase()
    );

    if (!isDeploymentBot) {
      continue;
    }

    // Extract preview URLs from the comment body
    for (const { pattern, source } of PREVIEW_URL_PATTERNS) {
      // Reset regex state since we use global flag
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(comment.body)) !== null) {
        const url = match[0];

        // Skip if already seen
        if (seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
        urls.push({ url, source });
      }
    }
  }

  return urls;
}
