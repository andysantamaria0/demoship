const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Adam voice - professional, clear, neutral
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

export interface VoiceGenerationOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}

export async function generateVoice(
  text: string,
  options: VoiceGenerationOptions = {}
): Promise<ArrayBuffer> {
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

  return response.arrayBuffer();
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
