import type { Metadata } from "next";
import { Karla, Playfair_Display, Geist_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DemoShip - Turn PRs into Demo Videos",
  description:
    "Generate AI-powered demo videos from your GitHub pull requests in under 2 minutes.",
  keywords: ["GitHub", "pull request", "demo video", "AI", "code review"],
  openGraph: {
    title: "DemoShip - Turn PRs into Demo Videos",
    description:
      "Generate AI-powered demo videos from your GitHub pull requests in under 2 minutes.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className="dark">
      <body
        className={`${karla.variable} ${playfair.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Header user={user} />
        <main>{children}</main>
      </body>
    </html>
  );
}
