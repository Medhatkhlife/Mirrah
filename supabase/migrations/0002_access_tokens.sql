-- Phase 3: private owner dashboard links (/app/<access_token>).
alter table organizations add column access_token text;
update organizations set access_token = encode(gen_random_bytes(18), 'base64') where access_token is null;
alter table organizations alter column access_token set not null;
create unique index organizations_access_token_key on organizations (access_token);

-- Competitor scans are listed per competitor when enforcing the monthly limit.
create index if not exists scans_competitor_idx on scans (competitor_id, created_at desc);
