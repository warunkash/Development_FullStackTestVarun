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

## Schema

See `schema.sql`. To clean out junk rows, delete them from the Supabase dashboard (SQL editor or table view).
