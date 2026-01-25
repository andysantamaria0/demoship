import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRInput } from "@/components/pr-input";
import { createClient } from "@/lib/supabase/server";
import { design } from "@/lib/design";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="hero-gradient py-20 md:py-32">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Turn Pull Requests into
            <span className="gradient-text"> Stunning Demo Videos</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
            {design.brand.description}
          </p>

          {user ? (
            <PRInput />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Link href="/login">
                <Button size="lg" className="h-12 px-8 text-base">
                  Get Started with GitHub
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Free to use. No credit card required.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How it Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number={1}
              title="Paste PR URLs"
              description="Enter one or more GitHub PR URLs from the same repo"
            />
            <StepCard
              number={2}
              title="AI Does the Work"
              description="Claude reads your diffs, commits, and comments to craft a compelling narrative"
            />
            <StepCard
              number={3}
              title="Share Instantly"
              description="Get a polished video with voice narration and a shareable link"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            Everything You Need
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Perfect for sprint demos, release announcements, portfolio showcases, and stakeholder updates.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={<BrainIcon />}
              title="AI-Powered Analysis"
              description="Claude reads your diffs, commits, and PR description to craft a compelling narrative"
            />
            <FeatureCard
              icon={<VoiceIcon />}
              title="Professional Narration"
              description="Natural-sounding voice narration that always plays to completion, never cut off"
            />
            <FeatureCard
              icon={<ImageIcon />}
              title="Auto-Capture Screenshots"
              description="Automatically captures UI from preview deployments, or extracts from Vercel/Chromatic comments"
            />
            <FeatureCard
              icon={<VideoIcon />}
              title="Screen Recordings"
              description="Upload screen recordings to showcase interactive features and user flows"
            />
            <FeatureCard
              icon={<LayersIcon />}
              title="Multi-PR Support"
              description="Combine up to 10 PRs from the same repo into a single unified demo video"
            />
            <FeatureCard
              icon={<ApiIcon />}
              title="CI/CD Integration"
              description="Public API and GitHub Actions support for automated video generation on every PR"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Ship Better Demos?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Join developers who communicate their work more effectively.
            </p>
            <Link href="/login">
              <Button size="lg" variant="secondary" className="h-12 px-8">
                Sign Up with GitHub
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with Next.js, Supabase, Claude, ElevenLabs, and Remotion</p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-none bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-none border bg-card">
      <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function BrainIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
