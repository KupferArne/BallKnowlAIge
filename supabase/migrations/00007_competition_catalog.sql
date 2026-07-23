-- Epic 9: competition identity on tournaments + create_tournament RPC

alter table public.tournaments
  add column if not exists competition_id text,
  add column if not exists competition_name text,
  add column if not exists season text;

comment on column public.tournaments.competition_id is
  'Stable catalog id from the app (e.g. fifa-wc-men, bundesliga-men, custom).';
comment on column public.tournaments.competition_name is
  'Display name at create time (catalog label or custom).';
comment on column public.tournaments.season is
  'Optional edition / season label (2026, 2025/26).';

-- Backfill existing Demo Cup rows
update public.tournaments
set
  competition_id = coalesce(competition_id, 'demo-cup'),
  competition_name = coalesce(competition_name, name)
where competition_id is null;

create or replace function public.create_tournament(
  p_league_id uuid,
  p_competition_id text,
  p_competition_name text,
  p_season text default null,
  p_seed_demo boolean default false
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  league public.leagues;
  tourney public.tournaments;
  comp_id text := lower(trim(coalesce(p_competition_id, '')));
  comp_name text := trim(coalesce(p_competition_name, ''));
  season_txt text := nullif(trim(coalesce(p_season, '')), '');
  display_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if comp_id = '' then raise exception 'Competition is required'; end if;
  if comp_name = '' then raise exception 'Competition name is required'; end if;

  select * into league from public.leagues where id = p_league_id;
  if league.id is null then raise exception 'League not found'; end if;
  if league.owner_id is distinct from uid then
    raise exception 'Only the league owner can create a tournament';
  end if;

  display_name := case
    when season_txt is null then comp_name
    else comp_name || ' · ' || season_txt
  end;

  select * into tourney
  from public.tournaments
  where league_id = p_league_id
  order by created_at
  limit 1;

  if tourney.id is null then
    insert into public.tournaments (
      league_id, name, competition_id, competition_name, season
    )
    values (p_league_id, display_name, comp_id, comp_name, season_txt)
    returning * into tourney;
  else
    update public.tournaments
    set
      name = display_name,
      competition_id = comp_id,
      competition_name = comp_name,
      season = season_txt
    where id = tourney.id
    returning * into tourney;
  end if;

  if p_seed_demo then
    delete from public.tips where match_id in (
      select id from public.matches where tournament_id = tourney.id
    );
    delete from public.matches where tournament_id = tourney.id;

    insert into public.matches (
      tournament_id, home_team, away_team, kickoff_at, home_goals, away_goals, status
    )
    values
      (tourney.id, 'Germany', 'France', now() - interval '3 days', 2, 1, 'finished'),
      (tourney.id, 'Spain', 'Italy', now() - interval '2 days', 1, 1, 'finished'),
      (tourney.id, 'Brazil', 'Argentina', now() - interval '1 day', 0, 2, 'finished'),
      (tourney.id, 'England', 'Portugal', now() - interval '40 minutes', null, null, 'live'),
      (tourney.id, 'Netherlands', 'Belgium', now() + interval '1 day', null, null, 'scheduled'),
      (tourney.id, 'Japan', 'Mexico', now() + interval '2 days', null, null, 'scheduled'),
      (tourney.id, 'USA', 'Canada', now() + interval '3 days', null, null, 'scheduled'),
      (tourney.id, 'Morocco', 'Croatia', now() + interval '4 days', null, null, 'scheduled');
  end if;

  return tourney;
end;
$$;

-- Keep legacy RPC: demo seed under Demo Cup competition
create or replace function public.seed_demo_tournament(p_league_id uuid)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_tournament(
    p_league_id,
    'demo-cup',
    'Demo Cup',
    null,
    true
  );
end;
$$;

-- Prefer newest tournament; stop special-casing Demo Cup name
create or replace function public.get_league_play_data(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
  tourney_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = uid
  ) then
    raise exception 'Not a league member';
  end if;

  select t.id into tourney_id
  from public.tournaments t
  where t.league_id = p_league_id
  order by t.created_at
  limit 1;

  select jsonb_build_object(
    'tournament', (
      select to_jsonb(t) from public.tournaments t where t.id = tourney_id
    ),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.kickoff_at nulls last)
      from public.matches m
      where m.tournament_id = tourney_id
    ), '[]'::jsonb),
    'tips', coalesce((
      select jsonb_agg(x.tip)
      from (
        select to_jsonb(tip) || jsonb_build_object('kind', 'human') as tip
        from public.tips tip
        where tip.match_id in (select id from public.matches where tournament_id = tourney_id)
          and (
            tip.user_id = uid
            or exists (
              select 1 from public.matches m2
              where m2.id = tip.match_id
                and m2.kickoff_at is not null
                and m2.kickoff_at <= now()
            )
          )
        union all
        select jsonb_build_object(
          'id', at.id,
          'match_id', at.match_id,
          'user_id', 'ai:' || at.ai_agent_id::text,
          'home_goals', at.home_goals,
          'away_goals', at.away_goals,
          'kind', 'ai'
        )
        from public.ai_tips at
        where at.match_id in (select id from public.matches where tournament_id = tourney_id)
          and (
            exists (
              select 1 from public.matches m3
              where m3.id = at.match_id
                and m3.kickoff_at is not null
                and m3.kickoff_at <= now()
            )
            or exists (
              select 1 from public.leagues l where l.id = p_league_id and l.owner_id = uid
            )
          )
      ) x
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(m order by m.sort_key, m.display_name)
      from (
        select
          lm.user_id::text as user_id,
          lm.role,
          coalesce(nullif(p.display_name, ''), 'Player') as display_name,
          'human'::text as kind,
          0 as sort_key
        from public.league_members lm
        left join public.profiles p on p.id = lm.user_id
        where lm.league_id = p_league_id
        union all
        select
          'ai:' || a.id::text,
          'ai',
          a.name || ' 🤖',
          'ai',
          1
        from public.ai_agents a
        where a.league_id = p_league_id
      ) m
    ), '[]'::jsonb),
    'ai_agents', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.ai_agents a
      where a.league_id = p_league_id
    ), '[]'::jsonb),
    'bonus_questions', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.sort_order, q.created_at)
      from public.bonus_questions q
      where q.league_id = p_league_id
    ), '[]'::jsonb),
    'bonus_answers', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.bonus_answers a
      join public.bonus_questions q on q.id = a.question_id
      where q.league_id = p_league_id
        and (
          a.user_id = uid
          or q.status = 'scored'
          or (q.deadline_at is not null and q.deadline_at <= now())
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.create_tournament(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.seed_demo_tournament(uuid) to authenticated;
