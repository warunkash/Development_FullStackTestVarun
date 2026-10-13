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

## Schema

See `schema.sql`. To clean out junk rows, delete them from the Supabase dashboard (SQL editor or table view).
