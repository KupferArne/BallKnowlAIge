-- Epic 1 + 2: multi-tenant leagues, RLS, invite join helpers
-- Apply in Supabase SQL Editor (Dashboard → SQL → New query → Run).

create extension if not exists "pgcrypto";

-- ── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  invite_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create index if not exists leagues_owner_id_idx on public.leagues (owner_id);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'player')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_members_user_id_idx on public.league_members (user_id);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz,
  home_goals int,
  away_goals int,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished'))
);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  home_goals int not null,
  away_goals int not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  provider text not null default 'stub',
  created_at timestamptz not null default now()
);

-- ── Auth → profile trigger ─────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1),
      'Player'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.tournaments enable row level security;
alter table public.matches enable row level security;
alter table public.tips enable row level security;
alter table public.ai_agents enable row level security;

drop policy if exists "profiles_select_own_or_league_mates" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "leagues_select_member" on public.leagues;
drop policy if exists "leagues_update_owner" on public.leagues;
drop policy if exists "leagues_delete_owner" on public.leagues;
drop policy if exists "league_members_select_same_league" on public.league_members;
drop policy if exists "league_members_delete_owner_or_self" on public.league_members;
drop policy if exists "tournaments_member_all" on public.tournaments;
drop policy if exists "matches_member_select" on public.matches;
drop policy if exists "tips_own_rw" on public.tips;
drop policy if exists "ai_agents_member_select" on public.ai_agents;

create policy "profiles_select_own_or_league_mates"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.league_members me
      join public.league_members them on them.league_id = me.league_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "leagues_select_member"
  on public.leagues for select to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = leagues.id and m.user_id = auth.uid()
    )
  );

create policy "leagues_update_owner"
  on public.leagues for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "leagues_delete_owner"
  on public.leagues for delete to authenticated
  using (owner_id = auth.uid());

create policy "league_members_select_same_league"
  on public.league_members for select to authenticated
  using (
    exists (
      select 1 from public.league_members me
      where me.league_id = league_members.league_id
        and me.user_id = auth.uid()
    )
  );

create policy "league_members_delete_owner_or_self"
  on public.league_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.leagues l
      where l.id = league_members.league_id and l.owner_id = auth.uid()
    )
  );

create policy "tournaments_member_all"
  on public.tournaments for all to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = tournaments.league_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.league_members m
      where m.league_id = tournaments.league_id and m.user_id = auth.uid()
    )
  );

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

create policy "tips_own_rw"
  on public.tips for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ai_agents_member_select"
  on public.ai_agents for select to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = ai_agents.league_id and m.user_id = auth.uid()
    )
  );

-- ── RPCs ───────────────────────────────────────────────────────────────────

create or replace function public.ensure_profile(p_display_name text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, display_name)
  values (uid, coalesce(nullif(trim(p_display_name), ''), 'Player'))
  on conflict (id) do update
    set display_name = case
      when nullif(trim(p_display_name), '') is null then profiles.display_name
      else trim(p_display_name)
    end
  returning * into row;

  return row;
end;
$$;

create or replace function public.create_league(p_name text)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  league public.leagues;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'League name required';
  end if;

  perform public.ensure_profile(null);

  insert into public.leagues (name, owner_id)
  values (trim(p_name), uid)
  returning * into league;

  insert into public.league_members (league_id, user_id, role)
  values (league.id, uid, 'owner');

  return league;
end;
$$;

create or replace function public.join_league_by_token(p_token text)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  league public.leagues;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(trim(p_token), '') is null then
    raise exception 'Invite token required';
  end if;

  perform public.ensure_profile(null);

  select * into league
  from public.leagues
  where invite_token = trim(p_token);

  if league.id is null then
    raise exception 'Invalid invite link';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (league.id, uid, 'player')
  on conflict (league_id, user_id) do nothing;

  return league;
end;
$$;

create or replace function public.list_my_leagues()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  invite_token text,
  created_at timestamptz,
  my_role text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    l.name,
    l.owner_id,
    l.invite_token,
    l.created_at,
    m.role as my_role
  from public.leagues l
  join public.league_members m on m.league_id = l.id
  where m.user_id = auth.uid()
  order by l.created_at desc;
$$;

grant usage on schema public to authenticated;
grant select, update, insert on public.profiles to authenticated;
grant select on public.leagues to authenticated;
grant select on public.league_members to authenticated;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select on public.matches to authenticated;
grant select, insert, update, delete on public.tips to authenticated;
grant select on public.ai_agents to authenticated;

grant execute on function public.ensure_profile(text) to authenticated;
grant execute on function public.create_league(text) to authenticated;
grant execute on function public.join_league_by_token(text) to authenticated;
grant execute on function public.list_my_leagues() to authenticated;
