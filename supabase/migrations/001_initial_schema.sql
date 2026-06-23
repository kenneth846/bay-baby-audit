create type public.user_role as enum ('admin', 'manager', 'reviewer', 'auditor', 'operator');
create type public.report_status as enum ('draft', 'submitted', 'needs_review', 'corrective_action', 'approved', 'archived');
create type public.report_severity as enum ('good', 'attention', 'issue');
create type public.audit_packet_status as enum ('draft', 'generated', 'approved', 'archived');

create table public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'operator',
  created_at timestamptz not null default now()
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);
create table public.report_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'Field',
  active boolean not null default true
);
create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  report_type_id uuid not null references public.report_types(id),
  version integer not null default 1,
  published boolean not null default false,
  source text not null default 'Bay Baby Audit',
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(report_type_id, version)
);
create table public.report_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  section text not null,
  prompt text not null,
  answer_type text not null default 'yes_no_na',
  required boolean not null default true,
  critical boolean not null default false,
  sort_order integer not null
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type_id uuid not null references public.report_types(id),
  template_id uuid not null references public.report_templates(id),
  location_id uuid not null references public.locations(id),
  creator_id uuid not null references public.users_profile(id),
  report_date date not null,
  report_time time not null,
  notes text,
  status report_status not null default 'draft',
  severity report_severity not null default 'good',
  signature_path text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);
create table public.report_answers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  question_id uuid not null references public.report_template_questions(id),
  answer text,
  notes text,
  corrective_action text,
  unique(report_id, question_id)
);
create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  answer_id uuid references public.report_answers(id) on delete set null,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
create table public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  reviewer_id uuid not null references public.users_profile(id),
  decision report_status not null default 'needs_review',
  review_notes text,
  reviewed_at timestamptz not null default now()
);
create table public.audit_packets (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  generated_by uuid not null references public.users_profile(id),
  file_path text,
  status audit_packet_status not null default 'draft',
  scope jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  primus_version text not null default '4.0',
  approved_by uuid references public.users_profile(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.audit_packet_reports (
  audit_packet_id uuid not null references public.audit_packets(id) on delete cascade,
  report_id uuid not null references public.reports(id),
  primary key (audit_packet_id, report_id)
);

create function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users_profile where id = auth.uid()
$$;

create function public.has_role(allowed_roles public.user_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = any(allowed_roles), false)
$$;

alter table public.users_profile enable row level security;
alter table public.locations enable row level security;
alter table public.report_types enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_template_questions enable row level security;
alter table public.reports enable row level security;
alter table public.report_answers enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_reviews enable row level security;
alter table public.audit_packets enable row level security;
alter table public.audit_packet_reports enable row level security;

create policy "authenticated read reference data" on public.locations for select to authenticated using (true);
create policy "authenticated read report types" on public.report_types for select to authenticated using (true);
create policy "authenticated read templates" on public.report_templates for select to authenticated using (true);
create policy "authenticated read questions" on public.report_template_questions for select to authenticated using (true);
create policy "authenticated read reports" on public.reports for select to authenticated using (true);
create policy "authenticated read answers" on public.report_answers for select to authenticated using (true);
create policy "authenticated read attachments" on public.report_attachments for select to authenticated using (true);
create policy "authenticated read reviews" on public.report_reviews for select to authenticated using (true);
create policy "authenticated read audit packets" on public.audit_packets for select to authenticated using (true);
create policy "authenticated read audit packet reports" on public.audit_packet_reports for select to authenticated using (true);

create policy "admins manage users" on public.users_profile for all to authenticated using (public.has_role(array['admin']::public.user_role[])) with check (public.has_role(array['admin']::public.user_role[]));
create policy "users read own profile" on public.users_profile for select to authenticated using (id = auth.uid() or public.has_role(array['admin','manager','reviewer','auditor']::public.user_role[]));

create policy "operators create reports" on public.reports for insert to authenticated with check (creator_id = auth.uid());
create policy "creators update drafts" on public.reports for update to authenticated using (creator_id = auth.uid() and status = 'draft') with check (creator_id = auth.uid());
create policy "reviewers approve reports" on public.reports for update to authenticated using (public.has_role(array['admin','manager','reviewer']::public.user_role[])) with check (public.has_role(array['admin','manager','reviewer']::public.user_role[]));
create policy "operators create answers" on public.report_answers for insert to authenticated with check (
  exists (select 1 from public.reports where reports.id = report_answers.report_id and reports.creator_id = auth.uid())
);
create policy "operators update own draft answers" on public.report_answers for update to authenticated using (
  exists (select 1 from public.reports where reports.id = report_answers.report_id and reports.creator_id = auth.uid() and reports.status = 'draft')
);
create policy "authenticated add attachments" on public.report_attachments for insert to authenticated with check (
  exists (select 1 from public.reports where reports.id = report_attachments.report_id and (reports.creator_id = auth.uid() or public.has_role(array['admin','manager','reviewer']::public.user_role[])))
);
create policy "reviewers create reviews" on public.report_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and public.has_role(array['admin','manager','reviewer']::public.user_role[])
);
create policy "admins manage templates" on public.report_templates for all to authenticated using (public.has_role(array['admin','manager']::public.user_role[])) with check (public.has_role(array['admin','manager']::public.user_role[]));
create policy "admins manage questions" on public.report_template_questions for all to authenticated using (public.has_role(array['admin','manager']::public.user_role[])) with check (public.has_role(array['admin','manager']::public.user_role[]));
create policy "managers generate audit packets" on public.audit_packets for insert to authenticated with check (
  generated_by = auth.uid() and public.has_role(array['admin','manager']::public.user_role[])
);
create policy "managers update audit packets" on public.audit_packets for update to authenticated using (public.has_role(array['admin','manager']::public.user_role[])) with check (public.has_role(array['admin','manager']::public.user_role[]));
create policy "managers link packet reports" on public.audit_packet_reports for insert to authenticated with check (public.has_role(array['admin','manager']::public.user_role[]));
