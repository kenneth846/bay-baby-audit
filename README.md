# Bay Baby Audit

A simpler inspection and Primus audit-preparation application for Bay Baby Produce.

## Included

- Responsive Inspector report inbox loaded from Supabase
- Supabase-backed location, team, template, and report counts
- Manager review and corrective-action surfaces for real reports
- Four-step Audit Generator with selected-report validation and server-generated PDF download
- PrimusGFS v4.0 standard view with module readiness and evidence mapping
- Legacy self-audit capture plus a draft question crosswalk to PrimusGFS v4.0
- Scalable Supabase schema for dynamic report templates, questions, attachments, reviews, and audit packets
- Seed locations and initial R001, R004, and R006 report types
- Bay Baby template ledger under `data/heavyconnect-templates`
- Bay Baby historical report evidence import under `data/heavyconnect-reports`
- PrimusGFS v4.0 extracted module index under `data/primusgfs/v4`

## Local setup

1. Copy `.env.example` to `.env.local` and add Supabase values. Keep `SUPABASE_SECRET_KEY` local only; do not commit it.
2. If you deploy on Netlify, also set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Browser code cannot read the non-public `SUPABASE_*` variables.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev`.
5. Apply `supabase/migrations/001_initial_schema.sql` to the target Supabase project.
6. Add real reference rows. `supabase/seed.sql` only inserts starter locations and report types; it does not create users or fake reports.
7. Open `http://127.0.0.1:3000`.

The app no longer falls back to local demonstration reports, people, locations, or readiness scores. If Supabase tables are missing, empty, or blocked by RLS, the UI shows that state instead of fabricating data.

With the currently configured project URL, a direct REST check returned `Could not find the table 'public.locations' in the schema cache`, which means the migration has not been applied to that Supabase project yet or the table was created in a different schema/project.

## Roles and approvals

The Supabase schema defines five roles:

- `admin`: manages users, templates, reviews, and audit packets.
- `manager`: reviews/approves reports, creates corrective actions, and generates audit packets.
- `reviewer`: reviews/approves reports and creates corrective actions.
- `auditor`: read/export access for approved evidence and generated packets.
- `operator`: creates and submits their own field reports.

Report approval is limited to `admin`, `manager`, and `reviewer`. Audit packet generation is limited to `admin` and `manager`.

## Audit standard

Bay Baby Audit treats PrimusGFS v4.0 as the audit-standard backbone. The extracted v4.0 index includes Modules 1-6, source URLs, question counts, point values, sections, and evidence tags.

Likely Bay Baby scope is Modules 1, 2, 4, 5, and 6. Module 3, Indoor Agriculture, is kept available but marked optional/confirm until the actual audit scope requires it.

Bay Baby reports should be mapped as evidence against PrimusGFS v4.0 question IDs. Legacy self-audit templates are not the source of truth; they are captured under `data/heavyconnect-self-audits` and draft-mapped to v4.0 under `data/primusgfs/crosswalks/v3-2-to-v4-0.json`.

## Historical evidence import

Completed historical report PDFs were imported locally for January 1, 2025 through January 1, 2026 and indexed into `data/heavyconnect-reports/inventory.json`.

The original PDFs remain local and are not committed. The committed import includes metadata, report type grouping, bounded field samples, evidence tags, and a first-pass map to PrimusGFS v4.0 modules.

The seven core Bay Baby report types are all represented in the import:

- Daily Sanitation Log
- FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting
- R001 Field Activity Log
- R004 Tractor Inspection
- R006 Daily Sanitation Log
- R022 Risk Assessment
- R024 Field Buffer Log

## Current production-readiness pass

The app now avoids the earlier demo-only report flow. The Inspector, Locations, Team, Templates, and Settings views read Supabase data and show empty/setup states when no real rows are available.

Captured templates remain under `data/heavyconnect-templates` as migration/reference material. Runtime templates should come from `public.report_templates` and `public.report_template_questions`. Remaining live dropdown/multi-select option gaps are tracked in `data/heavyconnect-templates/live-capture-gaps.json` and should not be guessed.

## Template migration

The active-template verification found six report types with activity in the visible summary period:

- R001 Field Activity Log
- R004 Tractor Inspection
- Daily Sanitation Log
- R006 Daily Sanitation Log
- R024 Field Buffer Log
- FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting

R022 Risk Assessment is available in the active Field template library but did not appear in that recent summary period.

Structured captures now exist for all seven core Bay Baby templates using a mix of live option capture and completed-report PDFs. The remaining work is exact live option capture for dropdowns/multi-select controls listed in `live-capture-gaps.json`.

## Deployment

Vercel: import the repository, set the three environment variables, and deploy with the Next.js preset.

Netlify: use the Next.js runtime, set the same environment variables, and deploy with build command `pnpm build`.
