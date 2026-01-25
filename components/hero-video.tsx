"use client";

import { useState, useRef } from "react";

interface HeroVideoProps {
  videoSrc?: string;
  posterSrc?: string;
}

export function HeroVideo({
  videoSrc = "/videos/hero-demo.mp4",
  posterSrc = "/images/hero-poster.jpg",
}: HeroVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setHasError(true);
  };

  // Show placeholder if video not available
  if (hasError) {
    return (
      <div className="w-full max-w-4xl mx-auto aspect-video bg-muted/30 border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <PlayIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Demo video coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative aspect-video bg-card border overflow-hidden">
        {/* Video element */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          onEnded={handleEnded}
          onError={handleError}
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Play button overlay - shown when not playing */}
        {!isPlaying && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
            aria-label="Play demo video"
          >
            <div className="w-20 h-20 bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlayIcon className="w-8 h-8 text-primary-foreground ml-1" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
