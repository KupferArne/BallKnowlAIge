-- Robust league data loader (avoids client-side RLS join edge cases)

create or replace function public.get_league_play_data(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
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

  select jsonb_build_object(
    'tournament', (
      select to_jsonb(t)
      from public.tournaments t
      where t.league_id = p_league_id
      order by case when t.name = 'Demo Cup' then 0 else 1 end, t.created_at
      limit 1
    ),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.kickoff_at nulls last)
      from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      where t.league_id = p_league_id
        and t.id = (
          select t2.id from public.tournaments t2
          where t2.league_id = p_league_id
          order by case when t2.name = 'Demo Cup' then 0 else 1 end, t2.created_at
          limit 1
        )
    ), '[]'::jsonb),
    'tips', coalesce((
      select jsonb_agg(to_jsonb(tip))
      from public.tips tip
      where tip.match_id in (
        select m.id
        from public.matches m
        join public.tournaments t on t.id = m.tournament_id
        where t.league_id = p_league_id
      )
      and (
        tip.user_id = uid
        or exists (
          select 1 from public.matches m2
          where m2.id = tip.match_id
            and m2.kickoff_at is not null
            and m2.kickoff_at <= now()
        )
      )
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', lm.user_id,
          'role', lm.role,
          'display_name', coalesce(nullif(p.display_name, ''), 'Player')
        )
      )
      from public.league_members lm
      left join public.profiles p on p.id = lm.user_id
      where lm.league_id = p_league_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_league_play_data(uuid) to authenticated;

-- Make seed more resilient: use auth.uid() and clearer errors
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
