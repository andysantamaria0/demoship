/**
 * Design Configuration
 *
 * This file contains all customizable design tokens for the DemoShip application.
 * Modify these values to change the look and feel of the entire app.
 *
 * For color changes, also update app/globals.css CSS variables for full effect.
 */

export const design = {
  // Brand
  brand: {
    name: "DemoShip",
    tagline: "Turn Pull Requests into stunning demo videos",
    description:
      "Paste a PR URL and AI analyzes your code, captures UI screenshots, generates a script, and produces a polished video with professional narration — all in minutes.",
  },

  // Colors (semantic names - actual values in globals.css)
  colors: {
    // Primary brand color
    primary: "hsl(var(--primary))",
    primaryForeground: "hsl(var(--primary-foreground))",

    // Secondary accent
    secondary: "hsl(var(--secondary))",
    secondaryForeground: "hsl(var(--secondary-foreground))",

    // Status colors
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",

    // Change type badges - Vialoure palette
    changeTypes: {
      feature: { bg: "#E8E4F9", text: "#4A35D7", label: "Feature" },      // Royal Blue tones
      bugfix: { bg: "#FFE8E6", text: "#E85A50", label: "Bug Fix" },       // Coral tones
      refactor: { bg: "#F5EBE0", text: "#9A7B5B", label: "Refactor" },    // Hide tones
      docs: { bg: "#F4F4ED", text: "#2F2F2F", label: "Documentation" },   // Ivory/Charcoal
      other: { bg: "#F4F4ED", text: "#5A5A5A", label: "Other" },
    },

    // Status indicators
    statuses: {
      pending: { bg: "#f3f4f6", text: "#6b7280", label: "Pending" },
      analyzing: { bg: "#dbeafe", text: "#2563eb", label: "Analyzing PR" },
      generating_audio: {
        bg: "#fef3c7",
        text: "#d97706",
        label: "Generating Voice",
      },
      rendering: { bg: "#f3e8ff", text: "#7c3aed", label: "Rendering Video" },
      complete: { bg: "#d1fae5", text: "#059669", label: "Complete" },
      failed: { bg: "#fee2e2", text: "#dc2626", label: "Failed" },
    },
  },

  // Typography - Vialoure style
  fonts: {
    // Font families (loaded in layout.tsx)
    heading: "var(--font-playfair)",  // Playfair Display for headlines
    body: "var(--font-karla)",        // Karla for body text
    mono: "var(--font-geist-mono)",
  },

  // Spacing scale (in pixels, used with Tailwind classes)
  spacing: {
    page: {
      maxWidth: "1200px",
      paddingX: "1rem", // px-4
      paddingY: "2rem", // py-8
    },
  },

  // Border radius - Vialoure sharp corners
  radius: {
    sm: "0",
    md: "0",
    lg: "0",
    full: "0",
  },

  // Shadows
  shadows: {
    card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    hover: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },

  // Animation durations
  animation: {
    fast: "150ms",
    normal: "300ms",
    slow: "500ms",
  },

  // Video player
  video: {
    aspectRatio: "16 / 9",
    borderRadius: "0",
  },
} as const;

// Helper function to get status config
export function getStatusConfig(status: string) {
  return (
    design.colors.statuses[status as keyof typeof design.colors.statuses] ||
    design.colors.statuses.pending
  );
}

// Helper function to get change type config
export function getChangeTypeConfig(type: string) {
  return (
    design.colors.changeTypes[type as keyof typeof design.colors.changeTypes] ||
    design.colors.changeTypes.other
  );
}
