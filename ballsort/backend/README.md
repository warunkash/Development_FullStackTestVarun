# Ball Sort world leaderboard backend

The online leaderboard lives in a Supabase project named `ballsort-leaderboard`
(`https://tlituetpgrlfilqgkpvi.supabase.co`). The game calls it straight from the browser with the
project's **publishable** key (it is public by design and is in `ballsort/index.html`).

## How it is locked down

- The `scores` table has row level security on and **no policies**, and `anon`/`authenticated` have no
  table privileges, so nothing can read or write it directly.
- The only way in is two `SECURITY DEFINER` functions, both callable by `anon`:
  - `submit_score(p_level, p_name, p_moves, p_time_ms)` rejects scores that are impossible for the level
    (fewer moves than the level has colours, or more than 5 moves per second), cleans the name to letters,
    digits, spaces and `. _ -` (max 12 characters), and allows at most 8 submissions per client per
    10 minutes. Clients are told apart by an HMAC of their IP address with a private salt, so raw IPs are
    never stored.
  - `get_leaderboard(p_level, p_limit)` returns each player's best run for a level, best first (max 50 rows).

This cannot stop a determined cheater, because the game runs on the player's device. It rejects obviously
impossible scores and limits spam.

## Daily challenge

The daily challenge has its own table (`daily_scores`) and two functions, `submit_daily_score` and
`get_daily_leaderboard`, locked down the same way. A day's board is for the UTC date; submissions are only
accepted for yesterday, today or tomorrow (UTC), so late finishers and time zones still work.

## Weekly challenge

Same pattern again: `weekly_scores` plus `submit_weekly_score` and `get_weekly_leaderboard`. A week runs
Monday to Sunday (UTC) and is identified by its Monday. Submissions are accepted for this week or last week
only, and the date must be a Monday. Weekly boards have 10 colors, so at least 10 moves are required.

## Monthly challenge

`monthly_scores` plus `submit_monthly_score` and `get_monthly_leaderboard`. A month is identified by its first
day (UTC). Submissions are accepted for this month or last month only, and the date must be the 1st. Monthly
boards are bigger (10 colors, 5 balls per color), so at least 10 moves are required.

## Yearly challenge

`yearly_scores` plus `submit_yearly_score` and `get_yearly_leaderboard`. A year is identified by January 1st (UTC).
Submissions are accepted for this year or last year only. Yearly boards are the biggest (10 colors, 6 balls per
color), so at least 10 moves are required.

## Seasonal challenge

`seasonal_scores` plus `submit_seasonal_score` and `get_seasonal_leaderboard`. A season is identified by its first day
(UTC): Dec 1 (winter), Mar 1 (spring), Jun 1 (summer) or Sep 1 (autumn). Submissions are accepted for the current or the
previous season only. Seasonal boards have 9 colors with 6 balls each, so at least 10 moves are required.

## Lifetime challenge

`lifetime_scores` plus `submit_lifetime_score` and `get_lifetime_leaderboard`. There is one permanent board (it never
changes) and one all-time leaderboard, so these functions take no date. Same checks as the others: at least 10 moves,
a plausible time, and the per-IP rate limit.

## Team challenge

`team_scores` plus `submit_team_score`, `get_team_leaderboard` and `get_team_members`. Everyone plays the same board for a
week (identified by its Monday, UTC). A team is just a name players choose (no accounts), and its score is the average of its
members' best runs (best 5 members); fewer moves wins, then more members, then faster time. Submissions are accepted for this
week or last week. The helper `team_standings` is not callable by `anon`; only the leaderboard functions use it.

## Tournament challenge

`tournament_scores` plus `submit_tournament_score` and `get_tournament_leaderboard`. A tournament lasts 14 days (periods are
counted from Monday 2026-01-05, UTC) and is identified by its first day. Players clear 5 rounds back to back (5, 6, 7, 8 and 9
colors); the run's total moves and total time are what get submitted, so at least 35 moves are required. Submissions are
accepted for the current or the previous tournament only.

## Bracket challenge

`bracket_scores` plus `submit_bracket_score` and `get_bracket_leaderboard`. A weekly three-match knockout against computer
opponents (quarterfinal, semifinal, final); the board and opponents are the same for everyone that week (identified by its
Monday, UTC). A run is submitted with the number of matches won (0-3), the total moves and the total time, and is ranked by
matches won, then moves, then time. At least 6 moves are required; this or last week only.

## Ladder challenge

`ladder_scores` plus `submit_ladder_score` and `get_ladder_leaderboard`. A weekly climb of up to 24 rungs on ever bigger boards
(identified by the week's Monday, UTC); each rung has a move budget and the climb ends when it is exceeded. A climb is submitted
with the number of rungs cleared (1-24), total moves and total time, and ranked by rungs, then moves, then time. A climb that
clears no rung is not submitted. This or last week only.

## Guild challenge

`guild_quests` plus `submit_guild_quest`, `get_guild_leaderboard` and `get_guild_members`. A guild is just a name players choose
(no accounts). Every day has one guild quest board (7 colors); finishing it records a (guild, member, day) entry. A guild's
monthly score is the number of distinct (member, day) quests it has, so replaying a day's quest adds nothing; guilds are ranked
by quests, then members. Submissions are accepted for yesterday, today or tomorrow (UTC) and need at least 7 moves. The helper
`guild_standings` is not callable by `anon`.

## Clan challenge

`clan_runs` plus `submit_clan_run`, `get_clan_leaderboard` and `get_clan_members`. A weekly boss fight (identified by the week's
Monday, UTC): everyone plays the same board, and a run deals `clamp(round(3000 / moves), 10, 200)` damage (computed by the server
in `clan_damage`). A clan is just a name players choose (no accounts); each member counts with their best run and the clan's total
is the sum over its members. The boss has 500 HP and is defeated once a clan's total reaches 500; clans are ranked by total damage,
then members. At least 8 moves are required; this or last week only. The helper `clan_standings` is not callable by `anon`.

## Mentor challenge

`mentor_runs` plus `submit_mentor_run`, `get_mentor_leaderboard` and `get_mentor_run`. A weekly board (identified by the week's
Monday, UTC) where each run is stored with its move-by-move recording (`path`: two base-12 digits per move, from tube and to tube).
The server only checks the recording's shape (length = 2 x moves, valid digits); the client replays it on the week's board before
showing it and refuses a recording that is not a legal, solving sequence. `get_mentor_run(week, n)` returns the n-th best player's
best run. At least 9 moves are required; this or last week only.

## Schema

See `schema.sql`.

## Maintenance

`maintenance.sql` holds the one-off removal of the test rows and `prune_old_boards()`, a retention job (90 days for the daily to weekly style boards, 120 for guild and tournament, 400 for monthly and seasonal; `scores`, `yearly_scores` and `lifetime_scores` are kept) with an optional nightly `pg_cron` schedule. Run it yourself in the Supabase SQL editor; it is not applied automatically.
