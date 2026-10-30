#!/usr/bin/env python3
"""Create a new city/district citizen portal from the skill template.

Example:
  python3 -I scaffold.py --out karimnagar-portal --location Karimnagar \
      --local-places "Karimnagar" --state Telangana --lang te:తెలుగు
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "template"
COPY = ["index.html", "lang-en.js", "check-links.js", "validate.js"]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "portal"


def fill(text, mapping):
    for k, v in mapping.items():
        text = text.replace("{{" + k + "}}", v)
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="portal folder to create (relative to the repo root)")
    ap.add_argument("--location", required=True, help="short name used in the title, e.g. Warangal")
    ap.add_argument("--local-places", help="places served, e.g. 'Warangal & Hanumakonda' (default: location)")
    ap.add_argument("--state", required=True, help="state/province name, e.g. Telangana")
    ap.add_argument("--country", default="India")
    ap.add_argument("--local-area", help="area label for local sites (default: location)")
    ap.add_argument("--state-area", help="default: '<state> State'")
    ap.add_argument("--central-area", help="default: '<country> (Central)'")
    ap.add_argument("--lang", action="append", default=[], metavar="CODE:NAME", help="extra language, e.g. te:తెలుగు (repeatable)")
    ap.add_argument("--accent", default="#9a3412")
    ap.add_argument("--accent-dark", default="#fb923c")
    ap.add_argument("--cron", default="17 3 * * 1", help="link-check schedule (UTC cron)")
    ap.add_argument("--workflow-dir", default=".github/workflows", help="where to write the link-check workflow ('' to skip)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    out = Path(a.out)
    if out.exists() and any(out.iterdir()) and not a.force:
        sys.exit(f"{out} exists and is not empty (use --force to overwrite)")
    out.mkdir(parents=True, exist_ok=True)

    langs = [{"code": "en", "name": "English"}]
    for item in a.lang:
        code, _, name = item.partition(":")
        if not code or not name:
            sys.exit(f"--lang expects CODE:NAME, got {item!r}")
        langs.append({"code": code, "name": name})

    local_area = a.local_area or a.location
    state_area = a.state_area or f"{a.state} State"
    central_area = a.central_area or f"{a.country} (Central)"
    m = {
        "LOCATION": a.location, "LOCAL_PLACES": a.local_places or a.location, "STATE": a.state, "COUNTRY": a.country,
        "LOCAL_AREA": local_area, "STATE_AREA": state_area, "CENTRAL_AREA": central_area,
        "ACCENT": a.accent, "ACCENT_DARK": a.accent_dark, "LANGUAGES_JSON": json.dumps(langs, ensure_ascii=False),
        "CRON": a.cron, "DIR": out.as_posix(),
    }

    (out / "config.js").write_text(fill((TEMPLATE / "config.js").read_text(), m))
    (out / "README.md").write_text(fill((TEMPLATE / "README.md").read_text(), m))
    for f in COPY:
        shutil.copy(TEMPLATE / f, out / f)

    sites = []
    for s in json.loads((TEMPLATE / "starter-india.json").read_text()):
        sites.append({"n": s["n"], "d": s["d"], "u": s["u"], "area": central_area, "dept": s["dept"],
                      "sector": s["sector"], "status": s["status"]})
    helplines = json.loads((TEMPLATE / "starter-helplines.json").read_text())
    header = ("// Each site: n title, d purpose, u url, area, dept (department), sector, status, tr.<lang>.{n,d} translations.\n"
              "// status: ok = responded; blocked = answered 401/403/406/429 to automation; down = no response from the\n"
              "// checking environment (may be geo-blocked, not proven dead). Refresh with `node check-links.js --update`.\n"
              "// Starter national entries are for India; replace or delete them for another country.")
    (out / "data.js").write_text(
        f"{header}\nwindow.CHECKED = \"unchecked\";\nwindow.SITES = {json.dumps(sites, indent=1, ensure_ascii=False)};\n"
        f"window.HELPLINES = {json.dumps(helplines, indent=1, ensure_ascii=False)};\n")

    wf = ""
    if a.workflow_dir:
        wd = Path(a.workflow_dir)
        wd.mkdir(parents=True, exist_ok=True)
        wf_path = wd / f"link-check-{slug(a.location)}.yml"
        wf_path.write_text(fill((TEMPLATE / "link-check.yml").read_text(), m))
        wf = f"\n  workflow:  {wf_path}"

    print(f"Created {out}/ with {len(sites)} starter national sites, {len(helplines)} helplines.{wf}")
    print("Areas:", json.dumps([local_area, state_area, central_area], ensure_ascii=False))
    for l in langs[1:]:
        print(f"Next: copy {TEMPLATE}/lang-example.js to {out}/lang-{l['code']}.js and translate it.")
    print(f"Next: add local/state sites to {out}/data.js, then `node {out}/validate.js`.")


if __name__ == "__main__":
    main()
