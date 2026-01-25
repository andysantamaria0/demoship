import type { ScreenshotSource } from "./types";

export interface CaptureConfig {
  url: string;
  routes?: string[];
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CapturedScreenshot {
  buffer: Buffer;
  route: string;
  source: ScreenshotSource;
}

// Default configuration
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Capture screenshots from a preview deployment URL
 * This function calls the Railway server's /capture endpoint
 * since Puppeteer can't run on Vercel
 */
export async function capturePreviewScreenshots(
  config: CaptureConfig,
  remotionServerUrl: string,
  webhookSecret: string
): Promise<CapturedScreenshot[]> {
  const {
    url,
    routes = ["/"],
    timeout = DEFAULT_TIMEOUT,
    viewport = DEFAULT_VIEWPORT,
  } = config;

  // Determine source from URL
  const source = identifySourceFromUrl(url);

  try {
    const response = await fetch(`${remotionServerUrl}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        url,
        routes,
        timeout,
        viewport,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Capture failed: ${errorText}`);
    }

    const data = await response.json();

    // Convert base64 images back to buffers
    return data.screenshots.map((screenshot: { image: string; route: string }) => ({
      buffer: Buffer.from(screenshot.image, "base64"),
      route: screenshot.route,
      source,
    }));
  } catch (error) {
    console.error("Failed to capture preview screenshots:", error);
    return [];
  }
}

/**
 * Identify screenshot source from URL
 */
function identifySourceFromUrl(url: string): ScreenshotSource {
  const urlLower = url.toLowerCase();

  if (urlLower.includes(".vercel.app") || urlLower.includes(".vercel.sh")) {
    return "vercel";
  }
  if (urlLower.includes(".netlify.app")) {
    return "netlify";
  }
  if (urlLower.includes(".pages.dev")) {
    return "cloudflare";
  }
  if (urlLower.includes(".railway.app")) {
    return "railway";
  }
  if (urlLower.includes(".onrender.com")) {
    return "render";
  }
  if (urlLower.includes(".fly.dev")) {
    return "fly";
  }

  return "auto-capture";
}

// Note: The actual Puppeteer-based capture is implemented in the Railway server
// (remotion/src/server.ts) since Puppeteer cannot run on Vercel serverless functions
