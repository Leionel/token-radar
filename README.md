[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Leionel/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Leionel/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — a pre-token protocol board ranked by implied value

A program plus the dashboard it writes. `main.ts` (Node 22, standard library only) reads a
sealed DefiLlama snapshot of 758 protocols, works out which ones record no token and are not a
wrapped, staked or bridged product of a token that already trades, ranks them by an implied
value the model derives from the snapshot's own figures, and writes a static dashboard with a
concrete farm plan for every row.

## The model (radar-4)

The value formula is unchanged from radar-2. Radar-3 made the farm plans
concrete: every step's gas is the chain's own (an Ethereum transaction costs
dollars, a Solana one cents), the first step names the chain and the capital,
and the rewards step names the kind of reward the protocol's category earns.
Radar-4 fixes what a careful read of the radar-3 plans found: CDP protocols
get their own plan (lock collateral, mint the stable asset) instead of the
lending plan's supply-and-borrow steps, and CDP managers get a manager's plan
(open the position through the manager, automate repayments); the second and
weekly actions now name a dollar figure instead of "a small amount"; the gas
table covers the cheap chains the board actually runs on (Hyperliquid, Monad,
Stellar, Flare and the rest no longer fall in the $1 default); the
methodology panel's fallback count is over rows, not categories, and its
table lists every category on the board with its row count so the count is
auditable; and the spotlight cards follow the table's filter. The methodology
panel states how much of the board rests on the global median and computes
its example multiples from the snapshot instead of writing them in.

```
implied = round( tvl × catMult × sizeMult × growthMult × maturityMult × chainMult )
```

- **catMult** — the median market-cap/TVL of live-token protocols in the same category,
  computed from the snapshot itself (categories with fewer than 3 live protocols use the
  global median, 0.169), clamped to [0.05, 1.0]. What the live market actually pays for
  that kind of protocol, not a guessed multiple.
- **sizeMult** — `(tvl / 1e8)^-0.12`, clamped to [0.6, 1.4]: implied value grows slower
  than TVL, so a mid-size fast grower can outrank a giant.
- **growthMult** — `1 + 0.5 × sign(g) × ln(1+|g|) / ln(101)` with `g` the 7-day TVL change
  clamped to [-70, +500]%: smooth, bounded, and a +4,448% week cannot break the board.
- **maturityMult** — `0.7 + 0.5 × (1 − e^(−age/365))`: the longer a protocol has run with
  real TVL and no token on record, the more value is banked for a launch; the effect
  saturates after about three years. Unknown age counts as 180 days.
- **chainMult** — `1 + 0.02 × min(chains − 1, 8)`: more chains, more surface area.

No protocol name is ever special-cased: one function scores every row, and the dashboard
recomputes each row from the same figures and shows every multiplier.

## The board

198 rows: the whole 40-protocol watchlist (the floor, never the ceiling) plus 158
pre-token protocols below the $50M floor, by the same rule the watchlist uses — no token
on record, and not a wrapped, staked or bridged product of a token that already trades.
Live-token protocols are set aside in their own tab with their market caps, never mixed
into the ranking. Every row carries an 8-step farm plan derived from its category,
chains, TVL and age, with a cost and a time on each step; the gas on each step is
the chain's own, and the rewards step names the kind of reward that category earns.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Then open `out/dashboard/index.html`. No network: the page reads `data.js` written beside
it, and nothing else. Implied value is a model, not a promise — and a protocol "records
no token", never "has no token": DefiLlama's record is not proof.

Built for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).
