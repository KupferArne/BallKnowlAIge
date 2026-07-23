-- Epic 6: stub AI agents + tips (no OpenRouter)
-- Epic 7: leave / kick / rename / delete league

create table if not exists public.ai_tips (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  ai_agent_id uuid not null references public.ai_agents (id) on delete cascade,
  home_goals int not null,
  away_goals int not null,
  created_at timestamptz not null default now(),
  unique (match_id, ai_agent_id)
);

alter table public.ai_tips enable row level security;

drop policy if exists "ai_tips_member_select" on public.ai_tips;
create policy "ai_tips_member_select"
  on public.ai_tips for select to authenticated
  using (
    exists (
      select 1
      from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      join public.league_members lm on lm.league_id = t.league_id
      where m.id = ai_tips.match_id and lm.user_id = auth.uid()
    )
  );

drop policy if exists "ai_agents_member_select" on public.ai_agents;
create policy "ai_agents_member_select"
  on public.ai_agents for select to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = ai_agents.league_id and m.user_id = auth.uid()
    )
  );

grant select on public.ai_tips to authenticated;

-- Deterministic stub score from agent+match ids (no API cost)
create or replace function public.stub_ai_score(p_agent_id uuid, p_match_id uuid)
returns int[]
language plpgsql
immutable
as $$
declare
  h int;
  n int := (('x' || substr(md5(p_agent_id::text || p_match_id::text), 1, 8))::bit(32)::int);
begin
  h := abs(n);
  -- patterns: 2-1, 1-0, 1-1, 0-1, 2-2, 3-1
  case (h % 6)
    when 0 then return array[2,1];
    when 1 then return array[1,0];
    when 2 then return array[1,1];
    when 3 then return array[0,1];
    when 4 then return array[2,2];
    else return array[3,1];
  end case;
end;
$$;

create or replace function public.generate_stub_ai_tips(p_league_id uuid, p_agent_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  agent record;
  m record;
  sc int[];
  written int := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = uid
  ) then
    raise exception 'Not a league member';
  end if;

  for agent in
    select * from public.ai_agents
    where league_id = p_league_id
      and provider = 'stub'
      and (p_agent_id is null or id = p_agent_id)
  loop
    for m in
      select matches.*
      from public.matches
      join public.tournaments t on t.id = matches.tournament_id
      where t.league_id = p_league_id
    loop
      sc := public.stub_ai_score(agent.id, m.id);
      insert into public.ai_tips (match_id, ai_agent_id, home_goals, away_goals)
      values (m.id, agent.id, sc[1], sc[2])
      on conflict (match_id, ai_agent_id) do update
        set home_goals = excluded.home_goals,
            away_goals = excluded.away_goals;
      written := written + 1;
    end loop;
  end loop;

  return written;
end;
$$;

create or replace function public.add_stub_ai_agent(p_league_id uuid, p_name text default 'Stub AI')
returns public.ai_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  agent public.ai_agents;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.leagues where id = p_league_id and owner_id = uid
  ) then
    raise exception 'Only the league owner can add AI agents';
  end if;

  insert into public.ai_agents (league_id, name, provider)
  values (p_league_id, coalesce(nullif(trim(p_name), ''), 'Stub AI'), 'stub')
  returning * into agent;

  perform public.generate_stub_ai_tips(p_league_id, agent.id);
  return agent;
end;
$$;

create or replace function public.remove_ai_agent(p_agent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select league_id into lid from public.ai_agents where id = p_agent_id;
  if lid is null then raise exception 'AI agent not found'; end if;
  if not exists (select 1 from public.leagues where id = lid and owner_id = uid) then
    raise exception 'Only the league owner can remove AI agents';
  end if;
  delete from public.ai_agents where id = p_agent_id;
end;
$$;

create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.leagues where id = p_league_id and owner_id = uid) then
    raise exception 'Owners cannot leave — delete the league or transfer ownership first';
  end if;
  delete from public.league_members
  where league_id = p_league_id and user_id = uid;
end;
$$;

create or replace function public.kick_member(p_league_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id and owner_id = uid) then
    raise exception 'Only the owner can kick members';
  end if;
  if p_user_id = uid then
    raise exception 'Cannot kick yourself';
  end if;
  delete from public.league_members
  where league_id = p_league_id and user_id = p_user_id;
  delete from public.tips
  where user_id = p_user_id
    and match_id in (
      select m.id from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      where t.league_id = p_league_id
    );
end;
$$;

create or replace function public.rename_league(p_league_id uuid, p_name text)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  league public.leagues;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name required'; end if;
  update public.leagues
  set name = trim(p_name)
  where id = p_league_id and owner_id = uid
  returning * into league;
  if league.id is null then raise exception 'League not found or not owner'; end if;
  return league;
end;
$$;

create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.leagues where id = p_league_id and owner_id = uid;
  if not found then
    raise exception 'League not found or not owner';
  end if;
end;
$$;

-- Extend play bundle with AI members + tips
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
  order by case when t.name = 'Demo Cup' then 0 else 1 end, t.created_at
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
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.add_stub_ai_agent(uuid, text) to authenticated;
grant execute on function public.remove_ai_agent(uuid) to authenticated;
grant execute on function public.generate_stub_ai_tips(uuid, uuid) to authenticated;
grant execute on function public.leave_league(uuid) to authenticated;
grant execute on function public.kick_member(uuid, uuid) to authenticated;
grant execute on function public.rename_league(uuid, text) to authenticated;
grant execute on function public.delete_league(uuid) to authenticated;
