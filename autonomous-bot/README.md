# autobot — an autonomous agent framework

A small, dependency-light agent that runs a **plan → act → observe** loop over a
set of pluggable tools, under an explicit budget. It runs two ways from the same
definition: one-shot (cron / GitHub Actions) or as a long-running daemon.

Nothing here is specific to this repository — it's a standalone framework you
point at your own tools and tasks.

## The idea

Three pieces, deliberately separate:

| Piece | Responsibility | Swap it when |
|---|---|---|
| **Agent** (`agent.py`) | Owns the loop, budgets and error handling | Rarely — it's the invariant part |
| **Policy** (`policy.py`) | Decides the *next* action | You want a different brain |
| **Tools** (`tools.py`, `builtins.py`) | Actually do things | Always — this is where your work lives |

The agent never decides *what* to do and the policy never decides *when to
stop*. That split is what lets the identical agent run against a fixed plan in
CI and against a model in production.

Two policies ship:

- **`RulePolicy`** replays a declarative playbook. No credentials, no network,
  fully deterministic — this is what CI runs.
- **`ClaudePolicy`** asks Claude (`claude-opus-5`) to choose each tool call, so
  the run is genuinely open-ended.

## Quickstart

```bash
cd autonomous-bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m autobot.cli doctor          # check config and credentials
python -m autobot.cli tools           # what the agent can do
python -m autobot.cli tasks           # what it's configured to do
python -m autobot.cli run heartbeat   # run one task and exit
```

A completed run prints a summary and leaves a full JSONL transcript in `runs/`:

```
task:    heartbeat
status:  completed
steps:   4 (0 failed)
summary: Heartbeat recorded; status file and history updated.
```

## The two runtimes

**One-shot** — for cron and CI. Exits non-zero if the run didn't complete, so a
scheduler can tell a broken run from a healthy one:

```bash
python -m autobot.cli run heartbeat --json
```

**Daemon** — runs every enabled task on its own interval until stopped:

```bash
python -m autobot.cli serve
```

The daemon backs off exponentially (with jitter, capped at an hour) on tasks
that keep failing, isolates a crashing task so it can't take the process down,
and shuts down cleanly on SIGTERM/SIGINT — it finishes the task in flight rather
than being killed mid-step. As a systemd unit:

```ini
[Service]
WorkingDirectory=/opt/autobot
ExecStart=/opt/autobot/.venv/bin/python -m autobot.cli serve
Restart=always
KillSignal=SIGTERM
```

`.github/workflows/autonomous-bot.yml` is the CI host: it runs the tests, then
`autobot run` on a schedule, and uploads the transcript as an artifact —
including when the run fails, which is when you want it.

## Writing a tool

A tool is a plain function. The decorator derives the JSON Schema from the
signature, type hints and docstring, so one definition serves both policies —
`ClaudePolicy` sends that schema to the API verbatim.

```python
from pathlib import Path

from autobot import tool, ToolContext

@tool
def count_lines(ctx: ToolContext, path: str, skip_blank: bool = False) -> str:
    """Count the lines in a file.

    Args:
        path: Path relative to the workspace root.
        skip_blank: Ignore empty lines.
    """
    lines = (Path(ctx.workspace) / path).read_text().splitlines()
    return str(len([x for x in lines if x.strip() or not skip_blank]))
```

`path` becomes required, `skip_blank` optional; the `ctx` parameter is injected
and never exposed to the model. Register it with
`build_registry(config, extra_tools=[count_lines])`.

Built-ins: `finish`, `current_time`, `read_file`, `write_file`, `list_dir`,
`http_get`, `remember`, `recall`, `append_json_line`, and `run_command`
(dangerous, off by default). The Pinterest integration adds
`pinterest_list_boards` and `pinterest_create_pin` (also dangerous) — see below.

## Writing a policy

Anything with a `propose` method works:

```python
from autobot import Action, BasePolicy

class AlwaysFinish(BasePolicy):
    def propose(self, goal, steps, registry):
        return Action(tool="finish", args={"summary": "nothing to do"})
```

Optional hooks: `reset(goal, registry)` before a run, `observe(step)` after each
step. `ClaudePolicy` uses both to mirror the conversation — the assistant turn
goes in on `propose`, the matching `tool_result` on `observe`.

## Tasks and playbooks

Tasks live in `autobot.yaml`. A playbook entry is a tool call, and string
arguments can reference earlier results:

```yaml
tasks:
  - name: heartbeat
    objective: Record that the bot is alive.
    interval_s: 900
    max_steps: 6
    playbook:
      - tool: current_time
      - tool: write_file
        args:
          path: runs/status.txt
          content: "autobot heartbeat ok at {{last_output}}"
      - tool: finish
        args:
          summary: Heartbeat recorded.
```

Templates: `{{last_output}}`, `{{steps[N].output}}`, `{{steps[N].error}}`,
`{{context.key}}`, `{{env.NAME}}`.

A fixed plan can't recover from a failed step, and later steps usually depend on
earlier ones, so the first failure aborts the run rather than marching on and
reporting success. Pass `stop_on_failure=False` for genuinely independent steps.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `policy` | `rule` | `rule` or `claude` |
| `workspace` | `.` | Filesystem tools are confined to this directory |
| `journal_dir` | `runs` | Where per-run JSONL transcripts land |
| `model` / `effort` / `max_tokens` | `claude-opus-5` / `high` / `16000` | Claude policy only |
| `allowed_domains` | `[]` | Hosts `http_get` may reach; empty means unrestricted |
| `allow_dangerous_tools` | `false` | Gate on `run_command` and friends |
| `failure_limit` | `3` | Consecutive failed steps before giving up |

Every key has an `AUTOBOT_*` environment override (`AUTOBOT_POLICY`,
`AUTOBOT_WORKSPACE`, `AUTOBOT_MODEL`, `AUTOBOT_ALLOWED_DOMAINS`,
`AUTOBOT_ALLOW_DANGEROUS_TOOLS`, …), which is how the workflow switches policy
without editing the file.

## Safety

Nothing here is reviewed by a human before it runs, so the defaults are closed:

- **Filesystem** access is confined to the workspace root; `../` traversal and
  absolute paths outside it are refused.
- **Network** access is limited to `allowed_domains`, and only `http`/`https`.
- **Dangerous tools** (`run_command`) are hidden until `allow_dangerous_tools`
  is on. It runs without a shell, so no pipes or redirection.
- **Budgets** are hard stops: max steps, wall-clock deadline, and a consecutive
  failure limit that ends a run that's looping rather than working.
- **Every run is auditable** — steps are flushed to the journal as they happen,
  so a run killed mid-flight still leaves a readable trail.

## Pinterest

The bot can publish image pins through the [Pinterest API v5](https://developers.pinterest.com/docs/api/v5/)
(`POST /pins`, `GET /boards`). It calls the REST API directly, so it works the
same as a daemon or in a GitHub Actions job.

### Setup

1. Create an app at [developers.pinterest.com](https://developers.pinterest.com/),
   and get an OAuth access token with the **`pins:write`** and **`boards:read`**
   scopes.
2. Export it — it is never read from the config file:

   ```bash
   export PINTEREST_ACCESS_TOKEN='...'
   ```
3. Check what the bot sees:

   ```bash
   python -m autobot.cli doctor
   ```
4. Verify the credentials without publishing anything, by enabling the
   read-only `pinterest-boards` task and running it:

   ```bash
   python -m autobot.cli run pinterest-boards
   ```

### Publishing is off by default, three times over

Posting is public and the bot cannot take a pin back, so reaching Pinterest for
real needs three separate, deliberate switches:

| Gate | Default | To publish |
|---|---|---|
| `pinterest.dry_run` | `true` | set to `false` |
| `allow_dangerous_tools` | `false` | set to `true` (`pinterest_create_pin` is a dangerous tool) |
| the `pinterest-post` task | `enabled: false` | set to `true` |

In dry-run the full request is built, validated and logged — you can read
exactly what *would* have been posted — but nothing is sent. Watch a few dry
runs and agree with them before flipping anything.

`AUTOBOT_PINTEREST_DRY_RUN=true` forces dry-run on regardless of the config
file. It can only turn the safety **on**, never off, so a scheduled job can be
made incapable of publishing.

`pinterest.max_pins_per_run` (default 5) caps how many pins a single run can
create, whatever the policy decides to do. Dry-run pins count against it, so the
cap behaves identically in both modes.

### Supplying images

`create_pin` takes an `image_url`: Pinterest fetches the image itself, so it must
be a **public https URL**. Local paths and `http://` are rejected up front.
Generating or hosting those images is not part of this framework — the
`pinterest-post` task reads them from a `pins/queue.jsonl` queue that something
upstream fills.

### Rate limits and platform rules

Pinterest rate-limits the API (HTTP 429, which the client reports as a retryable
error) and its spam policy restricts bulk automated posting, particularly of
generated content. Keep the cadence conservative and make sure what you post
complies — the per-run cap and the daily task interval are set low deliberately.

## Credentials

The `claude` policy and the Pinterest integration each need their own. For
Pinterest see above. For Claude, the SDK resolves `ANTHROPIC_API_KEY`, then
`ANTHROPIC_AUTH_TOKEN`, then an `ant auth login` profile — so an unset API key
doesn't mean no credentials. `autobot doctor` reports what it found.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/ -q
```

164 tests, no network and no credentials required — the Claude policy is tested
against a fake client that asserts the request shape (model, tool schemas,
adaptive thinking, refusal fallbacks) and the handling of tool calls, refusals,
parallel calls and API errors.
