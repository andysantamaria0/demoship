"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { design } from "@/lib/design";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon className="w-8 h-8" />
          <span className="font-semibold text-xl" style={{ fontFamily: 'var(--font-playfair)' }}>{design.brand.name}</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link href="/dashboard/settings">
                <Button variant="ghost">Settings</Button>
              </Link>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.user_metadata.avatar_url} />
                  <AvatarFallback>
                    {user.user_metadata.user_name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Link href="/login">
              <Button>Sign In with GitHub</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ship hull - Royal Blue */}
      <rect
        x="4"
        y="18"
        width="24"
        height="8"
        rx="2"
        fill="#4A35D7"
      />
      {/* Ship sail/structure - Royal Blue */}
      <path
        d="M8 18V12L16 6L24 12V18"
        stroke="#4A35D7"
        strokeWidth="2"
        fill="none"
      />
      {/* Center accent - Hide (tan) */}
      <circle cx="16" cy="13" r="2.5" fill="#DFB288" />
      {/* Play button detail - Coral accent */}
      <path
        d="M13 22L19 22"
        stroke="#FF7D73"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
