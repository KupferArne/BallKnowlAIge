-- Team crest / flag URLs on matches (from sync or client resolve)

alter table public.matches
  add column if not exists home_crest_url text,
  add column if not exists away_crest_url text;

create or replace function public.apply_fixture_sync(
  p_league_id uuid,
  p_matches jsonb,
  p_sync_source text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tourney public.tournaments;
  item jsonb;
  upserted int := 0;
  ext text;
  home text;
  away text;
  kick timestamptz;
  hg int;
  ag int;
  st text;
  home_crest text;
  away_crest text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.leagues where id = p_league_id and owner_id = uid
  ) then
    raise exception 'Only the league owner can sync fixtures';
  end if;

  select * into tourney
  from public.tournaments
  where league_id = p_league_id
  order by created_at
  limit 1;

  if tourney.id is null then
    raise exception 'Create a tournament before syncing fixtures';
  end if;

  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'p_matches must be a JSON array';
  end if;

  for item in select * from jsonb_array_elements(p_matches)
  loop
    ext := nullif(trim(coalesce(item->>'external_id', '')), '');
    home := nullif(trim(coalesce(item->>'home_team', '')), '');
    away := nullif(trim(coalesce(item->>'away_team', '')), '');
    if ext is null or home is null or away is null then
      continue;
    end if;

    kick := null;
    begin
      kick := (item->>'kickoff_at')::timestamptz;
    exception when others then
      kick := null;
    end;

    hg := null;
    ag := null;
    if item ? 'home_goals' and item->>'home_goals' is not null and item->>'home_goals' <> '' then
      hg := (item->>'home_goals')::int;
    end if;
    if item ? 'away_goals' and item->>'away_goals' is not null and item->>'away_goals' <> '' then
      ag := (item->>'away_goals')::int;
    end if;

    st := lower(coalesce(item->>'status', 'scheduled'));
    if st not in ('scheduled', 'live', 'finished') then
      st := 'scheduled';
    end if;
    if hg is not null and ag is not null then
      st := 'finished';
    end if;

    home_crest := nullif(trim(coalesce(item->>'home_crest_url', '')), '');
    away_crest := nullif(trim(coalesce(item->>'away_crest_url', '')), '');

    insert into public.matches (
      tournament_id, external_id, home_team, away_team,
      kickoff_at, home_goals, away_goals, status,
      home_crest_url, away_crest_url
    )
    values (
      tourney.id, ext, home, away, kick, hg, ag, st,
      home_crest, away_crest
    )
    on conflict (tournament_id, external_id)
    do update set
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      kickoff_at = coalesce(excluded.kickoff_at, matches.kickoff_at),
      home_goals = case
        when excluded.status = 'finished' then excluded.home_goals
        else matches.home_goals
      end,
      away_goals = case
        when excluded.status = 'finished' then excluded.away_goals
        else matches.away_goals
      end,
      status = case
        when excluded.status = 'finished' then 'finished'
        when matches.status = 'finished' then 'finished'
        else excluded.status
      end,
      home_crest_url = coalesce(excluded.home_crest_url, matches.home_crest_url),
      away_crest_url = coalesce(excluded.away_crest_url, matches.away_crest_url);

    upserted := upserted + 1;
  end loop;

  if upserted > 0 then
    delete from public.tips
    where match_id in (
      select id from public.matches
      where tournament_id = tourney.id and external_id is null
    );
    delete from public.matches
    where tournament_id = tourney.id and external_id is null;
  end if;

  update public.tournaments
  set last_synced_at = now(),
      sync_source = nullif(trim(coalesce(p_sync_source, '')), '')
  where id = tourney.id;

  return jsonb_build_object(
    'upserted', upserted,
    'source', coalesce(p_sync_source, 'unknown'),
    'tournament_id', tourney.id
  );
end;
$$;

grant execute on function public.apply_fixture_sync(uuid, jsonb, text) to authenticated;
