-- Record authenticated administrator mutations without logging background service jobs.

create or replace function private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  entity_key text;
begin
  if actor is null or not private.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  entity_key := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  insert into public.admin_audit_logs (
    admin_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor,
    lower(tg_op),
    tg_table_name,
    entity_key,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_admin_change() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','sports','competitions','teams','matches','approved_sources','source_candidates',
    'match_streams','content_rights','highlights','notifications','banners','announcements',
    'advertisements','pages','site_settings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_admin_change()',
      'audit_' || table_name || '_admin_change',
      table_name
    );
  end loop;
end $$;
