-- Auto-approved discoveries arrive as INSERTs; manual approvals arrive as UPDATEs.
-- Both paths must promote a validated candidate into match_streams atomically.

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
  if new.review_status = 'approved'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'approved') then
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
      least(
        coalesce(source_row.rights_expiry, 'infinity'::timestamptz),
        coalesce(match_row.ends_at + interval '2 hours', match_row.starts_at + interval '8 hours')
      ),
      'active', 100
    )
    on conflict (match_id, approved_source_id, provider_asset_id)
    do update set embed_url = excluded.embed_url, source_page_url = excluded.source_page_url,
      territory = excluded.territory, expires_at = excluded.expires_at,
      status = 'active', updated_at = now();
    new.reviewed_by := coalesce(new.reviewed_by, (select auth.uid()));
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  return new;
end;
$$;

create trigger promote_source_candidate_insert
before insert on public.source_candidates
for each row execute function private.promote_approved_candidate();
