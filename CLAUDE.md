@AGENTS.md

# مِرآة (Mirrah)

An AI "mystery customer" platform for businesses. Mirrah contacts a business the way a real
customer would (WhatsApp, website form, email), measures how the business responds, shows the
owner a scored report with evidence, and later fixes the gaps with a Claude-powered reply agent.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind v4. UI is Arabic and RTL by default (`<html lang="ar" dir="rtl">`).
- Data: Supabase Postgres (`supabase/migrations`). Without Supabase env vars the app runs in DEMO
  mode on a local JSON file store (`.data/db.json`). Both implement `Store` in `src/lib/db/types.ts`.
- AI: every Claude API call goes through `src/lib/ai/` only. Without `ANTHROPIC_API_KEY` the AI
  layer returns deterministic mock outputs so the full flow can be exercised offline.
- Background jobs: Inngest (`src/lib/engine/inngest.ts`, served at `/api/inngest`).

## Rules
- All user-facing text is Arabic. Code, identifiers and comments are English.
- Numbers that can be measured (response time, counts, dates) are computed in code, never by Claude.
  Claude only judges content and must quote evidence for every score.
- Scoring weights live in `src/lib/scoring.ts` and are the single source of truth.
- Every AI output is validated with zod schemas in `src/lib/ai/schemas.ts`.
- WhatsApp mystery-customer messages are NOT automated (WhatsApp ToS). The engine creates operator
  tasks in `/ops`; a human sends the drafted message from a real phone and pastes the reply back.
- A business is only scanned with its owner's consent. Competitor names are visible only to the
  owning organization and never published.
- Owners reach their dashboard with a secret link `/app/<accessToken>`. Never put the access token on
  shareable pages (`/r/<reportToken>` is the shareable one).
- Competitor scans: paid plans only, max 3 competitors, one single-channel probe per competitor per
  30 days (`src/lib/engine/schedule.ts`).
- Keep business logic in `src/lib/engine/` as plain async functions over a `Store` so it is testable
  without Next.js or Inngest.

## Commands
- `npm run dev` — local dev (demo mode works with no env vars)
- `npm test` — vitest
- `npm run build` — production build
