-- Epic 8.3: owner-defined bonus questions with points weight
-- Epic 8.10: pending tip counts for in-app reminders / deep links

create table if not exists public.bonus_questions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  prompt text not null,
  answer_type text not null default 'text'
    check (answer_type in ('text', 'choice', 'number')),
  choices jsonb,
  points int not null default 2
    check (points >= 1 and points <= 50),
  deadline_at timestamptz,
  correct_answer text,
  status text not null default 'open'
    check (status in ('open', 'scored')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint bonus_questions_choices_ok check (
    answer_type <> 'choice'
    or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) >= 2)
  )
);

create table if not exists public.bonus_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.bonus_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists bonus_questions_league_idx
  on public.bonus_questions (league_id, sort_order, created_at);

create index if not exists bonus_answers_question_idx
  on public.bonus_answers (question_id);

alter table public.bonus_questions enable row level security;
alter table public.bonus_answers enable row level security;

drop policy if exists "bonus_questions_member_select" on public.bonus_questions;
create policy "bonus_questions_member_select"
  on public.bonus_questions for select to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = bonus_questions.league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "bonus_answers_member_select" on public.bonus_answers;
create policy "bonus_answers_member_select"
  on public.bonus_answers for select to authenticated
  using (
    exists (
      select 1
      from public.bonus_questions q
      join public.league_members m on m.league_id = q.league_id
      where q.id = bonus_answers.question_id
        and m.user_id = auth.uid()
        and (
          bonus_answers.user_id = auth.uid()
          or q.status = 'scored'
          or (q.deadline_at is not null and q.deadline_at <= now())
        )
    )
  );

grant select on public.bonus_questions to authenticated;
grant select on public.bonus_answers to authenticated;

create or replace function public.bonus_answer_locked(p_question public.bonus_questions)
returns boolean
language sql
stable
as $$
  select
    p_question.status = 'scored'
    or (p_question.deadline_at is not null and p_question.deadline_at <= now());
$$;

create or replace function public.upsert_bonus_question(
  p_league_id uuid,
  p_prompt text,
  p_answer_type text default 'text',
  p_choices jsonb default null,
  p_points int default 2,
  p_deadline_at timestamptz default null,
  p_sort_order int default 0,
  p_id uuid default null
)
returns public.bonus_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.bonus_questions;
  cleaned_prompt text := trim(coalesce(p_prompt, ''));
  atype text := lower(trim(coalesce(p_answer_type, 'text')));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if cleaned_prompt = '' then raise exception 'Prompt is required'; end if;
  if atype not in ('text', 'choice', 'number') then
    raise exception 'Invalid answer type';
  end if;
  if p_points is null or p_points < 1 or p_points > 50 then
    raise exception 'Points must be between 1 and 50';
  end if;
  if not exists (
    select 1 from public.leagues where id = p_league_id and owner_id = uid
  ) then
    raise exception 'Only the league owner can manage bonus questions';
  end if;

  if atype = 'choice' then
    if p_choices is null
      or jsonb_typeof(p_choices) <> 'array'
      or jsonb_array_length(p_choices) < 2 then
      raise exception 'Choice questions need at least two options';
    end if;
  end if;

  if p_id is null then
    insert into public.bonus_questions (
      league_id, prompt, answer_type, choices, points, deadline_at, sort_order
    )
    values (
      p_league_id,
      cleaned_prompt,
      atype,
      case when atype = 'choice' then p_choices else null end,
      p_points,
      p_deadline_at,
      coalesce(p_sort_order, 0)
    )
    returning * into row;
  else
    update public.bonus_questions
    set
      prompt = cleaned_prompt,
      answer_type = atype,
      choices = case when atype = 'choice' then p_choices else null end,
      points = p_points,
      deadline_at = p_deadline_at,
      sort_order = coalesce(p_sort_order, sort_order)
    where id = p_id and league_id = p_league_id and status = 'open'
    returning * into row;

    if row.id is null then
      raise exception 'Bonus question not found or already scored';
    end if;
  end if;

  return row;
end;
$$;

create or replace function public.delete_bonus_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q public.bonus_questions;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into q from public.bonus_questions where id = p_id;
  if q.id is null then raise exception 'Bonus question not found'; end if;
  if not exists (
    select 1 from public.leagues where id = q.league_id and owner_id = uid
  ) then
    raise exception 'Only the league owner can delete bonus questions';
  end if;
  delete from public.bonus_questions where id = p_id;
end;
$$;

create or replace function public.upsert_bonus_answer(
  p_question_id uuid,
  p_answer text
)
returns public.bonus_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q public.bonus_questions;
  cleaned text := trim(coalesce(p_answer, ''));
  row public.bonus_answers;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if cleaned = '' then raise exception 'Answer is required'; end if;

  select * into q from public.bonus_questions where id = p_question_id;
  if q.id is null then raise exception 'Bonus question not found'; end if;

  if not exists (
    select 1 from public.league_members
    where league_id = q.league_id and user_id = uid
  ) then
    raise exception 'Not a league member';
  end if;

  if public.bonus_answer_locked(q) then
    raise exception 'Bonus answers are locked';
  end if;

  if q.answer_type = 'number' then
    if cleaned !~ '^-?[0-9]+$' then
      raise exception 'Answer must be a whole number';
    end if;
  elsif q.answer_type = 'choice' then
    if not exists (
      select 1
      from jsonb_array_elements_text(q.choices) opt
      where lower(trim(opt)) = lower(cleaned)
    ) then
      raise exception 'Answer must be one of the choices';
    end if;
    -- store canonical choice text
    select trim(opt) into cleaned
    from jsonb_array_elements_text(q.choices) opt
    where lower(trim(opt)) = lower(cleaned)
    limit 1;
  end if;

  insert into public.bonus_answers (question_id, user_id, answer_text)
  values (p_question_id, uid, cleaned)
  on conflict (question_id, user_id) do update
    set answer_text = excluded.answer_text,
        updated_at = now()
  returning * into row;

  return row;
end;
$$;

create or replace function public.score_bonus_question(
  p_question_id uuid,
  p_correct_answer text
)
returns public.bonus_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q public.bonus_questions;
  cleaned text := trim(coalesce(p_correct_answer, ''));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if cleaned = '' then raise exception 'Correct answer is required'; end if;

  select * into q from public.bonus_questions where id = p_question_id;
  if q.id is null then raise exception 'Bonus question not found'; end if;
  if not exists (
    select 1 from public.leagues where id = q.league_id and owner_id = uid
  ) then
    raise exception 'Only the league owner can score bonus questions';
  end if;

  if q.answer_type = 'number' and cleaned !~ '^-?[0-9]+$' then
    raise exception 'Correct answer must be a whole number';
  end if;

  if q.answer_type = 'choice' then
    if not exists (
      select 1
      from jsonb_array_elements_text(q.choices) opt
      where lower(trim(opt)) = lower(cleaned)
    ) then
      raise exception 'Correct answer must be one of the choices';
    end if;
    select trim(opt) into cleaned
    from jsonb_array_elements_text(q.choices) opt
    where lower(trim(opt)) = lower(cleaned)
    limit 1;
  end if;

  update public.bonus_questions
  set correct_answer = cleaned,
      status = 'scored'
  where id = p_question_id
  returning * into q;

  return q;
end;
$$;

create or replace function public.list_my_pending_tips()
returns table (
  league_id uuid,
  league_name text,
  pending_matches int,
  pending_bonuses int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return query
  select
    l.id,
    l.name,
    coalesce((
      select count(*)::int
      from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      where t.league_id = l.id
        and m.status <> 'finished'
        and (m.kickoff_at is null or m.kickoff_at > now())
        and not exists (
          select 1 from public.tips tip
          where tip.match_id = m.id and tip.user_id = uid
        )
    ), 0) as pending_matches,
    coalesce((
      select count(*)::int
      from public.bonus_questions bq
      where bq.league_id = l.id
        and bq.status = 'open'
        and (bq.deadline_at is null or bq.deadline_at > now())
        and not exists (
          select 1 from public.bonus_answers ba
          where ba.question_id = bq.id and ba.user_id = uid
        )
    ), 0) as pending_bonuses
  from public.leagues l
  join public.league_members lm on lm.league_id = l.id and lm.user_id = uid
  order by l.created_at desc;
end;
$$;

-- Extend play bundle with bonuses
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

grant execute on function public.upsert_bonus_question(uuid, text, text, jsonb, int, timestamptz, int, uuid) to authenticated;
grant execute on function public.delete_bonus_question(uuid) to authenticated;
grant execute on function public.upsert_bonus_answer(uuid, text) to authenticated;
grant execute on function public.score_bonus_question(uuid, text) to authenticated;
grant execute on function public.list_my_pending_tips() to authenticated;
