import * as musicMetadata from "music-metadata";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Adam voice - professional, clear, neutral
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

export interface VoiceGenerationOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface VoiceGenerationResult {
  audioBuffer: ArrayBuffer;
  durationMs: number;
}

export async function generateVoice(
  text: string,
  options: VoiceGenerationOptions = {}
): Promise<VoiceGenerationResult> {
  const {
    voiceId = DEFAULT_VOICE_ID,
    stability = 0.5,
    similarityBoost = 0.75,
  } = options;

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Calculate duration from MP3 data
  const durationMs = await calculateMp3Duration(arrayBuffer);

  return { audioBuffer: arrayBuffer, durationMs };
}

async function calculateMp3Duration(arrayBuffer: ArrayBuffer): Promise<number> {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await musicMetadata.parseBuffer(buffer, { mimeType: "audio/mpeg" });
    // Return duration in milliseconds
    return Math.round((metadata.format.duration || 0) * 1000);
  } catch (error) {
    console.warn("Failed to parse MP3 duration, using estimate:", error);
    // Fallback: estimate from file size assuming 128kbps bitrate
    const fileSizeBytes = arrayBuffer.byteLength;
    const bitrateKbps = 128;
    const durationSeconds = (fileSizeBytes * 8) / (bitrateKbps * 1000);
    return Math.round(durationSeconds * 1000);
  }
}

export async function getVoices(): Promise<
  { voice_id: string; name: string }[]
> {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}
