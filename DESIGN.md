# DemoShip Design System

This document outlines how to customize the visual design of DemoShip. All design elements are organized for easy modification.

## Quick Start

To change the app's look and feel, modify these files:

| File | Purpose |
|------|---------|
| `app/globals.css` | CSS variables, colors, custom styles |
| `lib/design.ts` | Design tokens, brand config, status colors |
| `components.json` | shadcn/ui theme configuration |

## Color System

### Primary Brand Color

Edit in `app/globals.css`:

```css
:root {
  --brand-primary: oklch(0.55 0.2 260); /* Purple-blue */
  --brand-primary-light: oklch(0.7 0.15 260);
  --brand-primary-dark: oklch(0.4 0.2 260);
}
```

To change the brand color, modify the hue value (last number). Examples:
- Blue: `oklch(0.55 0.2 250)`
- Green: `oklch(0.55 0.2 145)`
- Orange: `oklch(0.55 0.2 50)`
- Pink: `oklch(0.55 0.2 350)`

### shadcn/ui Theme Colors

The base theme colors are in `app/globals.css` under `:root` and `.dark`. Key variables:

```css
:root {
  --primary: oklch(0.205 0 0);      /* Button, links */
  --secondary: oklch(0.97 0 0);     /* Secondary buttons */
  --muted: oklch(0.97 0 0);         /* Muted backgrounds */
  --accent: oklch(0.97 0 0);        /* Accents */
  --destructive: oklch(0.577 0.245 27.325); /* Error states */
}
```

### Status Colors

Status indicators for video generation progress. Edit in `app/globals.css`:

```css
:root {
  --status-success: oklch(0.65 0.2 145);  /* Green */
  --status-warning: oklch(0.75 0.15 75);  /* Yellow */
  --status-error: oklch(0.6 0.25 25);     /* Red */
  --status-info: oklch(0.6 0.2 250);      /* Blue */
}
```

### Change Type Badges

Badge colors for PR change types (feature, bugfix, etc.). Edit in `app/globals.css`:

```css
:root {
  --badge-feature-bg: oklch(0.92 0.05 250);
  --badge-feature-text: oklch(0.45 0.2 250);
  --badge-bugfix-bg: oklch(0.95 0.05 75);
  --badge-bugfix-text: oklch(0.55 0.15 55);
  /* ... etc */
}
```

Or edit the semantic config in `lib/design.ts`:

```typescript
changeTypes: {
  feature: { bg: "#dbeafe", text: "#1d4ed8", label: "Feature" },
  bugfix: { bg: "#fef3c7", text: "#d97706", label: "Bug Fix" },
  // ...
}
```

## Typography

### Fonts

Fonts are loaded in `app/layout.tsx`. The app uses:
- **Geist Sans** - Main font
- **Geist Mono** - Code/monospace

To change fonts:

1. Import your preferred fonts in `app/layout.tsx`:
```typescript
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
```

2. Update CSS variables in `app/globals.css`:
```css
@theme inline {
  --font-sans: var(--font-inter);
}
```

## Components

### Buttons

Button styles are defined in `components/ui/button.tsx`. The file uses CSS classes that reference the theme variables.

### Cards

Card styles are in `components/ui/card.tsx`.

### Badges

Badge variants are in `components/ui/badge.tsx`.

## Custom Styles

### Hero Section Gradient

The landing page hero gradient is in `app/globals.css`:

```css
.hero-gradient {
  background: radial-gradient(
    ellipse 80% 50% at 50% -20%,
    oklch(0.92 0.05 260) 0%,  /* Change hue for different color */
    transparent 100%
  );
}
```

### Gradient Text

For headline gradient text effect:

```css
.gradient-text {
  background: linear-gradient(
    135deg,
    var(--brand-primary) 0%,
    var(--brand-primary-light) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Status Dot Animation

The pulsing status indicator animation:

```css
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.status-dot.analyzing,
.status-dot.generating_audio,
.status-dot.rendering {
  animation: pulse-subtle 1.5s ease-in-out infinite;
}
```

## Dark Mode

Dark mode styles are in `app/globals.css` under `.dark`:

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}

.dark .hero-gradient {
  background: radial-gradient(
    ellipse 80% 50% at 50% -20%,
    oklch(0.25 0.1 260) 0%,
    transparent 100%
  );
}
```

## Brand Configuration

Brand text and metadata is in `lib/design.ts`:

```typescript
export const design = {
  brand: {
    name: "DemoShip",
    tagline: "Turn PRs into shareable demo videos",
    description: "Generate AI-powered demo videos...",
  },
  // ...
}
```

This is used in:
- Page metadata (title, description)
- Header logo text
- Footer
- CTA sections

## Video Rendering (Remotion)

Video visual styles are in `remotion/src/components/`:

| Component | Purpose |
|-----------|---------|
| `Intro.tsx` | Opening sequence with PR title |
| `Summary.tsx` | AI summary display |
| `DiffView.tsx` | Code diff visualization |
| `Outro.tsx` | Closing with branding |

### Video Colors

The video uses a dark theme. Key colors in Remotion components:

```typescript
// Background
backgroundColor: "#0f172a"

// Gradient
background: "radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)"

// Text
color: "white"           // Primary text
color: "#94a3b8"         // Secondary text
color: "#60a5fa"         // Accent (blue)

// Diff colors
color: "#22c55e"         // Additions (green)
color: "#ef4444"         // Deletions (red)
```

## Logo

The logo is an inline SVG in `components/header.tsx`:

```tsx
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32">
      {/* Ship icon SVG paths */}
    </svg>
  );
}
```

To replace with a custom logo:
1. Replace the SVG content, or
2. Use an `<Image>` component with your logo file

## Assets

Static assets go in the `public/` directory:
- `public/logo.svg` - Logo file
- `public/favicon.ico` - Browser favicon
- `public/og-image.png` - Social sharing image

## Spacing & Layout

Page layout constants are in `lib/design.ts`:

```typescript
spacing: {
  page: {
    maxWidth: "1200px",
    paddingX: "1rem",
    paddingY: "2rem",
  },
},
```

Used with Tailwind classes:
- `container mx-auto px-4` - Page container
- `max-w-4xl` - Content max width
- `py-8` - Section padding

## Border Radius

Radius scale in `app/globals.css`:

```css
:root {
  --radius: 0.625rem;  /* Base radius */
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

## Shadows

Custom shadows in `lib/design.ts`:

```typescript
shadows: {
  card: "0 1px 3px 0 rgb(0 0 0 / 0.1)...",
  hover: "0 4px 6px -1px rgb(0 0 0 / 0.1)...",
},
```

## Animations

Animation durations in `lib/design.ts`:

```typescript
animation: {
  fast: "150ms",
  normal: "300ms",
  slow: "500ms",
},
```

## Testing Changes

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 to preview changes

3. Build to verify no errors:
   ```bash
   npm run build
   ```

## Common Customizations

### Change Brand Color to Blue

1. Edit `app/globals.css`:
```css
:root {
  --brand-primary: oklch(0.55 0.2 250);
  --brand-primary-light: oklch(0.7 0.15 250);
}
```

### Change Button Style

Edit `components/ui/button.tsx` to modify button variants or add new ones.

### Add Custom Badge Type

1. Add to `lib/design.ts`:
```typescript
changeTypes: {
  // ... existing types
  security: { bg: "#fef2f2", text: "#b91c1c", label: "Security" },
}
```

2. Add CSS variables if needed in `app/globals.css`

### Customize Video Watermark

Edit `remotion/src/components/Outro.tsx` and the watermark overlay in `remotion/src/compositions/DemoVideo.tsx`.
