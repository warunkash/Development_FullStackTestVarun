// Guards the boards: every mode derives its board from a seed, so a given day / week / month / lesson must keep producing exactly the same
// tubes (and the same size and mode info) after any refactor. Run from this folder:
//   npm i -g playwright   (once; any Chromium works)   then   node golden.js check      -> compares with golden.json
//                                                            node golden.js update     -> rewrites golden.json (only when a change is intended)
// The sample keys use today's date, so `update` the baseline whenever you run it on a new day, or compare two builds on the same day.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const mode = process.argv[2] || 'check';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  const out = await page.evaluate(() => {
    const res = {};
    const rec = (name, lv, setup) => {
      if (setup) setup();
      let g; try { g = generate(lv); } catch (e) { g = 'ERR ' + e.message; }
      const info = specialInfo(lv);
      res[name] = { g: JSON.stringify(g), colors: colorsFor(lv), cap: capFor(lv), cap2: CAP, info: info ? JSON.stringify(info, (k, v) => typeof v === 'function' ? 'fn:' + v.length : v) : null };
    };
    for (let l = 1; l <= 40; l++) rec('normal' + l, l);
    rec('daily', dailyKey()); rec('weekly', weekKey()); rec('monthly', monthKey()); rec('yearly', yearKey()); rec('seasonal', seasonKey()); rec('lifetime', LIFETIME_MIN);
    for (const c of [[3, 4, 1, 0], [10, 6, 2, 99999], [6, 5, 3, 48213], [8, 4, 2, 7]]) rec('custom' + c, customKey(...c));
    rec('team', teamKey());
    for (let r = 1; r <= 5; r++) rec('tour' + r, tournKey(), () => { tourRound = r; });
    for (let r = 1; r <= 3; r++) rec('bracket' + r, bracketKey(), () => { bracketRound = r; });
    for (let r = 1; r <= 24; r++) rec('ladder' + r, ladderKey(), () => { ladderRung = r; });
    rec('guild', guildKey()); rec('clan', clanKey());
    for (let l = 1; l <= 6; l++) rec('coach' + l, COACH_MIN + l);
    rec('mentor', mentorKey());
    return res;
  });
  await browser.close();
  const file = path.join(__dirname, 'golden.json');
  if (mode === 'update') { fs.writeFileSync(file, JSON.stringify(out)); console.log('wrote', Object.keys(out).length, 'entries'); return; }
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = Object.keys(out).filter(k => JSON.stringify(out[k]) !== JSON.stringify(base[k]));
  if (bad.length) { console.error('boards changed for:', bad.join(', ')); process.exit(1); }
  console.log('all', Object.keys(out).length, 'boards unchanged');
})();
