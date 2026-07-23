-- Epic 3–4: tip lock, tip visibility after kickoff, demo seed, owner result set

-- ── Tip lock trigger ───────────────────────────────────────────────────────
create or replace function public.enforce_tip_before_kickoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ko timestamptz;
begin
  select kickoff_at into ko from public.matches where id = new.match_id;
  if ko is not null and ko <= now() then
    raise exception 'Tips are locked after kickoff';
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'Cannot tip for another user';
  end if;
  return new;
end;
$$;

drop trigger if exists tips_lock_before_write on public.tips;
create trigger tips_lock_before_write
  before insert or update on public.tips
  for each row execute function public.enforce_tip_before_kickoff();

-- Replace tips RLS: own tips always; others only after kickoff for league mates
drop policy if exists "tips_own_rw" on public.tips;

create policy "tips_select_own_or_after_kickoff"
  on public.tips for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      join public.league_members lm on lm.league_id = t.league_id
      where m.id = tips.match_id
        and lm.user_id = auth.uid()
        and m.kickoff_at is not null
        and m.kickoff_at <= now()
    )
  );

create policy "tips_insert_own"
  on public.tips for insert to authenticated
  with check (user_id = auth.uid());

create policy "tips_update_own"
  on public.tips for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tips_delete_own"
  on public.tips for delete to authenticated
  using (user_id = auth.uid());

-- Members can insert matches only via seed RPC; owners can update results
drop policy if exists "matches_member_select" on public.matches;

create policy "matches_member_select"
  on public.matches for select to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      join public.league_members m on m.league_id = t.league_id
      where t.id = matches.tournament_id and m.user_id = auth.uid()
    )
  );

create policy "matches_owner_update"
  on public.matches for update to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      join public.leagues l on l.id = t.league_id
      where t.id = matches.tournament_id and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments t
      join public.leagues l on l.id = t.league_id
      where t.id = matches.tournament_id and l.owner_id = auth.uid()
    )
  );

-- ── Seed demo tournament ───────────────────────────────────────────────────
create or replace function public.seed_demo_tournament(p_league_id uuid)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  league public.leagues;
  tourney public.tournaments;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into league from public.leagues where id = p_league_id;
  if league.id is null then
    raise exception 'League not found';
  end if;
  if league.owner_id is distinct from uid then
    raise exception 'Only the league owner can seed the demo tournament';
  end if;

  select * into tourney
  from public.tournaments
  where league_id = p_league_id and name = 'Demo Cup'
  limit 1;

  if tourney.id is null then
    insert into public.tournaments (league_id, name)
    values (p_league_id, 'Demo Cup')
    returning * into tourney;
  else
    -- reset matches for a clean demo
    delete from public.tips where match_id in (
      select id from public.matches where tournament_id = tourney.id
    );
    delete from public.matches where tournament_id = tourney.id;
  end if;

  insert into public.matches (tournament_id, home_team, away_team, kickoff_at, home_goals, away_goals, status)
  values
    (tourney.id, 'Germany', 'France', now() - interval '3 days', 2, 1, 'finished'),
    (tourney.id, 'Spain', 'Italy', now() - interval '2 days', 1, 1, 'finished'),
    (tourney.id, 'Brazil', 'Argentina', now() - interval '1 day', 0, 2, 'finished'),
    (tourney.id, 'England', 'Portugal', now() - interval '40 minutes', null, null, 'live'),
    (tourney.id, 'Netherlands', 'Belgium', now() + interval '1 day', null, null, 'scheduled'),
    (tourney.id, 'Japan', 'Mexico', now() + interval '2 days', null, null, 'scheduled'),
    (tourney.id, 'USA', 'Canada', now() + interval '3 days', null, null, 'scheduled'),
    (tourney.id, 'Morocco', 'Croatia', now() + interval '4 days', null, null, 'scheduled');

  return tourney;
end;
$$;

create or replace function public.set_match_result(
  p_match_id uuid,
  p_home_goals int,
  p_away_goals int
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m public.matches;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_home_goals < 0 or p_away_goals < 0 then
    raise exception 'Goals must be >= 0';
  end if;

  select matches.* into m
  from public.matches
  join public.tournaments t on t.id = matches.tournament_id
  join public.leagues l on l.id = t.league_id
  where matches.id = p_match_id and l.owner_id = uid;

  if m.id is null then
    raise exception 'Match not found or not owner';
  end if;

  update public.matches
  set home_goals = p_home_goals,
      away_goals = p_away_goals,
      status = 'finished'
  where id = p_match_id
  returning * into m;

  return m;
end;
$$;

create or replace function public.upsert_tip(
  p_match_id uuid,
  p_home_goals int,
  p_away_goals int
)
returns public.tips
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tip public.tips;
  ko timestamptz;
  league_ok boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_home_goals < 0 or p_away_goals < 0 then
    raise exception 'Goals must be >= 0';
  end if;

  select m.kickoff_at,
    exists (
      select 1
      from public.tournaments t
      join public.league_members lm on lm.league_id = t.league_id
      where t.id = m.tournament_id and lm.user_id = uid
    )
  into ko, league_ok
  from public.matches m
  where m.id = p_match_id;

  if ko is null and league_ok is null then
    raise exception 'Match not found';
  end if;
  -- league_ok is boolean; if match missing, SELECT INTO leaves both null
  if not exists (select 1 from public.matches where id = p_match_id) then
    raise exception 'Match not found';
  end if;
  if not league_ok then
    raise exception 'Not a league member';
  end if;
  if ko is not null and ko <= now() then
    raise exception 'Tips are locked after kickoff';
  end if;

  perform public.ensure_profile(null);

  insert into public.tips (match_id, user_id, home_goals, away_goals)
  values (p_match_id, uid, p_home_goals, p_away_goals)
  on conflict (match_id, user_id) do update
    set home_goals = excluded.home_goals,
        away_goals = excluded.away_goals
  returning * into tip;

  return tip;
end;
$$;

grant execute on function public.seed_demo_tournament(uuid) to authenticated;
grant execute on function public.set_match_result(uuid, int, int) to authenticated;
grant execute on function public.upsert_tip(uuid, int, int) to authenticated;
