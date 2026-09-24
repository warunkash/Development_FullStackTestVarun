/* PlayEarn — play short brain games, earn coins, skip the scroll.
 * Everything runs client-side; state lives in localStorage.
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const CONFIG = {
    coinsPerRupee: 100,      // demo conversion rate: 100 coins = ₹1
    dailyCap: 600,           // max coins from games per day (keeps it a healthy break)
    minRedeem: 5000,         // coins needed to request a payout
    breakAfterMin: 20,       // nudge the user to take a break after this many minutes
  };
  const STORAGE_KEY = "playearn:v1";

  // ---------- State ----------
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const defaultState = () => ({
    coins: 0, lifetime: 0,
    streak: 0, lastBonusDay: null,
    earnedDay: today(), earnedToday: 0,
    best: {}, history: [], redemptions: [],
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    } catch {
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }
  function rollDay() {
    if (state.earnedDay !== today()) {
      state.earnedDay = today();
      state.earnedToday = 0;
    }
  }

  function log(label, amount) {
    state.history.unshift({ label, amount, at: Date.now() });
    state.history = state.history.slice(0, 50);
  }

  /** Credits game coins, respecting the daily cap. Returns coins actually credited. */
  function earn(amount, label) {
    rollDay();
    const room = Math.max(0, CONFIG.dailyCap - state.earnedToday);
    const credited = Math.max(0, Math.min(Math.round(amount), room));
    if (credited > 0) {
      state.coins += credited;
      state.lifetime += credited;
      state.earnedToday += credited;
      log(label, credited);
      save();
    }
    render();
    return credited;
  }

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  };
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const rupees = (coins) => "₹" + (coins / CONFIG.coinsPerRupee).toFixed(2);

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function modal(html) {
    $("#modalBody").innerHTML = html;
    $("#modal").classList.remove("hidden");
  }
  $("#modalClose").addEventListener("click", () => $("#modal").classList.add("hidden"));

  // ---------- Navigation ----------
  let currentGame = null;
  function show(view) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    document.querySelectorAll(".bottombar button").forEach((b) => b.classList.toggle("active", b.dataset.nav === view));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-nav]").forEach((b) =>
    b.addEventListener("click", () => { stopGame(); show(b.dataset.nav); })
  );

  // ---------- Rendering ----------
  function render() {
    rollDay();
    $("#coinCount").textContent = state.coins;
    $("#homeCoins").textContent = state.coins;
    $("#homeValue").textContent = rupees(state.coins);
    $("#walletCoins").textContent = state.coins;
    $("#walletValue").textContent = rupees(state.coins);
    $("#lifetime").textContent = state.lifetime;
    $("#todayEarned").textContent = state.earnedToday;
    $("#dailyCap").textContent = CONFIG.dailyCap;
    $("#todayBar").style.width = Math.min(100, (state.earnedToday / CONFIG.dailyCap) * 100) + "%";
    $("#streak").textContent = state.streak;
    $("#minRedeem").textContent = CONFIG.minRedeem;

    const claimed = state.lastBonusDay === today();
    $("#claimBonus").disabled = claimed;
    $("#claimBonus").textContent = claimed ? "Claimed ✓" : `+${bonusAmount()}`;
    $("#bonusText").textContent = claimed
      ? "Come back tomorrow to keep your streak alive."
      : "Tap to claim today's reward. Streaks boost it!";

    const hist = $("#history");
    hist.innerHTML = "";
    if (!state.history.length) hist.append(el("li", {}, el("span", { class: "muted" }, "No activity yet — go play a game!")));
    for (const h of state.history) {
      hist.append(
        el("li", {},
          el("span", {}, h.label, el("br"), el("small", { class: "muted" }, new Date(h.at).toLocaleString())),
          el("span", { class: h.amount >= 0 ? "plus" : "minus" }, (h.amount >= 0 ? "+" : "") + h.amount)
        )
      );
    }
  }

  // ---------- Daily bonus ----------
  function bonusAmount() {
    const nextStreak = state.lastBonusDay === yesterday() ? state.streak + 1 : 1;
    return Math.min(100, 20 + (nextStreak - 1) * 10);
  }
  $("#claimBonus").addEventListener("click", () => {
    if (state.lastBonusDay === today()) return;
    const amount = bonusAmount();
    state.streak = state.lastBonusDay === yesterday() ? state.streak + 1 : 1;
    state.lastBonusDay = today();
    // The daily bonus doesn't count toward the game cap.
    state.coins += amount;
    state.lifetime += amount;
    log(`Daily bonus (day ${state.streak})`, amount);
    save();
    render();
    toast(`🎁 +${amount} coins!`);
  });

  // ---------- Redeem ----------
  $("#redeemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#payoutId").value.trim();
    if (state.coins < CONFIG.minRedeem) {
      toast(`Need ${CONFIG.minRedeem - state.coins} more coins`);
      return;
    }
    if (!/^[\w.\-]+@[\w.\-]+$/.test(id)) {
      toast("Enter a valid UPI ID or email");
      return;
    }
    const amount = state.coins;
    state.coins = 0;
    state.redemptions.push({ id, amount, at: Date.now(), status: "demo" });
    log(`Payout request → ${id}`, -amount);
    save();
    render();
    modal(`<div class="result-emoji">📨</div><div class="title">Request recorded</div>
      <p class="muted">${amount} coins (${rupees(amount)}) logged for <b>${id.replace(/[<>&"]/g, "")}</b>.</p>
      <p class="notice">Demo build: no money is actually sent. Hook up the payout backend described in the README to make this real.</p>`);
    $("#payoutId").value = "";
  });

  // ---------- Games ----------
  const stage = $("#stage");
  const hud = (t) => { $("#gameHud").textContent = t; };
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  function clearTimers() { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; }

  function stopGame() { clearTimers(); currentGame = null; }

  function finish(game, coins, summary) {
    clearTimers();
    const prevBest = state.best[game.id] || 0;
    if (coins > prevBest) state.best[game.id] = coins;
    const credited = earn(coins, game.name);
    const capped = credited < Math.round(coins);
    stage.innerHTML = "";
    stage.append(
      el("div", { class: "result-emoji" }, coins >= game.max * 0.7 ? "🏆" : coins > 0 ? "🎉" : "💪"),
      el("div", { class: "question" }, summary),
      el("p", { class: "center" }, `+${credited} coins`),
      capped ? el("p", { class: "center notice" }, "Daily game limit reached — see you tomorrow! Nice work today.") : "",
      coins > prevBest && prevBest > 0 ? el("p", { class: "center muted" }, "New personal best!") : "",
      el("div", { class: "stack" },
        el("button", { class: "btn block", onclick: () => startGame(game) }, "Play again"),
        el("button", { class: "btn ghost block", onclick: () => { stopGame(); show("home"); } }, "Back to games")
      )
    );
    hud("");
    if (credited > 0) toast(`🪙 +${credited} coins`);
  }

  // --- 1. Trivia ---
  const TRIVIA = [
    ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"]],
    ["How many bones are in the adult human body?", ["206", "196", "212", "180"]],
    ["What is the largest ocean on Earth?", ["Pacific", "Atlantic", "Indian", "Arctic"]],
    ["Who wrote 'Romeo and Juliet'?", ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"]],
    ["What gas do plants absorb from the air?", ["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"]],
    ["What is the capital of Australia?", ["Canberra", "Sydney", "Melbourne", "Perth"]],
    ["How many sides does a hexagon have?", ["6", "5", "7", "8"]],
    ["Which is the smallest prime number?", ["2", "1", "3", "0"]],
    ["What is the chemical symbol for gold?", ["Au", "Ag", "Gd", "Go"]],
    ["Which country hosted the first modern Olympics (1896)?", ["Greece", "France", "USA", "UK"]],
    ["What is the fastest land animal?", ["Cheetah", "Lion", "Pronghorn", "Horse"]],
    ["Which organ pumps blood through the body?", ["Heart", "Liver", "Lungs", "Kidney"]],
    ["What is the longest river in the world (commonly cited)?", ["Nile", "Amazon", "Yangtze", "Ganges"]],
    ["What is 15% of 200?", ["30", "15", "25", "35"]],
    ["Which language has the most native speakers?", ["Mandarin Chinese", "English", "Spanish", "Hindi"]],
    ["What is the hardest natural substance?", ["Diamond", "Iron", "Quartz", "Granite"]],
    ["Who painted the Mona Lisa?", ["Leonardo da Vinci", "Michelangelo", "Van Gogh", "Picasso"]],
    ["How many continents are there?", ["7", "5", "6", "8"]],
    ["What is the boiling point of water at sea level in °C?", ["100", "90", "110", "120"]],
    ["Which planet has the most prominent rings?", ["Saturn", "Uranus", "Neptune", "Jupiter"]],
    ["In which year did humans first land on the Moon?", ["1969", "1972", "1965", "1959"]],
    ["What is the national animal of India?", ["Tiger", "Lion", "Elephant", "Peacock"]],
    ["What does CPU stand for?", ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"]],
    ["Which vitamin do we get from sunlight?", ["Vitamin D", "Vitamin C", "Vitamin A", "Vitamin B12"]],
    ["What is the square root of 144?", ["12", "14", "11", "16"]],
    ["Which is the largest mammal?", ["Blue whale", "Elephant", "Giraffe", "Orca"]],
    ["What currency is used in Japan?", ["Yen", "Won", "Yuan", "Ringgit"]],
    ["How many minutes are in a day?", ["1440", "1240", "1600", "1080"]],
  ];

  function trivia(game) {
    const qs = shuffle(TRIVIA).slice(0, 6);
    let i = 0, correct = 0;
    const next = () => {
      clearTimers();
      if (i >= qs.length) return finish(game, correct * 12, `${correct} / ${qs.length} correct`);
      const [q, opts] = qs[i];
      const answer = opts[0];
      hud(`Q${i + 1}/${qs.length} · ✅ ${correct}`);
      const bar = el("div");
      const optsEl = el("div", { class: "options" });
      let locked = false;
      const pick = (btn, choice) => {
        if (locked) return;
        locked = true;
        clearTimers();
        const right = choice === answer;
        if (right) correct++;
        optsEl.querySelectorAll(".opt").forEach((b) => {
          if (b.textContent === answer) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });
        i++;
        later(next, 900);
      };
      for (const o of shuffle(opts)) {
        const b = el("button", { class: "opt" }, o);
        b.addEventListener("click", () => pick(b, o));
        optsEl.append(b);
      }
      stage.innerHTML = "";
      stage.append(el("div", { class: "timer" }, bar), el("div", { class: "question" }, q), optsEl);
      const limit = 15000, t0 = Date.now();
      every(() => {
        const left = Math.max(0, limit - (Date.now() - t0));
        bar.style.width = (left / limit) * 100 + "%";
        if (left === 0) pick(null, null);
      }, 100);
    };
    next();
  }

  // --- 2. Math Sprint ---
  function mathSprint(game) {
    let score = 0, q;
    const duration = 45;
    const t0 = Date.now();
    const input = el("input", { type: "number", inputmode: "numeric", class: "big-answer", placeholder: "?" });
    const qEl = el("div", { class: "question" });
    const make = () => {
      const op = ["+", "−", "×"][rand(0, 2)];
      let a, b, ans;
      if (op === "+") { a = rand(5, 60); b = rand(5, 60); ans = a + b; }
      else if (op === "−") { a = rand(20, 99); b = rand(1, a); ans = a - b; }
      else { a = rand(2, 12); b = rand(2, 12); ans = a * b; }
      q = { text: `${a} ${op} ${b}`, ans };
      qEl.textContent = q.text + " = ?";
      input.value = "";
    };
    input.addEventListener("input", () => {
      if (Number(input.value) === q.ans) { score++; make(); }
    });
    stage.innerHTML = "";
    stage.append(
      el("p", { class: "muted center" }, "Type the answer — it auto-submits when correct."),
      qEl, input,
      el("button", { class: "btn ghost block", style: "margin-top:12px", onclick: () => make() }, "Skip")
    );
    make();
    input.focus();
    const tick = () => {
      const left = Math.max(0, duration - Math.floor((Date.now() - t0) / 1000));
      hud(`⏱ ${left}s · ✅ ${score}`);
      if (left === 0) finish(game, score * 5, `${score} solved in ${duration}s`);
    };
    tick();
    every(tick, 250);
  }

  // --- 3. Memory Match ---
  function memory(game) {
    const icons = shuffle(["🍕", "🚀", "🎸", "🐼", "🌵", "⚽", "🍩", "🦄", "🎲", "🌈", "🐙", "🍉"]).slice(0, 8);
    const deck = shuffle([...icons, ...icons]);
    let open = [], moves = 0, found = 0, busy = false;
    const grid = el("div", { class: "memory" });
    const update = () => hud(`Moves ${moves} · ${found}/8`);
    deck.forEach((icon) => {
      const c = el("button", { class: "mcard", "aria-label": "card" }, icon);
      c.addEventListener("click", () => {
        if (busy || c.classList.contains("open") || c.classList.contains("done")) return;
        c.classList.add("open");
        open.push(c);
        if (open.length === 2) {
          moves++;
          const [a, b] = open;
          if (a.textContent === b.textContent) {
            a.classList.replace("open", "done");
            b.classList.replace("open", "done");
            open = [];
            found++;
            if (found === 8) later(() => finish(game, Math.max(20, 110 - (moves - 8) * 6), `Cleared in ${moves} moves`), 400);
          } else {
            busy = true;
            later(() => { a.classList.remove("open"); b.classList.remove("open"); open = []; busy = false; }, 700);
          }
        }
        update();
      });
      grid.append(c);
    });
    stage.innerHTML = "";
    stage.append(el("p", { class: "muted center" }, "Find all 8 pairs in as few moves as possible."), grid);
    update();
  }

  // --- 4. Reaction Tap ---
  function reaction(game) {
    const rounds = 5;
    let round = 0, times = [], goAt = 0, phase = "idle";
    const pad = el("div", { class: "react-pad idle" }, "Tap to start");
    const setPad = (cls, text) => { pad.className = "react-pad " + cls; pad.textContent = text; };
    const arm = () => {
      phase = "wait";
      setPad("wait", "Wait for green…");
      later(() => { phase = "go"; goAt = performance.now(); setPad("go", "TAP!"); }, rand(1200, 3500));
    };
    pad.addEventListener("pointerdown", () => {
      if (phase === "idle") return arm();
      if (phase === "wait") {
        clearTimers();
        phase = "idle";
        setPad("idle", "Too early! Tap to retry this round");
        return;
      }
      if (phase === "go") {
        const ms = Math.round(performance.now() - goAt);
        times.push(ms);
        round++;
        hud(`Round ${round}/${rounds}`);
        if (round >= rounds) {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          // ~200ms avg earns max, 500ms+ earns the minimum.
          const coins = Math.round(Math.max(15, Math.min(90, 90 - ((avg - 200) / 300) * 75)));
          phase = "done";
          return finish(game, coins, `Average reaction: ${avg} ms`);
        }
        phase = "idle";
        setPad("idle", `${ms} ms — tap for next round`);
      }
    });
    stage.innerHTML = "";
    stage.append(el("p", { class: "muted center" }, "Tap as soon as the pad turns green. 5 rounds."), pad);
    hud(`Round 0/${rounds}`);
  }

  // --- 5. Word Scramble ---
  const WORDS = [
    "PLANET", "GUITAR", "PUZZLE", "ROCKET", "COFFEE", "JUNGLE", "WALLET", "BRIDGE", "CAMERA", "DRAGON",
    "FOREST", "GARDEN", "HAMMER", "ISLAND", "KITTEN", "LEMON", "MARKET", "NEEDLE", "ORANGE", "PENCIL",
    "SUMMER", "TICKET", "VIOLIN", "WINDOW", "YELLOW", "ZIPPER", "BUTTER", "CASTLE", "DINNER", "FLOWER",
  ];
  function scramble(game) {
    const words = shuffle(WORDS).slice(0, 5);
    let i = 0, solved = 0;
    const duration = 90, t0 = Date.now();
    const wEl = el("div", { class: "scramble" });
    const input = el("input", { class: "big-answer", autocapitalize: "characters", autocomplete: "off", placeholder: "Your guess" });
    const hint = el("p", { class: "muted center" });
    const mix = (w) => { let s; do { s = shuffle(w.split("")).join(""); } while (s === w); return s; };
    const nextWord = () => {
      if (i >= words.length) return finish(game, solved * 18, `${solved} / ${words.length} words unscrambled`);
      wEl.textContent = mix(words[i]);
      hint.textContent = `Starts with "${words[i][0]}" · ${words[i].length} letters`;
      input.value = "";
      input.focus();
    };
    input.addEventListener("input", () => {
      if (input.value.trim().toUpperCase() === words[i]) { solved++; i++; nextWord(); }
    });
    stage.innerHTML = "";
    stage.append(
      el("p", { class: "muted center" }, "Unscramble the word. Auto-submits when correct."),
      wEl, hint, input,
      el("button", { class: "btn ghost block", style: "margin-top:12px", onclick: () => { i++; nextWord(); } }, "Skip")
    );
    nextWord();
    const tick = () => {
      const left = Math.max(0, duration - Math.floor((Date.now() - t0) / 1000));
      if (i < words.length) hud(`⏱ ${left}s · ✅ ${solved}`);
      if (left === 0 && i < words.length) finish(game, solved * 18, `${solved} / ${words.length} words unscrambled`);
    };
    tick();
    every(tick, 250);
  }

  const GAMES = [
    { id: "trivia", name: "Quick Trivia", emoji: "🧠", desc: "6 questions, 15s each", max: 72, play: trivia },
    { id: "math", name: "Math Sprint", emoji: "➗", desc: "Solve as many as you can in 45s", max: 100, play: mathSprint },
    { id: "memory", name: "Memory Match", emoji: "🃏", desc: "Find 8 pairs, fewer moves = more coins", max: 110, play: memory },
    { id: "reaction", name: "Reflex Tap", emoji: "⚡", desc: "Test your reaction speed", max: 90, play: reaction },
    { id: "scramble", name: "Word Scramble", emoji: "🔤", desc: "Unscramble 5 words in 90s", max: 90, play: scramble },
  ];

  function startGame(game) {
    stopGame();
    currentGame = game;
    $("#gameTitle").textContent = `${game.emoji} ${game.name}`;
    show("game");
    game.play(game);
  }
  $("#quitGame").addEventListener("click", () => { stopGame(); show("home"); });

  const grid = $("#gameGrid");
  for (const g of GAMES) {
    grid.append(
      el("button", { class: "game-tile", onclick: () => startGame(g) },
        el("span", { class: "emoji" }, g.emoji),
        el("span", { class: "name" }, g.name),
        el("span", { class: "desc" }, g.desc),
        el("span", { class: "reward" }, `up to ${g.max} 🪙`)
      )
    );
  }

  // ---------- Real-money options ----------
  const REAL = [
    ["Google Opinion Rewards", "Answer quick 10-second surveys; earn Play Store / PayPal credit.", "Surveys", "https://surveys.google.com/google-opinion-rewards/"],
    ["Prolific", "Take part in academic research studies — among the best-paying survey sites.", "Research", "https://www.prolific.com/"],
    ["UserTesting", "Record yourself trying out apps and websites and share feedback.", "Testing", "https://www.usertesting.com/get-paid-to-test"],
    ["Swagbucks", "Surveys, short videos and games for points redeemable for cash/gift cards.", "Rewards", "https://www.swagbucks.com/"],
    ["Duolingo / Chess.com etc.", "Not paid — but also not a mindless feed. Worth it if you want to learn, not earn.", "Learn", "https://www.duolingo.com/"],
  ];
  const realList = $("#realList");
  for (const [name, desc, tag, url] of REAL) {
    realList.append(
      el("li", {},
        el("div", {}, el("b", {}, name), " ", el("span", { class: "tag" }, tag)),
        el("span", { class: "muted" }, desc),
        el("a", { href: url, target: "_blank", rel: "noopener" }, "Open ↗")
      )
    );
  }

  // ---------- Healthy-use nudge ----------
  const sessionStart = Date.now();
  let nudged = false;
  setInterval(() => {
    if (!nudged && Date.now() - sessionStart >= CONFIG.breakAfterMin * 60000) {
      nudged = true;
      modal(`<div class="result-emoji">🌿</div><div class="title">${CONFIG.breakAfterMin} minutes in!</div>
        <p class="muted">Great session. Maybe stretch, grab some water, and come back later?</p>`);
    }
  }, 30000);

  // ---------- Boot ----------
  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
