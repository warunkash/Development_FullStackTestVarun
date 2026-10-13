create table public.scores (
  id bigint generated always as identity primary key,
  level int not null check (level between 1 and 200),
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index scores_rank_idx on public.scores (level, moves, time_ms, id);
create index scores_ip_idx on public.scores (ip_hash, created_at);

create table public.leaderboard_private (
  id int primary key default 1 check (id = 1),
  salt text not null default gen_random_uuid()::text
);
insert into public.leaderboard_private default values;

alter table public.scores enable row level security;
alter table public.leaderboard_private enable row level security;
revoke all on public.scores from anon, authenticated;
revoke all on public.leaderboard_private from anon, authenticated;

create or replace function public.clean_name(p text) returns text language plpgsql immutable set search_path = public as $fn$
declare v text;
begin
  v := left(btrim(regexp_replace(coalesce(p, ''), '[^[:alnum:] ._-]', '', 'g')), 12);
  if v = '' then v := 'Player'; end if;
  return v;
end;
$fn$;

create or replace function public.submit_score(p_level int, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_colors int;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  if p_level is null or p_level < 1 or p_level > 200 or p_moves is null or p_time_ms is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  v_colors := least(3 + (p_level - 1) / 2, 10);
  if p_moves < v_colors or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.scores (level, name, moves, time_ms, ip_hash)
  values (p_level, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.scores s
     where s.level = p_level and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_leaderboard(p_level int, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.scores s
       where s.level = p_level
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_score(int, text, int, int) from public;
revoke execute on function public.get_leaderboard(int, int) from public;
revoke execute on function public.clean_name(text) from public;
grant execute on function public.submit_score(int, text, int, int) to anon, authenticated;
grant execute on function public.get_leaderboard(int, int) to anon, authenticated;

create table public.daily_scores (
  id bigint generated always as identity primary key,
  day date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index daily_scores_rank_idx on public.daily_scores (day, moves, time_ms, id);
create index daily_scores_ip_idx on public.daily_scores (ip_hash, created_at);
alter table public.daily_scores enable row level security;
revoke all on public.daily_scores from anon, authenticated;

create or replace function public.submit_daily_score(p_day date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_today := (now() at time zone 'utc')::date;
  if p_day is null or p_moves is null or p_time_ms is null or p_day < v_today - 1 or p_day > v_today + 1 then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 8 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.daily_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.daily_scores (day, name, moves, time_ms, ip_hash)
  values (p_day, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.daily_scores s
     where s.day = p_day and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_daily_leaderboard(p_day date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.daily_scores s
       where s.day = p_day
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_daily_score(date, text, int, int) from public;
revoke execute on function public.get_daily_leaderboard(date, int) from public;
grant execute on function public.submit_daily_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_daily_leaderboard(date, int) to anon, authenticated;

create table public.weekly_scores (
  id bigint generated always as identity primary key,
  week date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index weekly_scores_rank_idx on public.weekly_scores (week, moves, time_ms, id);
create index weekly_scores_ip_idx on public.weekly_scores (ip_hash, created_at);
alter table public.weekly_scores enable row level security;
revoke all on public.weekly_scores from anon, authenticated;

create or replace function public.submit_weekly_score(p_week date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_moves is null or p_time_ms is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 10 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.weekly_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.weekly_scores (week, name, moves, time_ms, ip_hash)
  values (p_week, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.weekly_scores s
     where s.week = p_week and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_weekly_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.weekly_scores s
       where s.week = p_week
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_weekly_score(date, text, int, int) from public;
revoke execute on function public.get_weekly_leaderboard(date, int) from public;
grant execute on function public.submit_weekly_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_weekly_leaderboard(date, int) to anon, authenticated;

-- Monthly challenge
create table public.monthly_scores (
  id bigint generated always as identity primary key,
  month date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index monthly_scores_rank_idx on public.monthly_scores (month, moves, time_ms, id);
create index monthly_scores_ip_idx on public.monthly_scores (ip_hash, created_at);
alter table public.monthly_scores enable row level security;
revoke all on public.monthly_scores from anon, authenticated;

create or replace function public.submit_monthly_score(p_month date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_this date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_this := date_trunc('month', now() at time zone 'utc')::date;
  if p_month is null or p_moves is null or p_time_ms is null or extract(day from p_month)::int <> 1 or p_month < (v_this - interval '1 month')::date or p_month > v_this then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 10 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.monthly_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.monthly_scores (month, name, moves, time_ms, ip_hash)
  values (p_month, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.monthly_scores s
     where s.month = p_month and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_monthly_leaderboard(p_month date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.monthly_scores s
       where s.month = p_month
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_monthly_score(date, text, int, int) from public;
revoke execute on function public.get_monthly_leaderboard(date, int) from public;
grant execute on function public.submit_monthly_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_monthly_leaderboard(date, int) to anon, authenticated;

-- Yearly challenge
create table public.yearly_scores (
  id bigint generated always as identity primary key,
  year date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index yearly_scores_rank_idx on public.yearly_scores (year, moves, time_ms, id);
create index yearly_scores_ip_idx on public.yearly_scores (ip_hash, created_at);
alter table public.yearly_scores enable row level security;
revoke all on public.yearly_scores from anon, authenticated;

create or replace function public.submit_yearly_score(p_year date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_this date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_this := date_trunc('year', now() at time zone 'utc')::date;
  if p_year is null or p_moves is null or p_time_ms is null or (extract(month from p_year)::int <> 1 or extract(day from p_year)::int <> 1) or p_year < (v_this - interval '1 year')::date or p_year > v_this then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 10 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.yearly_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.yearly_scores (year, name, moves, time_ms, ip_hash)
  values (p_year, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.yearly_scores s
     where s.year = p_year and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_yearly_leaderboard(p_year date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.yearly_scores s
       where s.year = p_year
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_yearly_score(date, text, int, int) from public;
revoke execute on function public.get_yearly_leaderboard(date, int) from public;
grant execute on function public.submit_yearly_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_yearly_leaderboard(date, int) to anon, authenticated;

-- Seasonal challenge
create table public.seasonal_scores (
  id bigint generated always as identity primary key,
  season date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index seasonal_scores_rank_idx on public.seasonal_scores (season, moves, time_ms, id);
create index seasonal_scores_ip_idx on public.seasonal_scores (ip_hash, created_at);
alter table public.seasonal_scores enable row level security;
revoke all on public.seasonal_scores from anon, authenticated;

create or replace function public.submit_seasonal_score(p_season date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_this date;
  v_mo int;
  v_yr int;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_mo := extract(month from (now() at time zone 'utc'))::int;
  v_yr := extract(year from (now() at time zone 'utc'))::int;
  v_this := make_date(case when v_mo <= 2 then v_yr - 1 else v_yr end,
                      case when v_mo = 12 or v_mo <= 2 then 12 when v_mo <= 5 then 3 when v_mo <= 8 then 6 else 9 end, 1);
  if p_season is null or p_moves is null or p_time_ms is null or p_season not in (v_this, (v_this - interval '3 months')::date) then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 10 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.seasonal_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.seasonal_scores (season, name, moves, time_ms, ip_hash)
  values (p_season, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.seasonal_scores s
     where s.season = p_season and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_seasonal_leaderboard(p_season date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.seasonal_scores s
       where s.season = p_season
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_seasonal_score(date, text, int, int) from public;
revoke execute on function public.get_seasonal_leaderboard(date, int) from public;
grant execute on function public.submit_seasonal_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_seasonal_leaderboard(date, int) to anon, authenticated;

-- Lifetime challenge
create table public.lifetime_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index lifetime_scores_rank_idx on public.lifetime_scores (moves, time_ms, id);
create index lifetime_scores_ip_idx on public.lifetime_scores (ip_hash, created_at);
alter table public.lifetime_scores enable row level security;
revoke all on public.lifetime_scores from anon, authenticated;

create or replace function public.submit_lifetime_score(p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  if p_moves is null or p_time_ms is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 10 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.lifetime_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.lifetime_scores (name, moves, time_ms, ip_hash)
  values (v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.lifetime_scores s
     where s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_lifetime_leaderboard(p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.lifetime_scores s
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_lifetime_score(text, int, int) from public;
revoke execute on function public.get_lifetime_leaderboard(int) from public;
grant execute on function public.submit_lifetime_score(text, int, int) to anon, authenticated;
grant execute on function public.get_lifetime_leaderboard(int) to anon, authenticated;

-- Team challenge
create table public.team_scores (
  id bigint generated always as identity primary key,
  week date not null,
  team text not null check (char_length(team) between 1 and 12),
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index team_scores_rank_idx on public.team_scores (week, team, moves, time_ms, id);
create index team_scores_ip_idx on public.team_scores (ip_hash, created_at);
alter table public.team_scores enable row level security;
revoke all on public.team_scores from anon, authenticated;

-- A team's score is the average of its members' best runs (best 5 members). Fewer moves wins, then more members, then faster time.
create or replace function public.team_standings(p_week date)
returns table (team text, members int, avg_moves numeric, avg_time numeric, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  with best as (
    select distinct on (s.team, s.name) s.team, s.name, s.moves, s.time_ms
      from public.team_scores s
     where s.week = p_week
     order by s.team, s.name, s.moves, s.time_ms, s.id
  ), ranked as (
    select b.*, row_number() over (partition by b.team order by b.moves, b.time_ms, b.name) as rn from best b
  ), t as (
    select r.team, count(*)::int as members, avg(r.moves) as avg_moves, avg(r.time_ms) as avg_time
      from ranked r where r.rn <= 5 group by r.team
  )
  select t.team, t.members, t.avg_moves, t.avg_time,
         row_number() over (order by t.avg_moves, t.members desc, t.avg_time, t.team) as rank
    from t;
$fn$;

create or replace function public.submit_team_score(p_week date, p_team text, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_team text;
  v_id bigint;
  v_rank bigint;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_moves is null or p_time_ms is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday
     or btrim(coalesce(regexp_replace(coalesce(p_team, ''), '[^[:alnum:] ._-]', '', 'g'), '')) = '' then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 9 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.team_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  v_team := public.clean_name(p_team);
  insert into public.team_scores (week, team, name, moves, time_ms, ip_hash)
  values (p_week, v_team, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select st.rank into v_rank from public.team_standings(p_week) st where st.team = v_team;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_team_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select st.rank, st.team || ' (' || st.members || ')', round(st.avg_moves)::int, round(st.avg_time)::int, st.rank
    from public.team_standings(p_week) st
   order by st.rank
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

create or replace function public.get_team_members(p_week date, p_team text)
returns table (name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.name) as rank
    from (
      select distinct on (s.name) s.name, s.moves, s.time_ms
        from public.team_scores s
       where s.week = p_week and s.team = public.clean_name(p_team)
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.name
   limit 20;
$fn$;

revoke execute on function public.team_standings(date) from public;
revoke execute on function public.submit_team_score(date, text, text, int, int) from public;
revoke execute on function public.get_team_leaderboard(date, int) from public;
revoke execute on function public.get_team_members(date, text) from public;
grant execute on function public.submit_team_score(date, text, text, int, int) to anon, authenticated;
grant execute on function public.get_team_leaderboard(date, int) to anon, authenticated;
grant execute on function public.get_team_members(date, text) to anon, authenticated;
revoke execute on function public.team_standings(date) from anon, authenticated;

-- Tournament challenge
create table public.tournament_scores (
  id bigint generated always as identity primary key,
  start date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 2000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index tournament_scores_rank_idx on public.tournament_scores (start, moves, time_ms, id);
create index tournament_scores_ip_idx on public.tournament_scores (ip_hash, created_at);
alter table public.tournament_scores enable row level security;
revoke all on public.tournament_scores from anon, authenticated;

-- A tournament runs for 14 days; periods are counted from Monday 2026-01-05 and identified by their first day.
-- Five rounds back to back (5, 6, 7, 8 and 9 colors), so a full run needs at least 35 moves.
create or replace function public.submit_tournament_score(p_start date, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_cur date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_cur := date '2026-01-05' + (((now() at time zone 'utc')::date - date '2026-01-05') / 14) * 14;
  if p_start is null or p_moves is null or p_time_ms is null or p_start not in (v_cur, v_cur - 14) then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 35 or p_moves > 2000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.tournament_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.tournament_scores (start, name, moves, time_ms, ip_hash)
  values (p_start, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.tournament_scores s
     where s.start = p_start and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_tournament_leaderboard(p_start date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.tournament_scores s
       where s.start = p_start
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_tournament_score(date, text, int, int) from public;
revoke execute on function public.get_tournament_leaderboard(date, int) from public;
grant execute on function public.submit_tournament_score(date, text, int, int) to anon, authenticated;
grant execute on function public.get_tournament_leaderboard(date, int) to anon, authenticated;

-- Bracket challenge
create table public.bracket_scores (
  id bigint generated always as identity primary key,
  week date not null,
  name text not null check (char_length(name) between 1 and 12),
  rounds smallint not null check (rounds between 0 and 3),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index bracket_scores_rank_idx on public.bracket_scores (week, rounds desc, moves, time_ms, id);
create index bracket_scores_ip_idx on public.bracket_scores (ip_hash, created_at);
alter table public.bracket_scores enable row level security;
revoke all on public.bracket_scores from anon, authenticated;

-- p_rounds = matches won (0-3). Ranked by rounds won, then total moves, then total time.
create or replace function public.submit_bracket_score(p_week date, p_name text, p_rounds int, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_rounds is null or p_moves is null or p_time_ms is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday or p_rounds < 0 or p_rounds > 3 then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 6 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.bracket_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.bracket_scores (week, name, rounds, moves, time_ms, ip_hash)
  values (p_week, v_name, p_rounds, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.bracket_scores s
     where s.week = p_week and s.name <> v_name and (-s.rounds, s.moves, s.time_ms) < (-p_rounds, p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_bracket_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id,
         b.name || case b.rounds when 3 then ' (Champion)' when 2 then ' (Final)' when 1 then ' (Semi)' else ' (Quarter)' end,
         b.moves, b.time_ms,
         row_number() over (order by b.rounds desc, b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.rounds, s.moves, s.time_ms
        from public.bracket_scores s
       where s.week = p_week
       order by s.name, s.rounds desc, s.moves, s.time_ms, s.id
    ) b
   order by b.rounds desc, b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_bracket_score(date, text, int, int, int) from public;
revoke execute on function public.get_bracket_leaderboard(date, int) from public;
grant execute on function public.submit_bracket_score(date, text, int, int, int) to anon, authenticated;
grant execute on function public.get_bracket_leaderboard(date, int) to anon, authenticated;

-- Ladder challenge
create table public.ladder_scores (
  id bigint generated always as identity primary key,
  week date not null,
  name text not null check (char_length(name) between 1 and 12),
  rungs smallint not null check (rungs between 1 and 24),
  moves int not null check (moves between 1 and 5000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index ladder_scores_rank_idx on public.ladder_scores (week, rungs desc, moves, time_ms, id);
create index ladder_scores_ip_idx on public.ladder_scores (ip_hash, created_at);
alter table public.ladder_scores enable row level security;
revoke all on public.ladder_scores from anon, authenticated;

-- p_rungs = rungs cleared (1-24). Ranked by rungs, then total moves, then total time. A climb with 0 rungs cleared is not submitted.
create or replace function public.submit_ladder_score(p_week date, p_name text, p_rungs int, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_rungs is null or p_moves is null or p_time_ms is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday or p_rungs < 1 or p_rungs > 24 then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < p_rungs * 3 or p_moves > 5000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.ladder_scores where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.ladder_scores (week, name, rungs, moves, time_ms, ip_hash)
  values (p_week, v_name, p_rungs, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.ladder_scores s
     where s.week = p_week and s.name <> v_name and (-s.rungs, s.moves, s.time_ms) < (-p_rungs, p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_ladder_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name || ' (rung ' || b.rungs || ')', b.moves, b.time_ms,
         row_number() over (order by b.rungs desc, b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.rungs, s.moves, s.time_ms
        from public.ladder_scores s
       where s.week = p_week
       order by s.name, s.rungs desc, s.moves, s.time_ms, s.id
    ) b
   order by b.rungs desc, b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

revoke execute on function public.submit_ladder_score(date, text, int, int, int) from public;
revoke execute on function public.get_ladder_leaderboard(date, int) from public;
grant execute on function public.submit_ladder_score(date, text, int, int, int) to anon, authenticated;
grant execute on function public.get_ladder_leaderboard(date, int) to anon, authenticated;

-- Guild challenge
create table public.guild_quests (
  id bigint generated always as identity primary key,
  day date not null,
  guild text not null check (char_length(guild) between 1 and 12),
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index guild_quests_day_idx on public.guild_quests (day, guild, name);
create index guild_quests_ip_idx on public.guild_quests (ip_hash, created_at);
alter table public.guild_quests enable row level security;
revoke all on public.guild_quests from anon, authenticated;

-- A guild's score for a month is the number of distinct (member, day) quests its members completed that month.
create or replace function public.guild_standings(p_month date)
returns table (guild text, members int, quests int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  with q as (
    select distinct g.guild, g.name, g.day
      from public.guild_quests g
     where g.day >= p_month and g.day < (p_month + interval '1 month')::date
  ), t as (
    select q.guild, count(distinct q.name)::int as members, count(*)::int as quests from q group by q.guild
  )
  select t.guild, t.members, t.quests,
         row_number() over (order by t.quests desc, t.members desc, t.guild) as rank
    from t;
$fn$;
revoke execute on function public.guild_standings(date) from public;
revoke execute on function public.guild_standings(date) from anon, authenticated;

create or replace function public.submit_guild_quest(p_day date, p_guild text, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_guild text;
  v_month date;
  v_id bigint;
  v_rank bigint;
  v_quests int;
begin
  v_today := (now() at time zone 'utc')::date;
  if p_day is null or p_moves is null or p_time_ms is null or p_day < v_today - 1 or p_day > v_today + 1
     or btrim(coalesce(regexp_replace(coalesce(p_guild, ''), '[^[:alnum:] ._-]', '', 'g'), '')) = '' then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 7 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.guild_quests where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  v_guild := public.clean_name(p_guild);
  v_month := date_trunc('month', p_day)::date;
  insert into public.guild_quests (day, guild, name, moves, time_ms, ip_hash)
  values (p_day, v_guild, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select st.rank, st.quests into v_rank, v_quests from public.guild_standings(v_month) st where st.guild = v_guild;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank, 'quests', v_quests);
end;
$fn$;

create or replace function public.get_guild_leaderboard(p_month date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select st.rank, st.guild || ' (' || st.members || ')', st.quests, 0, st.rank
    from public.guild_standings(p_month) st
   order by st.rank
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

create or replace function public.get_guild_members(p_month date, p_guild text)
returns table (name text, quests int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.name, b.quests, row_number() over (order by b.quests desc, b.name) as rank
    from (
      select g.name, count(distinct g.day)::int as quests
        from public.guild_quests g
       where g.guild = public.clean_name(p_guild) and g.day >= p_month and g.day < (p_month + interval '1 month')::date
       group by g.name
    ) b
   order by b.quests desc, b.name
   limit 20;
$fn$;

revoke execute on function public.submit_guild_quest(date, text, text, int, int) from public;
revoke execute on function public.get_guild_leaderboard(date, int) from public;
revoke execute on function public.get_guild_members(date, text) from public;
grant execute on function public.submit_guild_quest(date, text, text, int, int) to anon, authenticated;
grant execute on function public.get_guild_leaderboard(date, int) to anon, authenticated;
grant execute on function public.get_guild_members(date, text) to anon, authenticated;

-- Clan challenge
create table public.clan_runs (
  id bigint generated always as identity primary key,
  week date not null,
  clan text not null check (char_length(clan) between 1 and 12),
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 1000),
  time_ms int not null check (time_ms between 1000 and 86400000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index clan_runs_week_idx on public.clan_runs (week, clan, name, moves);
create index clan_runs_ip_idx on public.clan_runs (ip_hash, created_at);
alter table public.clan_runs enable row level security;
revoke all on public.clan_runs from anon, authenticated;

-- Damage dealt by a run = clamp(round(3000 / moves), 10, 200): fewer moves hit harder. A member counts with their best run; a clan's
-- weekly total is the sum over its members. The boss (500 HP) is defeated once a clan's total reaches 500.
create or replace function public.clan_damage(p_moves int)
returns int
language sql
immutable
set search_path = public
as $fn$
  select least(200, greatest(10, round(3000.0 / greatest(p_moves, 1))::int));
$fn$;

create or replace function public.clan_standings(p_week date)
returns table (clan text, members int, total int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  with best as (
    select distinct on (c.clan, c.name) c.clan, c.name, c.moves
      from public.clan_runs c
     where c.week = p_week
     order by c.clan, c.name, c.moves, c.time_ms, c.id
  ), t as (
    select b.clan, count(*)::int as members, sum(public.clan_damage(b.moves))::int as total from best b group by b.clan
  )
  select t.clan, t.members, t.total,
         row_number() over (order by t.total desc, t.members desc, t.clan) as rank
    from t;
$fn$;
revoke execute on function public.clan_standings(date) from public;
revoke execute on function public.clan_standings(date) from anon, authenticated;

create or replace function public.submit_clan_run(p_week date, p_clan text, p_name text, p_moves int, p_time_ms int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_clan text;
  v_id bigint;
  v_rank bigint;
  v_total int;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_moves is null or p_time_ms is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday
     or btrim(coalesce(regexp_replace(coalesce(p_clan, ''), '[^[:alnum:] ._-]', '', 'g'), '')) = '' then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 8 or p_moves > 1000 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.clan_runs where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  v_clan := public.clean_name(p_clan);
  insert into public.clan_runs (week, clan, name, moves, time_ms, ip_hash)
  values (p_week, v_clan, v_name, p_moves, p_time_ms, v_hash)
  returning id into v_id;
  select st.rank, st.total into v_rank, v_total from public.clan_standings(p_week) st where st.clan = v_clan;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank, 'damage', public.clan_damage(p_moves), 'total', v_total);
end;
$fn$;

create or replace function public.get_clan_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select st.rank, st.clan || ' (' || st.members || ')' || case when st.total >= 500 then ' ✔' else '' end, st.total, 0, st.rank
    from public.clan_standings(p_week) st
   order by st.rank
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

create or replace function public.get_clan_members(p_week date, p_clan text)
returns table (name text, damage int, moves int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.name, public.clan_damage(b.moves), b.moves,
         row_number() over (order by b.moves, b.name) as rank
    from (
      select distinct on (c.name) c.name, c.moves
        from public.clan_runs c
       where c.week = p_week and c.clan = public.clean_name(p_clan)
       order by c.name, c.moves, c.time_ms, c.id
    ) b
   order by b.moves, b.name
   limit 20;
$fn$;

revoke execute on function public.submit_clan_run(date, text, text, int, int) from public;
revoke execute on function public.get_clan_leaderboard(date, int) from public;
revoke execute on function public.get_clan_members(date, text) from public;
grant execute on function public.submit_clan_run(date, text, text, int, int) to anon, authenticated;
grant execute on function public.get_clan_leaderboard(date, int) to anon, authenticated;
grant execute on function public.get_clan_members(date, text) to anon, authenticated;

-- Mentor challenge
create table public.mentor_runs (
  id bigint generated always as identity primary key,
  week date not null,
  name text not null check (char_length(name) between 1 and 12),
  moves int not null check (moves between 1 and 600),
  time_ms int not null check (time_ms between 1000 and 86400000),
  path text not null check (char_length(path) between 2 and 1200),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index mentor_runs_rank_idx on public.mentor_runs (week, moves, time_ms, id);
create index mentor_runs_ip_idx on public.mentor_runs (ip_hash, created_at);
alter table public.mentor_runs enable row level security;
revoke all on public.mentor_runs from anon, authenticated;

-- p_path is the run's moves as pairs of base-12 digits (from tube, to tube), so it has exactly 2 characters per move.
-- The client replays it on the week's board before showing it ("watch the mentor"); the server only checks its shape.
create or replace function public.submit_mentor_run(p_week date, p_name text, p_moves int, p_time_ms int, p_path text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_today date;
  v_monday date;
  v_headers json;
  v_ip text;
  v_hash text;
  v_name text;
  v_id bigint;
  v_rank int;
begin
  v_today := (now() at time zone 'utc')::date;
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_week is null or p_moves is null or p_time_ms is null or p_path is null or extract(isodow from p_week)::int <> 1 or p_week < v_monday - 7 or p_week > v_monday then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_moves < 9 or p_moves > 600 then
    return json_build_object('ok', false, 'error', 'implausible_moves');
  end if;
  if char_length(p_path) <> p_moves * 2 or p_path !~ '^[0-9ab]+$' then
    return json_build_object('ok', false, 'error', 'invalid_path');
  end if;
  if p_time_ms < p_moves * 200 or p_time_ms > 86400000 then
    return json_build_object('ok', false, 'error', 'implausible_time');
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  select encode(hmac(v_ip, salt, 'sha256'), 'hex') into v_hash from public.leaderboard_private where id = 1;
  if (select count(*) from public.mentor_runs where ip_hash = v_hash and created_at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_name := public.clean_name(p_name);
  insert into public.mentor_runs (week, name, moves, time_ms, path, ip_hash)
  values (p_week, v_name, p_moves, p_time_ms, p_path, v_hash)
  returning id into v_id;
  select 1 + count(*) into v_rank from (
    select s.name from public.mentor_runs s
     where s.week = p_week and s.name <> v_name and (s.moves, s.time_ms) < (p_moves, p_time_ms)
     group by s.name
  ) x;
  return json_build_object('ok', true, 'id', v_id, 'rank', v_rank);
end;
$fn$;

create or replace function public.get_mentor_leaderboard(p_week date, p_limit int default 20)
returns table (id bigint, name text, moves int, time_ms int, rank bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.id, b.name, b.moves, b.time_ms, row_number() over (order by b.moves, b.time_ms, b.id) as rank
    from (
      select distinct on (s.name) s.id, s.name, s.moves, s.time_ms
        from public.mentor_runs s
       where s.week = p_week
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

-- The recorded run of the n-th best player (the "mentor") for a week, best run per player.
create or replace function public.get_mentor_run(p_week date, p_rank int default 1)
returns table (name text, moves int, time_ms int, path text)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.name, b.moves, b.time_ms, b.path
    from (
      select distinct on (s.name) s.name, s.moves, s.time_ms, s.path, s.id
        from public.mentor_runs s
       where s.week = p_week
       order by s.name, s.moves, s.time_ms, s.id
    ) b
   order by b.moves, b.time_ms, b.id
   offset greatest(coalesce(p_rank, 1), 1) - 1
   limit 1;
$fn$;

revoke execute on function public.submit_mentor_run(date, text, int, int, text) from public;
revoke execute on function public.get_mentor_leaderboard(date, int) from public;
revoke execute on function public.get_mentor_run(date, int) from public;
grant execute on function public.submit_mentor_run(date, text, int, int, text) to anon, authenticated;
grant execute on function public.get_mentor_leaderboard(date, int) to anon, authenticated;
grant execute on function public.get_mentor_run(date, int) to anon, authenticated;
