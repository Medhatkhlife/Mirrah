-- Mirrah initial schema.
-- The app server talks to Postgres with the service role key and enforces ownership in code.
-- RLS is enabled on every table so that the anon/authenticated roles (browser) can only read
-- rows belonging to organizations they are members of.

create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text not null,
  city text not null default '',
  website text,
  whatsapp text,
  email text,
  owner_email text not null,
  plan text not null default 'free' check (plan in ('free','pulse','pulse_coach','full')),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  website text,
  whatsapp text,
  email text,
  created_at timestamptz not null default now()
);

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  dialect text not null,
  persona text not null,
  goal text not null,
  questions jsonb not null default '[]',
  objections jsonb not null default '[]',
  budget text not null default '',
  opening_message text not null,
  created_at timestamptz not null default now()
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  kind text not null check (kind in ('free','weekly','competitor')),
  status text not null default 'running' check (status in ('running','completed')),
  scenario_id uuid not null references scenarios(id),
  report_token text not null unique,
  score numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table probes (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','web_form','email')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','awaiting_send','awaiting_reply','finished')),
  round int not null default 0,
  first_response_minutes numeric,
  no_reply boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  probe_id uuid not null references probes(id) on delete cascade,
  sender text not null check (sender in ('customer','business')),
  body text not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('draft','sent'))
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  probe_id uuid not null unique references probes(id) on delete cascade,
  criteria jsonb not null,
  suggestion text not null default '',
  score numeric not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan text not null,
  status text not null,
  provider text not null,
  provider_ref text,
  created_at timestamptz not null default now()
);

create index on scans (organization_id, created_at desc);
create index on probes (scan_id);
create index on probes (status);
create index on messages (probe_id, sent_at);

-- Row level security -------------------------------------------------------
create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.organization_id = org and m.user_id = auth.uid());
$$;

alter table organizations enable row level security;
alter table members enable row level security;
alter table competitors enable row level security;
alter table scenarios enable row level security;
alter table scans enable row level security;
alter table probes enable row level security;
alter table messages enable row level security;
alter table evaluations enable row level security;
alter table subscriptions enable row level security;

create policy org_read on organizations for select using (is_member(id));
create policy members_read on members for select using (user_id = auth.uid());
create policy competitors_read on competitors for select using (is_member(organization_id));
create policy scans_read on scans for select using (is_member(organization_id));
create policy probes_read on probes for select using (
  exists (select 1 from scans s where s.id = scan_id and is_member(s.organization_id)));
create policy messages_read on messages for select using (
  exists (select 1 from probes p join scans s on s.id = p.scan_id
          where p.id = probe_id and is_member(s.organization_id)));
create policy evaluations_read on evaluations for select using (
  exists (select 1 from probes p join scans s on s.id = p.scan_id
          where p.id = probe_id and is_member(s.organization_id)));
create policy subscriptions_read on subscriptions for select using (is_member(organization_id));
-- scenarios: no browser access (no policy = denied). Writes happen only via the service role.
