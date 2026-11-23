// The token radar's model (radar-4): one snapshot of the protocol universe in, one ranked
// board out.
//
// The board is every protocol that records no token AND is not a wrapped, staked or bridged
// product of a token that already trades, by the same rule the watchlist uses: no market cap,
// no CoinGecko id, no symbol; category not Bridge, Canonical Bridge, Liquid Staking, Liquid
// Restaking, Restaked BTC or CEX; name with no version marker, no whole word wrapped /
// staked / staking, and not beginning with an exchange's name. That keeps WBTC, staked ETH
// and the bridges out of a board about tokens that do not exist yet: they are a token that
// already trades, in another form. The watchlist is the floor (every one of its 40 slugs is
// on the board); the early rows are the 158 protocols below the $50M floor that pass the
// same rule. Live-token protocols are kept apart and shown with their market caps, never
// mixed into the ranking.
//
// Implied value follows only from the snapshot's own figures:
//
//   catMult      = the median market-cap/TVL of live-token protocols in the same category,
//                  computed from this snapshot (fewer than 3 live protocols in the
//                  category: the global median), clamped to [0.05, 1.0]
//   sizeMult     = clamp((tvl_usd / 1e8)^-0.12, 0.6, 1.4)
//   growthMult   = 1 + 0.5 x sign(g) x ln(1+|g|) / ln(101), g = clamp(change_7d, -70, 500)
//   maturityMult = 0.7 + 0.5 x (1 - exp(-age_days / 365)), unknown age counts as 180 days
//   chainMult    = 1 + 0.02 x min(chains - 1, 8)
//   implied      = max(1, round(tvl_usd x catMult x sizeMult x growthMult x maturityMult
//                        x chainMult))
//
// The category multiple is the model's edge: it is what the live market actually pays for
// that kind of protocol, read off the snapshot's own live-token rows, not a guessed number.
// The size factor makes implied value grow slower than TVL, so a mid-size fast grower can
// outrank a giant. The growth factor is smooth and bounded, so a +4,448% week cannot break
// the board. Maturity rises with the time a protocol has run with real TVL and no token on
// record, and saturates after about three years. No protocol name is ever special-cased:
// the same function scores every row, and the dashboard recomputes each row from the same
// figures and shows every multiplier.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Live protocols needed in a category before its own median is used. */
  category_min_live: number;
  /** The category multiple's clamp. */
  category_floor: number;
  category_cap: number;
  /** The size factor's exponent, reference TVL and clamp. */
  size_exponent: number;
  size_ref_usd: number;
  size_floor: number;
  size_cap: number;
  /** The growth factor's weight, clamp and log scale. */
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  growth_scale: number;
  /** The maturity factor's floor, range, time constant and unknown-age stand-in. */
  maturity_floor: number;
  maturity_range: number;
  maturity_tau_days: number;
  unknown_age_days: number;
  /** The chain factor's step per extra chain, and how many extra chains count. */
  chain_step: number;
  chain_max_extra: number;
}

export const MODEL: ModelConstants = {
  category_min_live: 3,
  category_floor: 0.05,
  category_cap: 1.0,
  size_exponent: 0.12,
  size_ref_usd: 100_000_000,
  size_floor: 0.6,
  size_cap: 1.4,
  growth_weight: 0.5,
  growth_floor: -70,
  growth_cap: 500,
  growth_scale: 100,
  maturity_floor: 0.7,
  maturity_range: 0.5,
  maturity_tau_days: 365,
  unknown_age_days: 180,
  chain_step: 0.02,
  chain_max_extra: 8,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_live_n: number;
    size_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page regenerates the farm plan from it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_live_n: number;
  size_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's multiple, as the dashboard's methodology table shows it. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  live_n: number;
  from_global: boolean;
}

/** Everything the dashboard needs: the board, the live set, the model and its multiples. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  category_multiples: CategoryMultiple[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list, else null. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** A number clamped to [`lo`, `hi`]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** A name carrying a whole word wrapped, staked or staking. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: it records no token, and it is not a
 * wrapped, staked or bridged product of a token that already trades, by the watchlist's
 * own rule. A protocol whose category is null is kept: the rule only excludes the named
 * categories, and a null category names no wrapped product.
 */
export function isBoardEligible(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/**
 * The category multiples, read off the snapshot's own live-token rows: for each category,
 * the median market-cap/TVL of its live-token protocols, when at least
 * `model.category_min_live` of them exist; otherwise the global median. Every multiple is
 * clamped to [category_floor, category_cap]. The table is returned sorted by category, so
 * the build is deterministic.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { global: number; table: CategoryMultiple[] } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const global = median(all) ?? 0.169;
  const table: CategoryMultiple[] = [];
  for (const category of [...byCategory.keys()].sort()) {
    const live = byCategory.get(category)!;
    const own = live.length >= model.category_min_live ? median(live) : null;
    const multiple = clamp(own ?? global, model.category_floor, model.category_cap);
    table.push({ category, multiple: Math.round(multiple * 1000) / 1000, live_n: live.length, from_global: own === null });
  }
  return { global: Math.round(global * 1000) / 1000, table };
}

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { global: number; table: CategoryMultiple[] },
  model: ModelConstants = MODEL,
): { implied: number; catMult: number; catLiveN: number; sizeMult: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const entry = multiples.table.find((t) => t.category === (protocol.category ?? 'Other'));
  const catMult = entry === undefined ? multiples.global : entry.multiple;
  const catLiveN = entry === undefined ? 0 : entry.live_n;
  const sizeMult = clamp(Math.pow(protocol.tvl_usd / model.size_ref_usd, -model.size_exponent), model.size_floor, model.size_cap);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + model.growth_weight * Math.sign(growthPct) * (Math.log1p(Math.abs(growthPct)) / Math.log1p(model.growth_scale));
  const age = ageDays(asOf, protocol.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + model.maturity_range * (1 - Math.exp(-ageForModel / model.maturity_tau_days));
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_extra);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * catMult * sizeMult * growthMult * maturityMult * chainMult));
  return { implied, catMult, catLiveN, sizeMult, growthPct, growthMult, maturityMult, chainMult, age };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = categoryMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is on the board.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other protocol that passes the board's own rule, whatever its
  // size. The watchlist's floor is never the whole board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isBoardEligible(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const watchlist = new Set(snapshot.watchlist);
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: watchlist.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.catMult,
      category_live_n: s.catLiveN,
      size_multiplier: round4(s.sizeMult),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/**
 * What one transaction costs on a chain, in whole dollars, as the farm plan states
 * it. A flat gas figure would be wrong on its face: a Solana transaction costs cents
 * and an Ethereum one costs dollars, so the plan prices the chain the protocol
 * actually runs on. The figures are rough, stated as "about", and matched on the
 * chain's words, never on a protocol's name.
 */
export function gasFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 8;
  if (c.includes('solana')) return 0.05;
  if (c.includes('sui') || c.includes('aptos')) return 0.05;
  if (
    c.includes('hyperliquid') || c.includes('monad') || c.includes('stellar') ||
    c.includes('flare') || c.includes('provenance') || c.includes('arc') ||
    c.includes('plasma') || c.includes('algorand') || c.includes('ripple')
  ) return 0.05;
  if (c.includes('binance')) return 0.3;
  if (c.includes('tron')) return 1.5;
  if (c.includes('polygon')) return 0.1;
  if (c.includes('bitcoin')) return 2;
  if (c.includes('avalanche')) return 0.5;
  if (
    c.includes('base') || c.includes('arbitrum') || c.includes('optimism') ||
    c.includes('zksync') || c.includes('linea') || c.includes('scroll') ||
    c.includes('blast') || c.includes('mode') || c.includes('ink') ||
    c.includes('world chain') || c.includes('unichain') || c.includes('soneium') ||
    c.includes('zora') || c.includes('mantle') || c.includes('manta') ||
    c.includes('taiko') || c.includes('zircuit') || c.includes('zklink') ||
    c.includes('fraxtal') || c.includes('lisk') || c.includes('metis') ||
    c.includes('swellchain') || c.includes('sophon') || c.includes('katana') ||
    c.includes('hemi') || c.includes('corn') || c.includes('op_bnb') ||
    c.includes('robinhood') || c.includes('rise') || c.includes('starknet') ||
    c.includes('berachain') ||
    c.includes('x layer') || c.includes('polygon zkevm')
  ) return 0.5;
  return 1;
}

/** A gas figure as the plan writes it: $8, $1.50, $0.50, $0.05. */
export function gasText(gas: number): string {
  if (gas >= 1) return `$${Number.isInteger(gas) ? String(gas) : gas.toFixed(2)}`;
  return `$${gas.toFixed(2)}`;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/**
 * The second action's amount: a slice of the capital, so the plan names a figure
 * instead of "a small amount". $50 of a $250 or $150 position, $30 of $100, $20 of $50.
 */
function secondAmountFor(capital: number): number {
  if (capital >= 150) return 50;
  if (capital >= 100) return 30;
  return 20;
}

/** The weekly top-up's amount: $10 a week on a $100+ position, $5 on a $50 one. */
function weeklyAmountFor(capital: number): number {
  return capital >= 100 ? 10 : 5;
}

/** How long to hold, from the protocol's age: younger protocols get a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * A protocol's two category actions: the main position and a second qualifying action.
 * Matched on the category's words, never on a name. The order matters: 'cdp manager'
 * is checked before 'cdp' before 'lend', so a CDP manager is a manager and a CDP is a
 * mint, not a supply market; 'bridge' is checked before 'chain', so a cross-chain
 * bridge is a bridge, not a chain.
 */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const second = secondAmountFor(capital);
  if (c.includes('cdp manager')) {
    return [
      `Open a collateralized debt position through ${name} on ${chain}: deposit collateral and mint the stable asset.`,
      `Use ${name} to automate repayments and set liquidation protection on the position.`,
    ];
  }
  if (c.includes('cdp')) {
    return [
      `Lock $${capital} of collateral in ${name} on ${chain} and mint its stable asset against it.`,
      `Provide the minted stable asset as liquidity in a second protocol on ${chain}.`,
    ];
  }
  if (c.includes('lend') || c.includes('collateral')) {
    return [
      `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
      `Borrow $${second} against the supply, then repay it, so the account shows both sides of the market.`,
    ];
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm')) {
    return [
      `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
      `Swap a second pair on ${name} and add $${second} to a second pool.`,
    ];
  }
  if (c.includes('bridge')) {
    return [
      `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
      `Use the bridged funds in a second app on ${chain} instead of bridging straight back.`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`,
      `Claim the staking rewards once and restake them instead of withdrawing.`,
    ];
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) {
    return [
      `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`,
      `Close the hedge and open a fresh one in the opposite direction with the same margin.`,
    ];
  }
  if (c.includes('prediction')) {
    return [
      `Fund $${capital} on ${name} and place one position in an active market.`,
      `Place a second $${second} position in a different market and let both run to resolution.`,
    ];
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return [
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`,
      `Allocate $${second} to a second ${name} vault with a different risk profile.`,
    ];
  }
  if (c.includes('stable')) {
    return [
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
      `Use the stable asset in a second protocol on ${chain} instead of holding it idle.`,
    ];
  }
  if (c.includes('rwa')) {
    return [
      `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`,
      `Check the asset's backing report and hold the position through one yield payout.`,
    ];
  }
  if (c.includes('insurance')) {
    return [
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`,
      `Read the cover terms and confirm the policy covers the position you hold.`,
    ];
  }
  if (c.includes('chain')) {
    return [
      `Bridge $${capital} of USDC onto ${chain} and use it in ${name}'s app on ${chain}.`,
      `Try a second app on ${chain} with $${second} so the wallet touches more than one contract.`,
    ];
  }
  if (c.includes('payment') || c.includes('card')) {
    return [
      `Fund $${capital} into your ${name} account on ${chain} and make one payment with it.`,
      `Make a second $${second} payment to a different merchant so the account shows repeat use.`,
    ];
  }
  if (c.includes('governance')) {
    return [
      `Deposit $${capital} into ${name} on ${chain} and vote in its next governance round.`,
      `Delegate $${second} of voting power and take part in one proposal discussion.`,
    ];
  }
  if (c.includes('index')) {
    return [
      `Buy $${capital} of ${name}'s index tokens on ${chain} and hold them.`,
      `Rebalance once: sell a $${second} slice and buy back into the index at the new weights.`,
    ];
  }
  if (c.includes('cedefi')) {
    return [
      `Deposit $${capital} into ${name}'s vault on ${chain} and keep the position open.`,
      `Move $${second} into a second ${name} product with a different yield source.`,
    ];
  }
  if (c.includes('otc')) {
    return [
      `Place a $${capital} OTC order on ${name} and complete one trade.`,
      `Complete a second trade at a different size so the account shows repeat activity.`,
    ];
  }
  if (c.includes('btc')) {
    return [
      `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and use it in a DeFi app.`,
      `Lend the BTC-backed asset in a second app on ${chain} for one week.`,
    ];
  }
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    `Make a second qualifying action in the same app, such as a swap, a vote or a deposit.`,
  ];
}

/**
 * The noun for a protocol's farm position, by category: what the plan holds and
 * what the weekly action, the hold and the log all name. Same category order as
 * actionsFor, so the two never disagree about what a protocol is.
 */
function positionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('cdp manager')) return 'managed CDP position';
  if (c.includes('cdp')) return 'minted stable asset';
  if (c.includes('lend') || c.includes('collateral')) return 'supply position';
  if (c.includes('dex') || c.includes('yield') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm')) return 'liquidity position';
  if (c.includes('bridge')) return 'bridged funds';
  if (c.includes('staking') || c.includes('restak')) return 'staked position';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'margin position';
  if (c.includes('prediction')) return 'market positions';
  if (c.includes('curator') || c.includes('allocator')) return 'vault shares';
  if (c.includes('stable')) return 'stable-asset position';
  if (c.includes('rwa')) return 'yield-bearing asset';
  if (c.includes('insurance')) return 'cover policy';
  if (c.includes('chain')) return 'on-chain position';
  if (c.includes('payment') || c.includes('card')) return 'account balance';
  if (c.includes('governance')) return 'voting position';
  if (c.includes('index')) return 'index position';
  if (c.includes('cedefi')) return 'vault position';
  if (c.includes('otc')) return 'trading position';
  if (c.includes('btc')) return 'BTC-backed position';
  return 'position';
}

/** The recurring weekly action, by category: the same action as steps 2-3, repeated. */
function weeklyFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const weekly = weeklyAmountFor(capital);
  if (c.includes('cdp manager')) return `Check the ${name} dashboard each week and adjust the position's health factor.`;
  if (c.includes('cdp')) return `Check the collateral ratio and the peg once a week; top up the collateral if the ratio falls.`;
  if (c.includes('lend') || c.includes('collateral')) return `Top up the ${name} supply by $${weekly} each week and check the borrow rate.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm')) return `Add $${weekly} to the ${name} pool each week and claim any fees the position earns.`;
  if (c.includes('bridge')) return `Bridge $${weekly} through ${name} each week instead of moving funds in one go.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim the staking rewards each week and restake them through ${name}.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Roll the ${name} hedge once a week so the margin position stays active.`;
  if (c.includes('prediction')) return `Place one new position a week in a fresh ${name} market and let the old ones resolve.`;
  if (c.includes('curator') || c.includes('allocator')) return `Add $${weekly} to the ${name} vault each week and check the vault's yield.`;
  if (c.includes('stable')) return `Use the ${name} stable asset once a week instead of letting it sit idle.`;
  if (c.includes('rwa')) return `Check the ${name} yield payout each week and keep the asset held through it.`;
  if (c.includes('insurance')) return `Check the ${name} cover once a week and keep the policy active through its term.`;
  if (c.includes('chain')) return `Use one ${chain} app a week with the bridged funds so the wallet stays active on the chain.`;
  if (c.includes('payment') || c.includes('card')) return `Make one payment a week from the ${name} account so the account shows repeat use.`;
  if (c.includes('governance')) return `Vote in each ${name} governance round as it opens, week by week.`;
  if (c.includes('index')) return `Check the ${name} index weights each week and rebalance a small slice when they move.`;
  if (c.includes('cedefi')) return `Move $${weekly} between ${name} products each week so the account shows more than one yield source.`;
  if (c.includes('otc')) return `Complete one small OTC trade a week on ${name} at a different size each time.`;
  if (c.includes('btc')) return `Lend the BTC-backed asset for a week at a time and renew the loan through ${name}.`;
  return `Repeat the qualifying action in ${name} each week, a deposit, a swap or a vote, and leave the position open.`;
}

/**
 * What a protocol's rewards are called, by category: the step that checks them names
 * the same kind of reward the plan's position earns. Same category order as
 * actionsFor, so the three never disagree about what a protocol is.
 */
function rewardsFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('cdp manager')) return 'automation savings';
  if (c.includes('cdp')) return 'liquidity mining and fee rewards';
  if (c.includes('lend') || c.includes('collateral')) return 'supply and borrow rewards';
  if (c.includes('dex') || c.includes('yield') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm')) return 'liquidity mining and fee rewards';
  if (c.includes('bridge')) return 'bridge fee rebates';
  if (c.includes('staking') || c.includes('restak')) return 'staking yield';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'trading fee rebates';
  if (c.includes('prediction')) return 'market payouts';
  if (c.includes('curator') || c.includes('allocator')) return 'vault yield';
  if (c.includes('stable')) return 'stability fees';
  if (c.includes('rwa')) return 'yield payouts';
  if (c.includes('insurance')) return 'cover rewards';
  if (c.includes('chain')) return 'ecosystem points';
  if (c.includes('payment') || c.includes('card')) return 'cashback';
  if (c.includes('governance')) return 'governance rewards';
  if (c.includes('index')) return 'index yield';
  if (c.includes('cedefi')) return 'vault yield';
  if (c.includes('otc')) return 'trading rebates';
  if (c.includes('btc')) return 'BTC yield';
  return 'points or rewards';
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. The first step names the chain and the capital, the gas
 * on every step is the chain's own, and the rewards step names the kind of reward the
 * protocol's category earns.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasText(gasFor(chain));
  const hold = holdDaysFor(age);
  const name = p.name;
  const [main, second] = actionsFor(p, capital, chain);
  const position = positionFor(p);
  const rewards = rewardsFor(p);
  const weekly = weeklyFor(p, capital, chain);
  return [
    {
      text: `Use a fresh ${chain} wallet holding only the $${capital} you plan to farm; keep its seed phrase offline.`,
      cost: `about ${gas} of gas for the first transaction`,
      time: '5 minutes',
    },
    { text: main, cost: `$${capital} of capital and about ${gas} of gas`, time: '15 minutes to set up' },
    { text: second, cost: `about ${gas} of gas`, time: '10 minutes' },
    {
      text: weekly,
      cost: `about ${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Keep the ${position} open at least ${hold} days so the activity counts in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open ${name}'s rewards page and check the ${rewards} for the ${position}.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Only use ${name}'s official docs and verified accounts; ignore direct messages offering claims.`,
      cost: 'nothing',
      time: '5 minutes',
    },
    {
      text: `Log the wallet, deposit date, ${position}, amounts and hashes so you can repeat or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    watchlist: row.watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_live_n: row.model.category_live_n,
    size_multiplier: row.model.size_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = categoryMultiples(snapshot, model);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: multiples.global,
    category_multiples: multiples.table,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
