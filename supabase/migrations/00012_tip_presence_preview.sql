-- Tip presence before kickoff: return tip rows for others with scores masked (null),
-- so the leaderboard can show "-:-" for tipped-but-hidden picks.

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
        -- Human tips: always include membership tips; mask scores until kickoff
        select jsonb_build_object(
          'id', tip.id,
          'match_id', tip.match_id,
          'user_id', tip.user_id,
          'home_goals', case
            when tip.user_id = uid then tip.home_goals
            when m.kickoff_at is not null and m.kickoff_at <= now() then tip.home_goals
            else null
          end,
          'away_goals', case
            when tip.user_id = uid then tip.away_goals
            when m.kickoff_at is not null and m.kickoff_at <= now() then tip.away_goals
            else null
          end,
          'revealed', (
            tip.user_id = uid
            or (m.kickoff_at is not null and m.kickoff_at <= now())
          ),
          'kind', 'human'
        ) as tip
        from public.tips tip
        join public.matches m on m.id = tip.match_id
        where m.tournament_id = tourney_id

        union all

        -- AI tips: visible as presence before kickoff; scores after kickoff
        select jsonb_build_object(
          'id', at.id,
          'match_id', at.match_id,
          'user_id', 'ai:' || at.ai_agent_id::text,
          'home_goals', case
            when m.kickoff_at is not null and m.kickoff_at <= now() then at.home_goals
            else null
          end,
          'away_goals', case
            when m.kickoff_at is not null and m.kickoff_at <= now() then at.away_goals
            else null
          end,
          'revealed', (m.kickoff_at is not null and m.kickoff_at <= now()),
          'kind', 'ai'
        ) as tip
        from public.ai_tips at
        join public.matches m on m.id = at.match_id
        where m.tournament_id = tourney_id
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

grant execute on function public.get_league_play_data(uuid) to authenticated;
