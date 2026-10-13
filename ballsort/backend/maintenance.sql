-- Maintenance for the Ball Sort backend. Run in the Supabase dashboard (SQL editor) as the project owner.
-- Nothing here is applied automatically; DELETE statements need a human to run them.

-- 1) One-off: remove the test rows created while building the modes (all dated 2026-10-13).
--    Each delete also matches on the name, so a real row that reuses an id is never touched.
delete from public.scores            where id in (1,2,3) and name in ('test','Tester');
delete from public.daily_scores      where id = 1 and name = 'DailyTest';
delete from public.weekly_scores     where id = 1 and name = 'WeeklyTest';
delete from public.monthly_scores    where id = 1 and name = 'MonthTest';
delete from public.yearly_scores     where id = 1 and name = 'YearTest';
delete from public.lifetime_scores   where id = 1 and name = 'LifeTest';
delete from public.seasonal_scores   where id = 1 and name = 'SeasonTest';
delete from public.team_scores       where id in (1,2,3) and name in ('Ann','Bob','Cy');
delete from public.tournament_scores where id = 1 and name = 'TournTest';
delete from public.bracket_scores    where id in (1,2,3) and name in ('BrAnn','BrBob','BrCy');
delete from public.ladder_scores     where id in (1,2,3) and name in ('LadAnn','LadBob','LadCy');
delete from public.guild_quests      where id in (1,2,3,4,5) and name in ('Ann','Bob','Cy');
delete from public.clan_runs         where id in (1,2,3,4) and name in ('Ann','Bob','Cy');
delete from public.mentor_runs       where id in (1,2) and name in ('MentAnn','MentBob');

-- 2) Retention: drop boards nobody can play or submit to any more. Never touches scores, yearly_scores or lifetime_scores
--    (all-time / long-lived boards). Submission windows are at most a few weeks, so these limits keep history comfortably.
create or replace function public.prune_old_boards()
returns void language sql security definer set search_path = public as $$
  delete from daily_scores      where created_at < now() - interval '90 days';
  delete from weekly_scores     where created_at < now() - interval '90 days';
  delete from team_scores       where created_at < now() - interval '90 days';
  delete from bracket_scores    where created_at < now() - interval '90 days';
  delete from ladder_scores     where created_at < now() - interval '90 days';
  delete from clan_runs         where created_at < now() - interval '90 days';
  delete from mentor_runs       where created_at < now() - interval '90 days';
  delete from guild_quests      where created_at < now() - interval '120 days';
  delete from tournament_scores where created_at < now() - interval '120 days';
  delete from monthly_scores    where created_at < now() - interval '400 days';
  delete from seasonal_scores   where created_at < now() - interval '400 days';
$$;
revoke all on function public.prune_old_boards() from public, anon, authenticated;

-- 3) Schedule it nightly (needs the pg_cron extension: Database > Extensions > pg_cron).
create extension if not exists pg_cron;
select cron.schedule('prune-old-boards', '17 3 * * *', $$select public.prune_old_boards()$$);
-- To stop it later: select cron.unschedule('prune-old-boards');
