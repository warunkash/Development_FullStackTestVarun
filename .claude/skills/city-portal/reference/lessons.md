# Lessons from the Warangal build

**Environment**
- The sandbox's outbound proxy and geo-blocking make most Indian government hosts return connection reset (curl 000). That is not a dead link. 20 of 45 initial sites "failed" there; GitHub Actions' first run found NIT Warangal and India.gov.in fine. Always say what the status means.
- `curl` can be flaky on a host that WebFetch reads fine; retry 3×, then use WebFetch to read it.
- Node ≥ 22 can use the proxy with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`; plain `node` fetch hangs.
- GitHub: tools are MCP-only (no `gh`); default branch was `master`; PR creation failed once because base `main` did not exist.
- Run a Workflow only after it is merged to the default branch; it takes 1–3 minutes (retries on unreachable sites). A "wait" timer finishing is not the workflow finishing: check the run.

**Content**
- Official district-site navigation gave 29 good, verified entries at once; web searches gave few. Start there.
- Services get replaced (Dharani → Bhu Bharati, TS → TG domains). Verify names with a news/official source and mention the change.
- Some 404s are real (india.gov.in district directory pages): drop or fix; do not keep.
- Helpline conflicts exist (SHE Team WhatsApp numbers): omit conflicting ones.
- Keep non-government sites (private colleges) out; the portal's promise is official sites.
- Machine-drafted Telugu is acceptable only with an explicit review caveat.

**Engineering**
- One Pages site per repo: extend the existing workflow, put the portal under `/<slug>-portal/`.
- Keep everything static and dependency-free; no build step; works from `file://`.
- `validate.js` caught missing labels in the translation map. Run it every time; run a headless browser check for language switch, grouping and search.
- A weekly job should report **changes** (404s, regressions of `ok`, recoveries) and never rewrite data itself, because the runner's location skews results.
- Off-by-one when slicing JSON by hand (`"status": "` is 11 chars) wasted a commit: use `check-links.js --update` or parse JSON, not string offsets.

**Process**
- Ship in small PRs: base portal → grouping/status → language + Pages → local sites → weekly check → status fixes. After each merge confirm the deploy and URL.
- Be explicit about what is verified vs sourced vs guessed in every PR body and final message.
