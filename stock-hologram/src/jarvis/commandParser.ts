import type { Quote } from "../state/types";

interface JarvisContext {
  watchlist: string[];
  quotes: Record<string, Quote>;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  select: (symbol: string | null) => void;
}

const TICKER = "([A-Za-z]{1,5})";

function fmtQuote(symbol: string, quote: Quote | undefined): string {
  if (!quote) return `I don't have live data for ${symbol} yet.`;
  const dir = quote.changePct >= 0 ? "up" : "down";
  return `${symbol} is trading at $${quote.price.toFixed(2)}, ${dir} ${Math.abs(quote.changePct).toFixed(2)}% today.`;
}

export function handleCommand(rawInput: string, ctx: JarvisContext): string {
  const input = rawInput.trim();
  const lower = input.toLowerCase();

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return "At your service. Try 'show TSLA', 'add NVDA to watchlist', or 'market status'.";
  }

  if (/^help\b/.test(lower) || lower === "?") {
    return [
      "I can respond to:",
      "'show <TICKER>' — bring a panel to focus",
      "'add <TICKER>' / 'remove <TICKER>' — manage the watchlist",
      "'compare <TICKER> and <TICKER>'",
      "'price of <TICKER>' or 'how is <TICKER> doing'",
      "'market status' or 'top gainer' / 'biggest loser'",
    ].join(" ");
  }

  if (/^(market status|how are we doing|overview)\b/.test(lower)) {
    const values = ctx.watchlist.map((sym) => ctx.quotes[sym]?.changePct ?? 0);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const tone = avg >= 0 ? "in the green" : "under pressure";
    return `Watchlist is ${tone}, averaging ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}% across ${ctx.watchlist.length} names.`;
  }

  if (/^(top gainer|biggest gainer|whos up|who's up)\b/.test(lower)) {
    const best = bestBy(ctx, (a, b) => b - a);
    return best ? `Leading the board: ${fmtQuote(best.symbol, best.quote)}` : "No data yet.";
  }

  if (/^(biggest loser|whos down|who's down)\b/.test(lower)) {
    const worst = bestBy(ctx, (a, b) => a - b);
    return worst ? `Lagging the board: ${fmtQuote(worst.symbol, worst.quote)}` : "No data yet.";
  }

  const compareMatch = lower.match(new RegExp(`compare ${TICKER}\\s*(?:and|vs\\.?|,)?\\s*${TICKER}`));
  if (compareMatch) {
    const [, aRaw, bRaw] = compareMatch;
    const a = aRaw.toUpperCase();
    const b = bRaw.toUpperCase();
    const qa = ctx.quotes[a];
    const qb = ctx.quotes[b];
    if (!qa || !qb) return `I need both tickers on the watchlist to compare them. Try 'add ${a}' or 'add ${b}' first.`;
    const leader = qa.changePct === qb.changePct ? null : qa.changePct > qb.changePct ? a : b;
    return `${a}: ${qa.changePct >= 0 ? "+" : ""}${qa.changePct.toFixed(2)}% vs ${b}: ${qb.changePct >= 0 ? "+" : ""}${qb.changePct.toFixed(2)}%.${leader ? ` ${leader} is outperforming.` : " Dead even."}`;
  }

  const addMatch = lower.match(new RegExp(`^(?:add|watch|track)\\s+${TICKER}`));
  if (addMatch) {
    const symbol = addMatch[1].toUpperCase();
    ctx.addSymbol(symbol);
    ctx.select(symbol);
    return `${symbol} added to the board.`;
  }

  const removeMatch = lower.match(new RegExp(`^(?:remove|drop|untrack)\\s+${TICKER}`));
  if (removeMatch) {
    const symbol = removeMatch[1].toUpperCase();
    ctx.removeSymbol(symbol);
    return `${symbol} removed from the board.`;
  }

  const showMatch = lower.match(new RegExp(`^(?:show|select|pull up|focus)\\s+${TICKER}`));
  if (showMatch) {
    const symbol = showMatch[1].toUpperCase();
    if (!ctx.watchlist.includes(symbol)) ctx.addSymbol(symbol);
    ctx.select(symbol);
    return `Bringing up ${symbol}. ${fmtQuote(symbol, ctx.quotes[symbol])}`;
  }

  const priceMatch =
    lower.match(new RegExp(`(?:price of|how is|how's|what's|whats)\\s+${TICKER}`)) ??
    lower.match(new RegExp(`^${TICKER}$`));
  if (priceMatch) {
    const symbol = priceMatch[1].toUpperCase();
    if (!ctx.watchlist.includes(symbol)) ctx.addSymbol(symbol);
    return fmtQuote(symbol, ctx.quotes[symbol]);
  }

  return "I didn't catch a command in that. Say 'help' to see what I can do.";
}

function bestBy(ctx: JarvisContext, comparator: (a: number, b: number) => number) {
  let winner: { symbol: string; quote: Quote } | null = null;
  for (const symbol of ctx.watchlist) {
    const quote = ctx.quotes[symbol];
    if (!quote) continue;
    if (!winner || comparator(quote.changePct, winner.quote.changePct) > 0) {
      winner = { symbol, quote };
    }
  }
  return winner;
}
