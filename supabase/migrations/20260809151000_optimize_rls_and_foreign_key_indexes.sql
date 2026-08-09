-- Follow-up hardening after Supabase security and performance advisor review.

-- Cover foreign keys used by deletes, joins and admin filters.
create index competitions_sport_id_idx on public.competitions(sport_id);
create index teams_sport_id_idx on public.teams(sport_id);
create index source_candidates_approved_source_id_idx on public.source_candidates(approved_source_id);
create index source_candidates_reviewed_by_idx on public.source_candidates(reviewed_by);
create index match_streams_approved_source_id_idx on public.match_streams(approved_source_id);
create index content_rights_competition_id_idx on public.content_rights(competition_id);
create index highlights_match_id_idx on public.highlights(match_id);
create index highlights_approved_source_id_idx on public.highlights(approved_source_id);
create index favourites_match_id_idx on public.favourites(match_id);
create index favourites_team_id_idx on public.favourites(team_id);
create index notifications_match_id_idx on public.notifications(match_id);
create index playback_logs_match_stream_id_idx on public.playback_logs(match_stream_id);
create index playback_logs_user_id_idx on public.playback_logs(user_id);
create index admin_audit_logs_admin_id_idx on public.admin_audit_logs(admin_id);

-- Keep anonymous and authenticated reads separate so PostgreSQL evaluates only one
-- permissive SELECT policy per role. Authenticated admins may also see inactive rows.
drop policy "Public sports are readable" on public.sports;
create policy "Public sports are readable" on public.sports for select to anon using (active);
create policy "Authenticated sports are readable" on public.sports for select to authenticated using (active or (select private.is_admin()));

drop policy "Public competitions are readable" on public.competitions;
create policy "Public competitions are readable" on public.competitions for select to anon using (active);
create policy "Authenticated competitions are readable" on public.competitions for select to authenticated using (active or (select private.is_admin()));

drop policy "Public teams are readable" on public.teams;
create policy "Public teams are readable" on public.teams for select to anon using (active);
create policy "Authenticated teams are readable" on public.teams for select to authenticated using (active or (select private.is_admin()));

drop policy "Public matches are readable" on public.matches;
create policy "Public matches are readable" on public.matches for select to anon using (true);
create policy "Authenticated matches are readable" on public.matches for select to authenticated using (true);

drop policy "Public approved source attribution is readable" on public.approved_sources;
create policy "Public approved source attribution is readable" on public.approved_sources for select to anon
  using (active and permission_status = 'approved' and (rights_expiry is null or rights_expiry > now()));
create policy "Authenticated approved sources are readable" on public.approved_sources for select to authenticated
  using ((active and permission_status = 'approved' and (rights_expiry is null or rights_expiry > now())) or (select private.is_admin()));

drop policy "Public active streams are readable" on public.match_streams;
create policy "Public active streams are readable" on public.match_streams for select to anon
  using (status = 'active' and (expires_at is null or expires_at > now()) and ('BD' = any(territory) or 'GLOBAL' = any(territory)));
create policy "Authenticated streams are readable" on public.match_streams for select to authenticated
  using ((status = 'active' and (expires_at is null or expires_at > now()) and ('BD' = any(territory) or 'GLOBAL' = any(territory))) or (select private.is_admin()));

drop policy "Public highlights are readable" on public.highlights;
create policy "Public highlights are readable" on public.highlights for select to anon using (active);
create policy "Authenticated highlights are readable" on public.highlights for select to authenticated using (active or (select private.is_admin()));

drop policy "Public banners are readable" on public.banners;
create policy "Public banners are readable" on public.banners for select to anon using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Authenticated banners are readable" on public.banners for select to authenticated using ((active and starts_at <= now() and (ends_at is null or ends_at >= now())) or (select private.is_admin()));

drop policy "Public announcements are readable" on public.announcements;
create policy "Public announcements are readable" on public.announcements for select to anon using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Authenticated announcements are readable" on public.announcements for select to authenticated using ((active and starts_at <= now() and (ends_at is null or ends_at >= now())) or (select private.is_admin()));

drop policy "Public advertisements are readable" on public.advertisements;
create policy "Public advertisements are readable" on public.advertisements for select to anon using (active and starts_at <= now() and (ends_at is null or ends_at >= now()));
create policy "Authenticated advertisements are readable" on public.advertisements for select to authenticated using ((active and starts_at <= now() and (ends_at is null or ends_at >= now())) or (select private.is_admin()));

drop policy "Published pages are readable" on public.pages;
create policy "Published pages are readable" on public.pages for select to anon using (published);
create policy "Authenticated pages are readable" on public.pages for select to authenticated using (published or (select private.is_admin()));

drop policy "Site settings are readable" on public.site_settings;
create policy "Site settings are readable" on public.site_settings for select to anon using (true);
create policy "Authenticated settings are readable" on public.site_settings for select to authenticated using (true);

-- Replace SELECT-overlapping ALL policies with write-only admin policies.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('sports', 'sports'),
      ('competitions', 'competitions'),
      ('teams', 'teams'),
      ('matches', 'matches'),
      ('approved_sources', 'approved sources'),
      ('match_streams', 'match streams'),
      ('highlights', 'highlights'),
      ('banners', 'banners'),
      ('announcements', 'announcements'),
      ('advertisements', 'advertisements'),
      ('pages', 'pages'),
      ('site_settings', 'settings')
    ) as policies(table_name, old_label)
  loop
    execute format('drop policy if exists %I on public.%I', 'Admins manage ' || item.old_label, item.table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', 'Admins insert ' || item.table_name, item.table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', 'Admins update ' || item.table_name, item.table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', 'Admins delete ' || item.table_name, item.table_name);
  end loop;
end $$;

-- Merge user-owned and administrator policies for profiles and notifications.
drop policy "Users can read own profile" on public.profiles;
drop policy "Users can update own safe profile fields" on public.profiles;
drop policy "Admins manage profiles" on public.profiles;
create policy "Users or admins read profiles" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
create policy "Users or admins update profiles" on public.profiles for update to authenticated
  using (((select auth.uid()) = id and role = 'user') or (select private.is_admin()))
  with check (((select auth.uid()) = id and role = 'user') or (select private.is_admin()));
create policy "Admins insert profiles" on public.profiles for insert to authenticated with check ((select private.is_admin()));
create policy "Admins delete profiles" on public.profiles for delete to authenticated using ((select private.is_admin()));

drop policy "Users read own notifications" on public.notifications;
drop policy "Users update own notifications" on public.notifications;
drop policy "Admins manage notifications" on public.notifications;
create policy "Users or admins read notifications" on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy "Users or admins update notifications" on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()))
  with check ((select auth.uid()) = user_id or (select private.is_admin()));
create policy "Admins insert notifications" on public.notifications for insert to authenticated with check ((select private.is_admin()));
create policy "Admins delete notifications" on public.notifications for delete to authenticated using ((select private.is_admin()));
