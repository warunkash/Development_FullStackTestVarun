# 🎯 PlayEarn

A phone-first alternative to doom-scrolling: short brain games (1–2 minutes each) that earn you coins.

## Features

| | |
|---|---|
| 🧠 **Quick Trivia** | 6 general-knowledge questions, 15 s each |
| ➗ **Math Sprint** | Solve as many sums as you can in 45 s |
| 🃏 **Memory Match** | Find 8 emoji pairs in as few moves as possible |
| ⚡ **Reflex Tap** | 5-round reaction-time test |
| 🔤 **Word Scramble** | Unscramble 5 words in 90 s |

- **Wallet**: coin balance, a rupee value at a demo rate (100 coins = ₹1), activity history, and a payout request form (UPI / PayPal).
- **Daily bonus + streaks**: the bonus grows by 10 coins for each day in a row, up to 100.
- **Healthy-use limits**: games pay at most 600 coins per day, and after 20 minutes the app suggests taking a break.
- **Real $ tab**: a short list of established apps that pay real money for surveys, research studies, and app testing.
- **Installable & offline**: it's a PWA, so you can add it to your home screen and it works offline.

## Run it

It's plain HTML/CSS/JS with no build step. Serve the folder over HTTP:

```bash
cd playearn
python3 -m http.server 8080
# open http://localhost:8080 (or http://<your-computer-ip>:8080 on your phone, same Wi-Fi)
```

On the phone, open the browser menu → **Add to Home screen** to install it like an app.
**Live version:** https://warunkash.github.io/Development_FullStackTestVarun/. It is deployed by
`.github/workflows/deploy-pages.yml` on every push to `master` that touches `playearn/`.

## ⚠️ About the "paid" part

This build is a **standalone demo**. Coins live in your phone's `localStorage`, and payout requests
are only recorded locally. **No real money is sent.** An app can only pay users if money comes in from
somewhere. The usual sources are:

1. **Rewarded ads** (e.g. AdMob rewarded video): advertisers pay per view, and you share part of it with the user.
2. **Offerwalls / surveys** (e.g. Tapjoy, Pollfish, CPX Research): partners pay for completed surveys or tasks.
3. **Sponsors / brand quizzes**: a brand funds a quiz pool.

To make payouts real you would need:

- A backend (e.g. Supabase or Firebase) with user accounts, so coins are stored server-side and can't be edited in the browser.
- Server-side scoring and anti-cheat, because client-side game scores can be faked.
- A payout provider (e.g. Razorpay Payouts for UPI, PayPal Payouts, or Tremendous for gift cards), plus KYC and tax compliance.

Until then, the **Real $** tab links to established platforms that already pay for short tasks.

## Tweaking

Rates and limits are in the `CONFIG` block at the top of `app.js`:

```js
coinsPerRupee: 100, dailyCap: 600, minRedeem: 5000, breakAfterMin: 20
```
