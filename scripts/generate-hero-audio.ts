import { generateVoice } from "../lib/elevenlabs";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const HERO_SCRIPT = `Introducing DemoShip. Just paste your GitHub pull request URL — that's all it takes to get started. Claude AI instantly analyzes your code changes — reading every diff, understanding what you built, and why it matters. Then we generate a professional script and bring it to life with natural-sounding voice narration. Your video renders automatically — no editing required. In minutes, you have a polished demo video ready to share with your team, stakeholders, or the world. DemoShip. Get started free today.`;

async function main() {
  console.log("Generating hero video voiceover...");
  console.log("Script:", HERO_SCRIPT);
  console.log("");

  try {
    const result = await generateVoice(HERO_SCRIPT, {
      stability: 0.6,
      similarityBoost: 0.8,
    });

    // Ensure directory exists
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // Save audio file
    const audioPath = path.join(audioDir, "hero-audio.mp3");
    fs.writeFileSync(audioPath, Buffer.from(result.audioBuffer));

    console.log(`Audio generated successfully!`);
    console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)} seconds`);
    console.log(`Saved to: ${audioPath}`);
  } catch (error) {
    console.error("Failed to generate audio:", error);
    process.exit(1);
  }
}

main();
