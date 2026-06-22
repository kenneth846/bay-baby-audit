# Bay Baby Audit

A simpler inspection and Primus audit-preparation application for Bay Baby Produce.

## Included

- Responsive Inspector report inbox with status tabs, filters, search, selection, and audit scope
- Three-step report form with draft and submission states
- Manager review and corrective-action workflow
- Four-step Audit Generator with readiness validation and server-generated PDF download
- Scalable Supabase schema for dynamic report templates, questions, attachments, reviews, and audit packets
- Seed locations and initial R001, R004, and R006 report types
- HeavyConnect transcription ledger under `data/heavyconnect-templates`

## Local setup

1. Copy `.env.example` to `.env.local` and add Supabase values.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev`.
4. Open `http://127.0.0.1:3000`.

The current interface uses realistic local demonstration data, so it runs without Supabase credentials. Apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` when connecting a project.

## HeavyConnect template migration

The active-template verification found six report types with activity in HeavyConnect's visible summary period:

- R001 Field Activity Log
- R004 Tractor Inspection
- Daily Sanitation Log
- R006 Daily Sanitation Log
- R024 Field Buffer Log
- FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting

R022 Risk Assessment is available in the active Field template library but did not appear in that recent summary period.

Exact structured captures currently exist for R001, R004, and R006. The manifest intentionally marks incomplete templates and unanswered dropdown option sets as pending; they must not be guessed.

## Deployment

Vercel: import the repository, set the three environment variables, and deploy with the Next.js preset.

Netlify: use the Next.js runtime, set the same environment variables, and deploy with build command `pnpm build`.
