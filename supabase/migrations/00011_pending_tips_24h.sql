-- Tip reminders: only matches kicking off within the next 24 hours

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
        and m.kickoff_at is not null
        and m.kickoff_at > now()
        and m.kickoff_at <= now() + interval '24 hours'
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

grant execute on function public.list_my_pending_tips() to authenticated;
