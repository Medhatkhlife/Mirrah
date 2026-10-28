-- Phase 4: reply agent settings, agent conversations, and billing references.
alter table organizations add column knowledge_base text not null default '';
alter table organizations add column agent_enabled boolean not null default false;
alter table organizations add column agent_hours text not null default '17-9';
alter table organizations add column wa_phone_number_id text unique;

create table agent_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer text not null,
  sender text not null check (sender in ('customer','agent')),
  body text not null,
  handoff boolean not null default false,
  sent_at timestamptz not null default now()
);
create index on agent_messages (organization_id, customer, sent_at desc);

alter table agent_messages enable row level security;
create policy agent_messages_read on agent_messages for select using (is_member(organization_id));
