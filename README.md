# DemoShip

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/andysantamaria0/demoship)

Turn GitHub pull requests into shareable demo videos with AI narration in under 2 minutes.

## Features

- **AI-Powered Analysis**: Claude analyzes your PR and generates a business-focused script
- **Voice Narration**: ElevenLabs creates professional voice-over
- **Code Visualization**: Animated code diffs with syntax highlighting
- **Easy Sharing**: Unique links for each video
- **GitHub Integration**: Works with any public or private repository

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (GitHub OAuth)
- **Storage**: Supabase Storage
- **Video Rendering**: Remotion on Railway
- **AI Analysis**: Claude API (Anthropic)
- **Voice**: ElevenLabs API

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- GitHub OAuth app
- Anthropic API key
- ElevenLabs API key
- Railway account (for video rendering)

### 1. Clone and Install

```bash
git clone <repo-url>
cd demoship
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GitHub
GITHUB_TOKEN=ghp_your_github_token

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-your-api-key

# ElevenLabs
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Remotion server (Railway)
REMOTION_SERVER_URL=https://your-remotion-server.railway.app
REMOTION_WEBHOOK_SECRET=your-webhook-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Supabase

1. Create a new Supabase project
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Enable GitHub OAuth in Authentication settings
4. Create a storage bucket named `media` (public)
5. Add your app URL to the redirect URLs

### 4. Set Up GitHub OAuth

1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create a new OAuth app
3. Set callback URL to `http://localhost:3000/api/auth/callback`
4. Add client ID and secret to Supabase Auth settings

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploying

### Deploy Web App to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Deploy Remotion Server to Railway

```bash
cd remotion
npm install
```

1. Create new Railway project
2. Connect to the `remotion` directory
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REMOTION_WEBHOOK_SECRET`
4. Deploy

## Project Structure

```
/demoship
├── app/                      # Next.js App Router
│   ├── page.tsx              # Landing page
│   ├── login/                # Login page
│   ├── dashboard/            # User dashboard
│   ├── video/[id]/           # Video detail
│   ├── v/[shareId]/          # Public share page
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── pr-input.tsx          # PR URL input form
│   ├── video-card.tsx        # Video preview card
│   ├── video-player.tsx      # Video player
│   └── generation-status.tsx # Status display
├── lib/
│   ├── supabase/             # Supabase clients
│   ├── github.ts             # GitHub API helpers
│   ├── claude.ts             # Claude API helpers
│   ├── elevenlabs.ts         # ElevenLabs API
│   ├── design.ts             # Design tokens
│   ├── types.ts              # TypeScript types
│   └── utils.ts              # Utilities
├── remotion/                 # Video rendering
│   ├── src/
│   │   ├── compositions/     # Video composition
│   │   └── components/       # Video components
│   └── server.ts             # Render server
└── supabase/
    └── migrations/           # Database migrations
```

## Customizing Design

See [DESIGN.md](./DESIGN.md) for detailed design customization instructions.

Key files:
- `app/globals.css` - Colors, CSS variables
- `lib/design.ts` - Design tokens, brand config
- `remotion/src/components/` - Video visual styles

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/videos` | POST | Create new video job |
| `/api/videos` | GET | List user's videos |
| `/api/videos/[id]` | GET | Get video details |
| `/api/videos/[id]/retry` | POST | Retry failed video |
| `/api/share/[shareId]` | GET | Get public video |
| `/api/webhook/render-complete` | POST | Render callback |

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the full schema.

Main tables:
- `profiles` - User profiles (extends auth.users)
- `videos` - Video generation jobs

## License

MIT
