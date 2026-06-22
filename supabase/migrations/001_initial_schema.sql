create type public.user_role as enum ('admin', 'manager', 'operator');
create type public.report_status as enum ('draft', 'submitted', 'reviewed');
create type public.report_severity as enum ('good', 'attention', 'issue');

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
  review_notes text,
  reviewed_at timestamptz not null default now()
);
create table public.audit_packets (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  generated_by uuid not null references public.users_profile(id),
  file_path text,
  scope jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.audit_packet_reports (
  audit_packet_id uuid not null references public.audit_packets(id) on delete cascade,
  report_id uuid not null references public.reports(id),
  primary key (audit_packet_id, report_id)
);

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
create policy "operators create reports" on public.reports for insert to authenticated with check (creator_id = auth.uid());
create policy "creators update drafts" on public.reports for update to authenticated using (creator_id = auth.uid() and status = 'draft');
