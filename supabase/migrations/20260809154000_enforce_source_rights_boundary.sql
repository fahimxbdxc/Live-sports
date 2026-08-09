-- Make source permission metadata mandatory and enforce the provider-domain allowlist
-- for source pages, candidates, streams and highlights.

alter table public.approved_sources alter column permission_reference set not null;
alter table public.approved_sources alter column rights_expiry set not null;
alter table public.highlights alter column approved_source_id set not null;

create or replace function private.url_matches_domain(candidate_url text, approved_domain text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  candidate_host text;
  normalized_domain text;
begin
  if candidate_url is null or approved_domain is null then
    return false;
  end if;
  candidate_host := lower(split_part(split_part(split_part(candidate_url, '://', 2), '/', 1), ':', 1));
  normalized_domain := regexp_replace(lower(approved_domain), '^www\.', '');
  if normalized_domain in ('youtube.com', 'youtu.be') then
    return candidate_host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com');
  end if;
  return candidate_host = approved_domain or candidate_host = normalized_domain
    or candidate_host like '%.' || normalized_domain;
end;
$$;
revoke all on function private.url_matches_domain(text, text) from public, anon, authenticated;

create or replace function private.validate_approved_source_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.url_matches_domain(new.source_page_url, new.provider_domain) then
    raise exception 'Original source page is outside the approved provider domain';
  end if;
  if new.rights_expiry <= now() then
    raise exception 'Source rights expiry must be in the future';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_approved_source_domain() from public, anon, authenticated;

create trigger validate_approved_source_domain
before insert or update of provider_domain, source_page_url, rights_expiry on public.approved_sources
for each row execute function private.validate_approved_source_domain();

create or replace function private.validate_stream_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.approved_sources%rowtype;
begin
  select * into source_row from public.approved_sources where id = new.approved_source_id;
  if not found or not source_row.active or source_row.permission_status <> 'approved' then
    raise exception 'Source is not active and approved';
  end if;
  if source_row.rights_expiry <= now() then
    raise exception 'Source rights have expired';
  end if;
  if not ('BD' = any(source_row.territory) or 'GLOBAL' = any(source_row.territory)) then
    raise exception 'Source does not permit Bangladesh territory';
  end if;
  if not private.url_matches_domain(new.source_page_url, source_row.provider_domain) then
    raise exception 'Original source page is outside the approved provider domain';
  end if;
  if new.embed_url is not null then
    if not private.url_matches_domain(new.embed_url, source_row.provider_domain) then
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

create or replace function private.validate_highlight_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.approved_sources%rowtype;
begin
  select * into source_row from public.approved_sources where id = new.approved_source_id;
  if not found or not source_row.active or source_row.permission_status <> 'approved'
     or source_row.rights_expiry <= now() then
    raise exception 'Highlight source is not currently authorized';
  end if;
  if not private.url_matches_domain(new.video_url, source_row.provider_domain) then
    raise exception 'Highlight URL is outside the approved provider domain';
  end if;
  new.provider_name := source_row.provider_name;
  return new;
end;
$$;
revoke all on function private.validate_highlight_source() from public, anon, authenticated;

create trigger validate_highlight_source
before insert or update of approved_source_id, video_url on public.highlights
for each row execute function private.validate_highlight_source();

-- Disabling or expiring a provider must hide all of its streams immediately.
drop policy "Public active streams are readable" on public.match_streams;
create policy "Public active streams are readable" on public.match_streams for select to anon
  using (
    status = 'active'
    and (expires_at is null or expires_at > now())
    and ('BD' = any(territory) or 'GLOBAL' = any(territory))
    and exists (
      select 1 from public.approved_sources source
      where source.id = approved_source_id
        and source.active
        and source.permission_status = 'approved'
        and source.rights_expiry > now()
    )
  );

drop policy "Authenticated streams are readable" on public.match_streams;
create policy "Authenticated streams are readable" on public.match_streams for select to authenticated
  using (
    (status = 'active'
      and (expires_at is null or expires_at > now())
      and ('BD' = any(territory) or 'GLOBAL' = any(territory))
      and exists (
        select 1 from public.approved_sources source
        where source.id = approved_source_id
          and source.active
          and source.permission_status = 'approved'
          and source.rights_expiry > now()
      ))
    or (select private.is_admin())
  );
