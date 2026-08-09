-- Live Sports TV: initial production schema, RLS, automation and demo seed data.
-- Generated with Supabase CLI; reviewed for an exposed public schema.

-- Some hosted projects include this helper. It must never be callable through the public API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create type public.app_role as enum ('user', 'admin');
create type public.match_status as enum ('scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled');
create type public.stream_source_type as enum ('youtube_embed', 'official_embed', 'licensed_hls', 'licensed_dash', 'external_official_link');
create type public.permission_state as enum ('pending', 'approved', 'rejected', 'expired');
create type public.review_state as enum ('pending', 'approved', 'rejected');
create type public.validation_state as enum ('pending', 'valid', 'invalid', 'expired', 'territory_blocked');
create type public.stream_state as enum ('active', 'disabled', 'expired');
create type public.job_state as enum ('running', 'success', 'failed', 'skipped');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://[^[:space:]]+$'),
  role public.app_role not null default 'user',
  language text not null default 'en' check (language in ('en', 'bn')),
  favourite_team_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  icon text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  country text,
  logo_url text check (logo_url is null or logo_url ~ '^https://[^[:space:]]+$'),
  external_provider text,
  external_id text,
  featured boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_provider, external_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  name text not null,
  short_name text not null check (char_length(short_name) between 2 and 6),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  country text,
  logo_url text check (logo_url is null or logo_url ~ '^https://[^[:space:]]+$'),
  external_provider text,
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_provider, external_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete restrict,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text,
  external_provider text,
  external_id text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.match_status not null default 'scheduled',
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  clock text,
  venue text,
  statistics jsonb not null default '{}',
  featured boolean not null default false,
  is_demo boolean not null default false,
  manually_corrected boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (ends_at is null or ends_at > starts_at),
  unique (external_provider, external_id)
);

create table public.approved_sources (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  provider_domain text not null check (provider_domain = lower(provider_domain) and provider_domain ~ '^[a-z0-9.-]+$'),
  source_type public.stream_source_type not null,
  official_channel_id text,
  territory text[] not null default '{BD}',
  embed_allowed boolean not null default false,
  permission_status public.permission_state not null default 'pending',
  permission_reference text,
  rights_expiry timestamptz,
  source_page_url text not null check (source_page_url ~ '^https://[^[:space:]]+$'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_domain, official_channel_id),
  check (cardinality(territory) > 0),
  check (rights_expiry is null or rights_expiry > created_at)
);

create table public.source_candidates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  approved_source_id uuid not null references public.approved_sources(id) on delete cascade,
  provider_asset_id text not null,
  embed_url text check (embed_url is null or embed_url ~ '^https://[^[:space:]]+$'),
  source_page_url text not null check (source_page_url ~ '^https://[^[:space:]]+$'),
  confidence_score integer not null check (confidence_score between 0 and 100),
  validation_status public.validation_state not null default 'pending',
  validation_reason text,
  review_status public.review_state not null default 'pending',
  discovered_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, approved_source_id, provider_asset_id)
);

create table public.match_streams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  approved_source_id uuid not null references public.approved_sources(id) on delete restrict,
  provider_asset_id text not null,
  source_type public.stream_source_type not null,
  embed_url text check (embed_url is null or embed_url ~ '^https://[^[:space:]]+$'),
  source_page_url text not null check (source_page_url ~ '^https://[^[:space:]]+$'),
  territory text[] not null default '{BD}',
  starts_at timestamptz not null,
  expires_at timestamptz,
  status public.stream_state not null default 'active',
  priority integer not null default 100 check (priority between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check ((source_type = 'external_official_link' and embed_url is null) or (source_type <> 'external_official_link' and embed_url is not null)),
  unique (match_id, approved_source_id, provider_asset_id)
);

create table public.content_rights (
  id uuid primary key default gen_random_uuid(),
  approved_source_id uuid not null references public.approved_sources(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  territory text[] not null default '{BD}',
  permission_reference text not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  approved_source_id uuid references public.approved_sources(id) on delete restrict,
  title text not null,
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://[^[:space:]]+$'),
  video_url text not null check (video_url ~ '^https://[^[:space:]]+$'),
  provider_name text not null,
  published_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((match_id is not null)::integer + (team_id is not null)::integer = 1),
  unique nulls not distinct (user_id, match_id, team_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('home_hero', 'home_secondary', 'highlights')),
  title_en text not null,
  title_bn text,
  subtitle_en text,
  subtitle_bn text,
  image_url text check (image_url is null or image_url ~ '^https://[^[:space:]]+$'),
  link_url text check (link_url is null or link_url ~ '^https://[^[:space:]]+$'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message_en text not null,
  message_bn text,
  link_url text check (link_url is null or link_url ~ '^https://[^[:space:]]+$'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('home_banner', 'match_card', 'pre_player', 'player_sidebar', 'footer')),
  name text not null,
  image_url text check (image_url is null or image_url ~ '^https://[^[:space:]]+$'),
  destination_url text check (destination_url is null or destination_url ~ '^https://[^[:space:]]+$'),
  html_content text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (html_content is null or (html_content !~* '<script' and html_content !~* '<iframe'))
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title_en text not null,
  title_bn text,
  body_en text not null,
  body_bn text,
  meta_description text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  site_name text not null default 'Live Sports TV',
  tagline text not null default 'Every match. One place. Official sources only.',
  default_language text not null default 'en' check (default_language in ('en', 'bn')),
  logo_url text check (logo_url is null or logo_url ~ '^https://[^[:space:]]+$'),
  favicon_url text check (favicon_url is null or favicon_url ~ '^https://[^[:space:]]+$'),
  primary_color text not null default '#25d9ff' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  footer_text text not null,
  social_links jsonb not null default '{}',
  discovery_threshold integer not null default 82 check (discovery_threshold between 50 and 100),
  discovery_interval_minutes integer not null default 10 check (discovery_interval_minutes between 5 and 1440),
  ads_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  provider text,
  status public.job_state not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'
);

create table public.playback_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  match_stream_id uuid references public.match_streams(id) on delete set null,
  event_type text not null check (event_type in ('requested', 'started', 'error', 'fallback', 'external_open')),
  error_code text,
  territory text,
  user_id uuid references auth.users(id) on delete set null,
  session_hash text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Supporting indexes for fixture windows, discovery queues and user-owned rows.
create index matches_status_starts_at_idx on public.matches(status, starts_at);
create index matches_competition_starts_at_idx on public.matches(competition_id, starts_at);
create index matches_home_team_idx on public.matches(home_team_id);
create index matches_away_team_idx on public.matches(away_team_id);
create index candidates_review_confidence_idx on public.source_candidates(review_status, confidence_score desc);
create index candidates_match_idx on public.source_candidates(match_id);
create index streams_match_status_priority_idx on public.match_streams(match_id, status, priority);
create index rights_source_competition_idx on public.content_rights(approved_source_id, competition_id);
create index favourites_user_idx on public.favourites(user_id);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index sync_logs_started_idx on public.sync_logs(started_at desc);
create index playback_logs_match_created_idx on public.playback_logs(match_id, created_at desc);
create index audit_logs_created_idx on public.admin_audit_logs(created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.validate_stream_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.approved_sources%rowtype;
  asset_host text;
  normalized_domain text;
begin
  select * into source_row from public.approved_sources where id = new.approved_source_id;
  if not found or not source_row.active or source_row.permission_status <> 'approved' then
    raise exception 'Source is not active and approved';
  end if;
  if source_row.rights_expiry is not null and source_row.rights_expiry <= now() then
    raise exception 'Source rights have expired';
  end if;
  if not ('BD' = any(source_row.territory) or 'GLOBAL' = any(source_row.territory)) then
    raise exception 'Source does not permit Bangladesh territory';
  end if;
  if new.embed_url is not null then
    asset_host := lower(split_part(split_part(split_part(new.embed_url, '://', 2), '/', 1), ':', 1));
    normalized_domain := regexp_replace(source_row.provider_domain, '^www\.', '');
    if normalized_domain in ('youtube.com', 'youtu.be') then
      if asset_host not in ('youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com') then
        raise exception 'YouTube embed host is not allowed';
      end if;
    elsif asset_host <> source_row.provider_domain and asset_host not like '%.' || source_row.provider_domain then
      raise exception 'Asset host is outside the approved provider domain';
    end if;
    if not source_row.embed_allowed then
      raise exception 'Embedding is not permitted for this source';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_stream_source() from public, anon, authenticated;

create trigger validate_match_stream_source
before insert or update of approved_source_id, embed_url, source_type on public.match_streams
for each row execute function private.validate_stream_source();

create trigger validate_candidate_source
before insert or update of approved_source_id, embed_url on public.source_candidates
for each row execute function private.validate_stream_source();

create or replace function private.promote_approved_candidate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_row public.approved_sources%rowtype;
  match_row public.matches%rowtype;
begin
  if new.review_status = 'approved' and old.review_status is distinct from 'approved' then
    if new.validation_status <> 'valid' then
      raise exception 'Only valid candidates can be approved';
    end if;
    select * into source_row from public.approved_sources where id = new.approved_source_id;
    select * into match_row from public.matches where id = new.match_id;
    insert into public.match_streams (
      match_id, approved_source_id, provider_asset_id, source_type, embed_url,
      source_page_url, territory, starts_at, expires_at, status, priority
    ) values (
      new.match_id, new.approved_source_id, new.provider_asset_id, source_row.source_type,
      case when source_row.source_type = 'external_official_link' then null else new.embed_url end,
      new.source_page_url, source_row.territory, match_row.starts_at,
      least(coalesce(source_row.rights_expiry, 'infinity'::timestamptz), coalesce(match_row.ends_at + interval '2 hours', match_row.starts_at + interval '8 hours')),
      'active', 100
    )
    on conflict (match_id, approved_source_id, provider_asset_id)
    do update set embed_url = excluded.embed_url, source_page_url = excluded.source_page_url,
      territory = excluded.territory, expires_at = excluded.expires_at, status = 'active', updated_at = now();
    new.reviewed_by := coalesce(new.reviewed_by, (select auth.uid()));
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  return new;
end;
$$;

create trigger promote_source_candidate
before update of review_status on public.source_candidates
for each row execute function private.promote_approved_candidate();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','sports','competitions','teams','matches','approved_sources','source_candidates',
    'match_streams','content_rights','highlights','banners','announcements','advertisements','pages'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end $$;

-- Enable RLS on every table in the exposed public schema.
alter table public.profiles enable row level security;
alter table public.sports enable row level security;
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.approved_sources enable row level security;
alter table public.source_candidates enable row level security;
alter table public.match_streams enable row level security;
alter table public.content_rights enable row level security;
alter table public.highlights enable row level security;
alter table public.favourites enable row level security;
alter table public.notifications enable row level security;
alter table public.banners enable row level security;
alter table public.announcements enable row level security;
alter table public.advertisements enable row level security;
alter table public.pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.sync_logs enable row level security;
alter table public.playback_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Public catalogue policies.
create policy "Public sports are readable" on public.sports for select to anon, authenticated using (active);
create policy "Public competitions are readable" on public.competitions for select to anon, authenticated using (active);
create policy "Public teams are readable" on public.teams for select to anon, authenticated using (active);
create policy "Public matches are readable" on public.matches for select to anon, authenticated using (true);
create policy "Public approved source attribution is readable" on public.approved_sources for select to anon, authenticated using (active and permission_status = 'approved' and (rights_expiry is null or rights_expiry > now()));
create policy "Public active streams are readable" on public.match_streams for select to anon, authenticated using (status = 'active' and (expires_at is null or expires_at > now()) and ('BD' = any(territory) or 'GLOBAL' = any(territory)));
create policy "Public highlights are readable" on public.highlights for select to anon, authenticated using (active);
create policy "Public banners are readable" on public.banners for select to anon, authenticated using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Public announcements are readable" on public.announcements for select to anon, authenticated using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Public advertisements are readable" on public.advertisements for select to anon, authenticated using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Published pages are readable" on public.pages for select to anon, authenticated using (published);
create policy "Site settings are readable" on public.site_settings for select to anon, authenticated using (true);

-- User-owned data policies; authenticated role alone is never treated as authorization.
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id or (select private.is_admin()));
create policy "Users can update own safe profile fields" on public.profiles for update to authenticated using ((select auth.uid()) = id and role = 'user') with check ((select auth.uid()) = id and role = 'user');
create policy "Users read own favourites" on public.favourites for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own favourites" on public.favourites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own favourites" on public.favourites for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users update own notifications" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Server-verified admin access. All privileged writes still pass RLS.
create policy "Admins manage profiles" on public.profiles for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage sports" on public.sports for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage competitions" on public.competitions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage teams" on public.teams for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage matches" on public.matches for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage approved sources" on public.approved_sources for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage source candidates" on public.source_candidates for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage match streams" on public.match_streams for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage content rights" on public.content_rights for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage highlights" on public.highlights for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage notifications" on public.notifications for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage banners" on public.banners for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage announcements" on public.announcements for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage advertisements" on public.advertisements for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage pages" on public.pages for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage settings" on public.site_settings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins read sync logs" on public.sync_logs for select to authenticated using ((select private.is_admin()));
create policy "Admins read playback logs" on public.playback_logs for select to authenticated using ((select private.is_admin()));
create policy "Admins read audit logs" on public.admin_audit_logs for select to authenticated using ((select private.is_admin()));

grant select on public.sports, public.competitions, public.teams, public.matches, public.approved_sources,
  public.match_streams, public.highlights, public.banners, public.announcements, public.advertisements,
  public.pages, public.site_settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Seed the supported catalogue. Provider IDs remain null until the administrator supplies a contracted API.
insert into public.sports (id, name, slug, icon, position) values
  ('10000000-0000-0000-0000-000000000001', 'Football', 'football', 'football', 1),
  ('10000000-0000-0000-0000-000000000002', 'Cricket', 'cricket', 'cricket', 2),
  ('10000000-0000-0000-0000-000000000003', 'Tennis', 'tennis', 'tennis', 3),
  ('10000000-0000-0000-0000-000000000004', 'Basketball', 'basketball', 'basketball', 4),
  ('10000000-0000-0000-0000-000000000005', 'Motorsports', 'motorsports', 'motorsports', 5),
  ('10000000-0000-0000-0000-000000000006', 'Wrestling', 'wrestling', 'wrestling', 6),
  ('10000000-0000-0000-0000-000000000007', 'Other sports', 'other', 'trophy', 7);

insert into public.competitions (id, sport_id, name, slug, country, featured, position) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Premier League', 'premier-league', 'England', true, 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'La Liga', 'la-liga', 'Spain', true, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Bundesliga', 'bundesliga', 'Germany', true, 3),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Ligue 1', 'ligue-1', 'France', true, 4),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Serie A', 'serie-a', 'Italy', true, 5),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Saudi Pro League', 'saudi-pro-league', 'Saudi Arabia', true, 6),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Major League Soccer', 'mls', 'United States', true, 7),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'International Cricket', 'international-cricket', null, true, 8);

insert into public.teams (id, sport_id, name, short_name, slug, country) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Arsenal','ARS','arsenal','England'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Liverpool','LIV','liverpool','England'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Barcelona','BAR','barcelona','Spain'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Real Madrid','RMA','real-madrid','Spain'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Bayern Munich','BAY','bayern-munich','Germany'),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Borussia Dortmund','BVB','borussia-dortmund','Germany'),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Paris Saint-Germain','PSG','paris-saint-germain','France'),
  ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','Marseille','OM','marseille','France'),
  ('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Inter Milan','INT','inter-milan','Italy'),
  ('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','Juventus','JUV','juventus','Italy'),
  ('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Al Hilal','HIL','al-hilal','Saudi Arabia'),
  ('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','Al Nassr','NAS','al-nassr','Saudi Arabia'),
  ('30000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','Inter Miami','MIA','inter-miami','United States'),
  ('30000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','LA Galaxy','LAG','la-galaxy','United States'),
  ('30000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000002','Bangladesh','BAN','bangladesh-cricket','Bangladesh'),
  ('30000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000002','India','IND','india-cricket','India'),
  ('30000000-0000-0000-0000-000000000103','10000000-0000-0000-0000-000000000002','Pakistan','PAK','pakistan-cricket','Pakistan'),
  ('30000000-0000-0000-0000-000000000104','10000000-0000-0000-0000-000000000002','Sri Lanka','SL','sri-lanka-cricket','Sri Lanka'),
  ('30000000-0000-0000-0000-000000000105','10000000-0000-0000-0000-000000000002','Afghanistan','AFG','afghanistan-cricket','Afghanistan'),
  ('30000000-0000-0000-0000-000000000106','10000000-0000-0000-0000-000000000002','Australia','AUS','australia-cricket','Australia'),
  ('30000000-0000-0000-0000-000000000107','10000000-0000-0000-0000-000000000002','England','ENG','england-cricket','England'),
  ('30000000-0000-0000-0000-000000000108','10000000-0000-0000-0000-000000000002','New Zealand','NZ','new-zealand-cricket','New Zealand'),
  ('30000000-0000-0000-0000-000000000109','10000000-0000-0000-0000-000000000002','South Africa','SA','south-africa-cricket','South Africa'),
  ('30000000-0000-0000-0000-000000000110','10000000-0000-0000-0000-000000000002','West Indies','WI','west-indies-cricket','West Indies'),
  ('30000000-0000-0000-0000-000000000111','10000000-0000-0000-0000-000000000002','Zimbabwe','ZIM','zimbabwe-cricket','Zimbabwe'),
  ('30000000-0000-0000-0000-000000000112','10000000-0000-0000-0000-000000000002','Ireland','IRE','ireland-cricket','Ireland');

insert into public.matches (id, competition_id, home_team_id, away_team_id, slug, starts_at, ends_at, status, home_score, away_score, clock, venue, featured, is_demo) values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004','barcelona-v-real-madrid-demo',now() - interval '40 minutes',now() + interval '80 minutes','live',1,1,'62''','Demo Stadium',true,true),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','liverpool-v-arsenal-demo',now() + interval '5 hours',now() + interval '7 hours','scheduled',null,null,null,'Demo Arena',true,true),
  ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000101','30000000-0000-0000-0000-000000000103','bangladesh-v-pakistan-demo',now() + interval '27 hours',now() + interval '35 hours','scheduled',null,null,null,'Demo Cricket Ground',false,true),
  ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000013','30000000-0000-0000-0000-000000000014','inter-miami-v-la-galaxy-demo',now() + interval '52 hours',now() + interval '54 hours','scheduled',null,null,null,'Demo Field',false,true);

insert into public.site_settings (id, site_name, tagline, default_language, primary_color, footer_text, discovery_threshold, discovery_interval_minutes, ads_enabled)
values (1, 'Live Sports TV', 'Every match. One place. Official sources only.', 'en', '#25d9ff', 'Schedules and streams are provided from approved official sources only.', 82, 10, false);

insert into public.announcements (message_en, message_bn, priority) values
  ('Free access • No subscription • Official and authorized viewing sources only', 'সম্পূর্ণ ফ্রি • কোনো সাবস্ক্রিপশন নেই • শুধুমাত্র অনুমোদিত অফিসিয়াল সোর্স', 100);

insert into public.pages (slug, title_en, title_bn, body_en, body_bn, meta_description) values
  ('about','About Us','আমাদের সম্পর্কে','Live Sports TV helps fans discover schedules, official broadcasts and authorized highlights in one fast, mobile-first experience.','Live Sports TV একটি দ্রুত ও মোবাইল-বান্ধব প্ল্যাটফর্ম, যেখানে খেলার সময়সূচি, অফিসিয়াল সম্প্রচার ও অনুমোদিত হাইলাইট পাওয়া যায়।','About Live Sports TV'),
  ('contact','Contact Us','যোগাযোগ','Use the contact information configured by the site administrator.','সাইট অ্যাডমিনের নির্ধারিত যোগাযোগের মাধ্যমে আমাদের সঙ্গে যোগাযোগ করুন।','Contact Live Sports TV'),
  ('privacy','Privacy Policy','গোপনীয়তা নীতি','We store only the information needed for authentication, favourites and reminders. We do not sell personal data.','লগইন, ফেভারিট ও রিমাইন্ডারের জন্য প্রয়োজনীয় তথ্যই সংরক্ষণ করা হয়।','Live Sports TV privacy policy'),
  ('terms','Terms and Conditions','শর্তাবলি','Use this service lawfully. Availability depends on official providers, territories and rights windows.','আইনসম্মতভাবে সেবা ব্যবহার করুন। সম্প্রচারের প্রাপ্যতা অফিসিয়াল প্রদানকারী, অঞ্চল ও স্বত্বের সময়সীমার ওপর নির্ভরশীল।','Live Sports TV terms'),
  ('copyright','Copyright Policy','কপিরাইট নীতি','Live Sports TV does not restream or rehost protected broadcasts. Sources remain with their respective rights holders.','Live Sports TV কোনো সুরক্ষিত সম্প্রচার পুনঃসম্প্রচার বা হোস্ট করে না।','Live Sports TV copyright policy'),
  ('dmca','DMCA / Content Removal','কনটেন্ট অপসারণ নীতি','Rights holders may submit a complete removal request identifying the content, ownership and source URL.','স্বত্বাধিকারীরা কনটেন্ট, মালিকানা ও সোর্স URL উল্লেখ করে অপসারণের অনুরোধ জানাতে পারেন।','Live Sports TV content removal policy');

-- Add the tables that benefit from Realtime. Existing publication membership is checked first.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_streams') then
    alter publication supabase_realtime add table public.match_streams;
  end if;
end $$;
