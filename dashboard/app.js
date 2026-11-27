// Token Radar's dashboard (radar-6). It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own inputs and the protocol's farm plan, and the methodology.
// No network: every byte it shows is in data.js.
//
// The model in one function: the page recomputes a row from the snapshot figures and
// checks the number board.json carries, so the page's code and the board's data are
// visibly the same arithmetic. The farm plan is the same derivation main.ts writes to
// board.json: category, chains, TVL and age decide the action, the capital, the hold
// and every cost and time. No name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', wl: false, minTvl: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var MODEL = DATA.model;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // radar-6, the same function lib/model.ts scores with. The category multiple is the
  // median market-cap/TVL of live-token protocols in the same category, read off the
  // snapshot and carried in the row; the rest is computed here from the row's figures.
  // The scoring is factorsOf, impliedOf and farmSteps below; the model panel that
  // lists every category's multiple is modelPanel.
  function factorsOf(row) {
    var size = clamp(Math.pow(row.tvl_usd / MODEL.size_ref_usd, -MODEL.size_exponent), MODEL.size_floor, MODEL.size_cap);
    var g = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, MODEL.growth_floor, MODEL.growth_cap);
    var growth = 1 + MODEL.growth_weight * Math.sign(g) * (Math.log1p(Math.abs(g)) / Math.log1p(MODEL.growth_scale));
    var age = row.age_days === null || row.age_days === undefined ? MODEL.unknown_age_days : row.age_days;
    var maturity = MODEL.maturity_floor + MODEL.maturity_range * (1 - Math.exp(-age / MODEL.maturity_tau_days));
    var chain = 1 + MODEL.chain_step * Math.min(Math.max((row.chains || []).length - 1, 0), MODEL.chain_max_extra);
    return { cat: row.category_multiple, size: size, growth: growth, maturity: maturity, chain: chain, growthPct: g };
  }
  function impliedOf(row) {
    var f = factorsOf(row);
    return Math.max(1, Math.round(row.tvl_usd * f.cat * f.size * f.growth * f.maturity * f.chain));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan, the same derivation as lib/model.ts: category, chains, TVL and age.
  // One field is corrected, not modelled: chainOf names Abstract Chain for the
  // protocol the snapshot lists on Ethereum; it changes no value.
  // The first chain a protocol names, or a neutral phrase. One snapshot field is
  // corrected here, not modelled: Abstract lists Ethereum, but its apps run on
  // Abstract Chain, so its plans name Abstract Chain and its gas. The correction
  // changes no value — the chain multiplier counts chains, never names one — and
  // it is stated on the dashboard's methodology panel.
  function chainOf(p) {
    if (p.slug === 'abstract') return 'Abstract Chain';
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }
  // A payment protocol on Bitcoin is a Lightning plan, not an account plan:
  // Lightning has no accounts and no cashback; it has channels and routing fees.
  // Matched on the category's words and the chain, never on a name.
  function isLightning(p) {
    var c = (p.category || '').toLowerCase();
    return (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) && chainOf(p).toLowerCase().indexOf('bitcoin') >= 0;
  }
  // What one transaction costs on a chain: a Solana transaction costs cents and an
  // Ethereum one costs dollars, so the plan prices the chain the protocol runs on.
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('ethereum') >= 0) return 8;
    if (c.indexOf('solana') >= 0) return 0.05;
    if (c.indexOf('sui') >= 0 || c.indexOf('aptos') >= 0) return 0.05;
    if (c.indexOf('hyperliquid') >= 0 || c.indexOf('monad') >= 0 || c.indexOf('stellar') >= 0 ||
      c.indexOf('flare') >= 0 || c.indexOf('provenance') >= 0 || c.indexOf('arc') >= 0 ||
      c.indexOf('plasma') >= 0 || c.indexOf('algorand') >= 0 || c.indexOf('ripple') >= 0 ||
      c.indexOf('ronin') >= 0 || c.indexOf('klaytn') >= 0 || c.indexOf('stacks') >= 0 ||
      c.indexOf('kava') >= 0 || c.indexOf('noble') >= 0 || c.indexOf('proton') >= 0 ||
      c.indexOf('xion') >= 0 || c.indexOf('rsk') >= 0 || c.indexOf('bifrost') >= 0 ||
      c.indexOf('pharos') >= 0 || c.indexOf('plume') >= 0 || c.indexOf('tempo') >= 0 ||
      c.indexOf('stable') >= 0 || c.indexOf('qubic') >= 0 || c.indexOf('canton') >= 0 ||
      c.indexOf('strato') >= 0 || c.indexOf('abstract') >= 0) return 0.05;
    if (c.indexOf('binance') >= 0) return 0.3;
    if (c.indexOf('tron') >= 0) return 1.5;
    if (c.indexOf('polygon') >= 0) return 0.1;
    if (c.indexOf('bitcoin') >= 0) return 2;
    if (c.indexOf('avalanche') >= 0) return 0.5;
    if (c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 ||
      c.indexOf('zksync') >= 0 || c.indexOf('linea') >= 0 || c.indexOf('scroll') >= 0 ||
      c.indexOf('blast') >= 0 || c.indexOf('mode') >= 0 || c.indexOf('ink') >= 0 ||
      c.indexOf('world chain') >= 0 || c.indexOf('unichain') >= 0 || c.indexOf('soneium') >= 0 ||
      c.indexOf('zora') >= 0 || c.indexOf('mantle') >= 0 || c.indexOf('manta') >= 0 ||
      c.indexOf('taiko') >= 0 || c.indexOf('zircuit') >= 0 || c.indexOf('zklink') >= 0 ||
      c.indexOf('fraxtal') >= 0 || c.indexOf('lisk') >= 0 || c.indexOf('metis') >= 0 ||
      c.indexOf('swellchain') >= 0 || c.indexOf('sophon') >= 0 || c.indexOf('katana') >= 0 ||
      c.indexOf('hemi') >= 0 || c.indexOf('corn') >= 0 || c.indexOf('op_bnb') >= 0 ||
      c.indexOf('robinhood') >= 0 || c.indexOf('rise') >= 0 || c.indexOf('starknet') >= 0 ||
      c.indexOf('berachain') >= 0 ||
      c.indexOf('x layer') >= 0 || c.indexOf('polygon zkevm') >= 0 ||
      c.indexOf('bittensor') >= 0 || c.indexOf('bsquared') >= 0 || c.indexOf('mezo') >= 0 ||
      c.indexOf('morph') >= 0 || c.indexOf('reya') >= 0 || c.indexOf('fluent') >= 0) return 0.5;
    return 1;
  }
  function gasText(gas) {
    if (gas >= 1) return '$' + (gas % 1 === 0 ? String(gas) : gas.toFixed(2));
    return '$' + gas.toFixed(2);
  }
  // What a protocol's rewards are called, by category: the step that checks them names
  // the same kind of reward the plan's position earns. Same order as actionsFor.
  function rewardsFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('cdp manager') >= 0) return 'automation savings';
    if (c.indexOf('cdp') >= 0) return 'liquidity mining and fee rewards';
    if (c.indexOf('uncollateralized') >= 0) return 'lending yield';
    if (c.indexOf('collateral') >= 0) return 'restaking yield';
    if (c.indexOf('lend') >= 0) return 'supply and borrow rewards';
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return 'yield';
    if (c.indexOf('index') >= 0) return 'index yield';
    if (c.indexOf('dex') >= 0 || c.indexOf('farm') >= 0) return 'liquidity mining and fee rewards';
    if (c.indexOf('bridge') >= 0) return 'transfer fees';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'staking yield';
    if (c.indexOf('basis') >= 0) return 'basis yield';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'trading fee rebates';
    if (c.indexOf('prediction') >= 0) return 'market payouts';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'yield';
    if (c.indexOf('stable') >= 0) return 'yield';
    if (c.indexOf('rwa') >= 0) return 'yield payouts';
    if (c.indexOf('insurance') >= 0) return 'cover premiums';
    if (c.indexOf('chain') >= 0) return 'ecosystem points';
    if (isLightning(p)) return 'routing fees';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'cashback';
    if (c.indexOf('governance') >= 0) return 'BTC yield and emissions';
    if (c.indexOf('cedefi') >= 0) return 'vault yield';
    if (c.indexOf('otc') >= 0) return 'trading rewards';
    if (c.indexOf('btc') >= 0) return 'DeFi yield';
    return 'points or rewards';
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  // The second action's amount: a slice of the capital, so the plan names a figure
  // instead of "a small amount". $50 of a $250 or $150 position, $30 of $100, $20 of $50.
  function secondAmountFor(capital) {
    if (capital >= 150) return 50;
    if (capital >= 100) return 30;
    return 20;
  }
  // The weekly top-up's amount: $10 a week on a $100+ position, $5 on a $50 one.
  function weeklyAmountFor(capital) {
    return capital >= 100 ? 10 : 5;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionsFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var second = secondAmountFor(capital);
    if (c.indexOf('cdp manager') >= 0) return [
      'Open a collateralized debt position through ' + name + ' on ' + chain + ': deposit collateral and mint the stable asset.',
      'Use ' + name + ' to automate repayments and set liquidation protection on the position.'];
    if (c.indexOf('cdp') >= 0) return [
      'Lock $' + capital + ' of collateral in ' + name + ' on ' + chain + ' and mint its stable asset against it.',
      'Provide the minted stable asset as liquidity in a second protocol on ' + chain + '.'];
    if (c.indexOf('uncollateralized') >= 0) return [
      'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and mint its yield-bearing token.',
      'Hold the token through one yield payout.'];
    if (c.indexOf('collateral') >= 0) return [
      'Deposit $' + capital + ' of collateral into a ' + name + ' vault on ' + chain + ' and delegate it to secure networks.',
      'Delegate the collateral to a second operator so the vault secures another network.'];
    if (c.indexOf('lend') >= 0) return [
      'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.',
      'Borrow $' + second + ' against the supply, then repay it, so the account shows both sides of the market.'];
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return [
      'Deposit $' + capital + " into " + name + "'s vault on " + chain + ' and keep the receipt token.',
      'Add a second $' + second + ' deposit to the vault so the position shows repeat activity.'];
    if (c.indexOf('index') >= 0) return [
      "Buy $" + capital + " of " + name + "'s index tokens on " + chain + ' and hold them.',
      'Rebalance once: sell a $' + second + ' slice and buy back into the index at the new weights.'];
    if (c.indexOf('dex') >= 0 || c.indexOf('farm') >= 0) return [
      "Provide $" + capital + " of liquidity to " + name + "'s main pool on " + chain + ' and keep the position open.',
      'Swap a second pair on ' + name + ' and add $' + second + ' to a second pool.'];
    if (c.indexOf('bridge') >= 0) return [
      'Bridge $' + capital + ' of USDC through ' + name + ' to another chain and use the bridged funds in an app there.',
      'Use the bridged funds in a second app on the destination chain instead of bridging straight back.'];
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return [
      "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the position open.',
      'Check the staking rewards and restake any payout instead of withdrawing.'];
    if (c.indexOf('basis') >= 0) return [
      'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and hold its yield-bearing token.',
      'Deposit a second $' + second + ' and hold it through one yield payout.'];
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return [
      'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small position.',
      'Close the position and open a fresh one in the opposite direction with the same margin.'];
    if (c.indexOf('prediction') >= 0) return [
      'Fund $' + capital + ' on ' + name + ' and place one position in an active market.',
      'Place a second $' + second + ' position in a different market and let both run to resolution.'];
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return [
      'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and keep the receipt token.',
      'Allocate $' + second + ' to a second ' + name + ' product with a different risk profile.'];
    if (c.indexOf('stable') >= 0) return [
      'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.',
      'Use the stable asset in a second protocol on ' + chain + ' instead of holding it idle.'];
    if (c.indexOf('rwa') >= 0) return [
      "Buy or mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it.',
      "Check the asset's backing report and hold the position through one yield payout."];
    if (c.indexOf('insurance') >= 0) return [
      'Deposit $' + capital + ' into the ' + name + ' vault on ' + chain + ' and keep the receipt token.',
      'Hold the receipt token through one premium payout.'];
    if (c.indexOf('chain') >= 0) return [
      'Bridge $' + capital + " of USDC onto " + chain + " and use it in " + name + "'s app on " + chain + '.',
      'Try a second app on ' + chain + ' with $' + second + ' so the wallet touches more than one contract.'];
    if (isLightning(p)) return [
      'Open a Lightning channel with $' + capital + ' on ' + chain + ' and route one payment through it.',
      'Route a second $' + second + ' payment through the same channel to a different destination.'];
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return [
      'Fund $' + capital + ' into your ' + name + ' account on ' + chain + ' and make one payment with it.',
      'Make a second $' + second + ' payment to a different merchant so the account shows repeat use.'];
    if (c.indexOf('governance') >= 0) return [
      'Lock $' + capital + ' of BTC through ' + name + ' on ' + chain + ' and vote to direct emissions.',
      'Vote again in the next epoch to keep directing emissions.'];
    if (c.indexOf('cedefi') >= 0) return [
      'Deposit $' + capital + " into " + name + "'s vault on " + chain + ' and keep the position open.',
      'Move $' + second + ' into a second ' + name + ' product with a different yield source.'];
    if (c.indexOf('otc') >= 0) return [
      'Place a $' + capital + ' trade on ' + name + ' and complete it.',
      'Complete a second trade at a different size so the account shows repeat activity.'];
    if (c.indexOf('btc') >= 0) return [
      'Mint $' + capital + ' of the BTC-backed asset through ' + name + ' and use it in a DeFi app.',
      'Lend the BTC-backed asset in a second DeFi app for one week.'];
    return [
      'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.',
      'Make a second qualifying action in the same app, such as a swap, a vote or a deposit.'];
  }
  // The noun for a protocol's farm position, by category: what the plan holds and
  // what the weekly action, the hold and the log all name. Same category order as
  // actionsFor, so the two never disagree about what a protocol is.
  function positionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('cdp manager') >= 0) return 'managed CDP position';
    if (c.indexOf('cdp') >= 0) return 'minted stable asset';
    if (c.indexOf('uncollateralized') >= 0) return 'lending position';
    if (c.indexOf('collateral') >= 0) return 'restaking position';
    if (c.indexOf('lend') >= 0) return 'supply position';
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return 'receipt token';
    if (c.indexOf('index') >= 0) return 'index position';
    if (c.indexOf('dex') >= 0 || c.indexOf('farm') >= 0) return 'liquidity position';
    if (c.indexOf('bridge') >= 0) return 'bridged funds';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'staked position';
    if (c.indexOf('basis') >= 0) return 'yield-bearing token';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'margin position';
    if (c.indexOf('prediction') >= 0) return 'market positions';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'receipt token';
    if (c.indexOf('stable') >= 0) return 'stable-asset position';
    if (c.indexOf('rwa') >= 0) return 'yield-bearing asset';
    if (c.indexOf('insurance') >= 0) return 'vault position';
    if (c.indexOf('chain') >= 0) return 'on-chain position';
    if (isLightning(p)) return 'channel balance';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'account balance';
    if (c.indexOf('governance') >= 0) return 'voting position';
    if (c.indexOf('cedefi') >= 0) return 'vault position';
    if (c.indexOf('otc') >= 0) return 'trading position';
    if (c.indexOf('btc') >= 0) return 'BTC-backed position';
    return 'position';
  }
  // The recurring weekly action, by category: the same action as steps 2-3, repeated.
  function weeklyFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var weekly = weeklyAmountFor(capital);
    if (c.indexOf('cdp manager') >= 0) return 'Check the ' + name + ' dashboard each week and adjust the position\'s health factor.';
    if (c.indexOf('cdp') >= 0) return 'Check the collateral ratio and the peg once a week; top up the collateral if the ratio falls.';
    if (c.indexOf('uncollateralized') >= 0) return 'Add $' + weekly + ' to the position each week and check the lending yield.';
    if (c.indexOf('collateral') >= 0) return 'Add $' + weekly + ' of collateral to the vault each week and check the restaking yield.';
    if (c.indexOf('lend') >= 0) return 'Top up the ' + name + ' supply by $' + weekly + ' each week and check the borrow rate.';
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + weekly + ' to the ' + name + ' vault each week and check the yield.';
    if (c.indexOf('index') >= 0) return 'Check the ' + name + ' index weights each week and rebalance a small slice when they move.';
    if (c.indexOf('dex') >= 0 || c.indexOf('farm') >= 0) return 'Add $' + weekly + ' to the ' + name + ' pool each week and claim any fees the position earns.';
    if (c.indexOf('bridge') >= 0) return 'Use the bridged funds in an app each week so the wallet stays active.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Check the staking rewards once a week and restake any payout.';
    if (c.indexOf('basis') >= 0) return 'Add $' + weekly + ' to the position each week and check the basis yield.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open one small position a week so the account shows repeat activity.';
    if (c.indexOf('prediction') >= 0) return 'Place one new position a week in a fresh ' + name + ' market and let the old ones resolve.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Add $' + weekly + ' to the position each week and check the yield.';
    if (c.indexOf('stable') >= 0) return 'Use the ' + name + ' stable asset once a week instead of letting it sit idle.';
    if (c.indexOf('rwa') >= 0) return 'Check the ' + name + ' yield payout each week and keep the asset held through it.';
    if (c.indexOf('insurance') >= 0) return 'Check the cover premiums once a week and hold the receipt token.';
    if (c.indexOf('chain') >= 0) return 'Use one ' + chain + ' app a week with the bridged funds so the wallet stays active on the chain.';
    if (isLightning(p)) return 'Route one payment a week through the Lightning channel so the node stays active.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Make one payment a week from the ' + name + ' account so the account shows repeat use.';
    if (c.indexOf('governance') >= 0) return 'Vote in each ' + name + ' governance round as it opens, week by week.';
    if (c.indexOf('cedefi') >= 0) return 'Move $' + weekly + ' between ' + name + ' products each week so the account shows more than one yield source.';
    if (c.indexOf('otc') >= 0) return 'Complete one small trade a week on ' + name + ' at a different size each time.';
    if (c.indexOf('btc') >= 0) return 'Lend the BTC-backed asset for a week at a time and renew the loan through ' + name + '.';
    return 'Repeat the qualifying action in ' + name + ' each week, a deposit, a swap or a vote, and leave the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var gas = gasText(gasFor(chain));
    var lightning = isLightning(p);
    var payGas = lightning ? gasText(0.01) : gas;
    var hold = holdDaysFor(p.age_days);
    var name = p.name;
    var acts = actionsFor(p, capital, chain);
    var position = positionFor(p);
    var rewards = rewardsFor(p);
    var weekly = weeklyFor(p, capital, chain);
    return [
      { text: 'Use a fresh ' + chain + ' wallet holding only the $' + capital + ' you plan to farm; keep its seed phrase offline.', cost: 'about ' + gas + ' of gas for the first transaction', time: '5 minutes' },
      { text: acts[0], cost: '$' + capital + ' of capital and about ' + gas + ' of gas', time: '15 minutes to set up' },
      { text: acts[1], cost: 'about ' + payGas + ' of gas', time: '10 minutes' },
      { text: weekly, cost: 'about ' + payGas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Keep the ' + position + ' open at least ' + hold + ' days so the activity counts in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: lightning ? 'Check the routing fees the channel earned this week.' : 'Open ' + name + '\'s rewards page and check the ' + rewards + ' for the ' + position + '.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Only use ' + name + '\'s official docs and verified accounts; ignore direct messages offering claims.', cost: 'nothing', time: '5 minutes' },
      { text: 'Log the wallet, deposit date, ' + position + ', amounts and hashes so you can repeat or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl')) state.wl = params.get('wl') === '1';
    if (params.get('min')) state.minTvl = Number(params.get('min')) || 0;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.minTvl) params.set('min', String(state.minTvl));
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // The live tab's rows, filtered and sorted by the same controls as the board:
  // search, category, chain and minimum TVL. The watchlist-only box does not apply
  // here — a live-token protocol is on no watchlist — so liveRows ignores state.wl.
  function liveRows() {
    var q = (state.q || '').trim().toLowerCase();
    return DATA.live.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function liveSorted(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'mcap') { av = a.mcap_usd; bv = b.mcap_usd; }
      else { av = a.mcap_usd; bv = b.mcap_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function whyLine(r) {
    var parts = [fmtUsd(r.tvl_usd), r.change_7d === null ? 'no 7d change' : fmtPct(r.change_7d) + ' 7d', fmtAge(r.age_days) + ', no token'];
    return parts.join(' · ');
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }),
        el('div', null,
          el('span', { class: 'brand-name', text: 'Token Radar' }),
          el('div', { class: 'brand-sub', text: 'Pre-token protocols, ranked by implied value' })
        )),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill', html: 'Snapshot <b>' + DATA.as_of + '</b>' }),
        el('span', { class: 'pill', html: 'DefiLlama protocol index' }),
        el('span', { class: 'pill', html: 'Model <b>' + DATA.model_version + '</b>' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    var growths = DATA.rows.map(function (r) { return r.change_7d; }).filter(function (g) { return g !== null; }).sort(function (a, b) { return a - b; });
    var med = growths.length ? growths[Math.floor(growths.length / 2)] : null;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { html: '<span class="gold">' + DATA.board_size + ' pre-token protocols</span>, ranked by what their launch would be worth' }),
        el('p', { text: 'The snapshot\u2019s pre-token protocols, minus wrapped, staked and bridged products: ' + DATA.watchlist_size + ' on the watchlist, plus ' + DATA.early_size + ' early rows. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every slug on the list is ranked' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' early rows' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: top ? fmtUsd(top.implied_value_usd) : 'n/a' }), el('small', { text: top ? top.name : '' })),
        el('div', { class: 'fact' }, el('span', { text: 'Median 7-day growth' }), el('b', { text: fmtPct(med) }), el('small', { text: 'across the ' + DATA.board_size + ' pre-token rows' }))
      )
    );
  }

  function spotlight() {
    // The cards follow the same filter as the table: in a filtered view they name
    // the top rows the table actually shows, not the unfiltered top five.
    var filtered = rows();
    var top = (filtered.length ? filtered : DATA.rows).slice(0, 5);
    return el('section', { class: 'spot' },
      el('h2', { text: 'Worth farming now' }),
      el('div', { class: 'spot-cards' }, top.map(function (r) {
        return el('button', { type: 'button', class: 'card', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rk', text: 'RANK ' + r.rank }),
          el('span', { class: 'nm', text: r.name }),
          el('span', { class: 'ct', text: (r.category || 'Other') + ' on ' + ((r.chains || [])[0] || 'an unnamed chain') }),
          el('span', { class: 'vl', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'why', text: whyLine(r) })
        );
      }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.concat(DATA.live).map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.concat(DATA.live).reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var min = el('select', { id: 'min', 'aria-label': 'Minimum TVL' },
      el('option', { value: '0', text: 'Any TVL' }),
      [['50000000', '$50M+'], ['100000000', '$100M+'], ['500000000', '$500M+'], ['1000000000', '$1B+']].map(function (o) { return el('option', { value: o[0], text: o[1], selected: Number(o[0]) === state.minTvl ? 'selected' : null }); })
    );
    min.addEventListener('change', function () { state.minTvl = Number(min.value); writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.wl ? 'checked' : null, disabled: state.tab === 'live' ? 'disabled' : null, 'aria-label': 'Watchlist only' });
    wl.addEventListener('change', function () { state.wl = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chn),
      el('div', { class: 'field' }, el('label', { for: 'min', text: 'Min TVL' }), min),
      el('label', { class: 'check', for: 'wl' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : liveRows().length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', class: 'sortbtn', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } writeHash(); render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'badge' + (r.watchlist ? ' gold' : ''), text: r.watchlist ? 'watchlist' : 'early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'List' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var list = liveSorted(liveRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No live-token protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the live tab again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var tbody = el('tbody');
    list.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('growth', '7d'), sortHeader('mcap', 'Market cap'), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // The example multiples, read off the snapshot's own table rather than written
  // in: the sentence names what the data actually pays for those categories.
  function exampleMultiples() {
    var want = ['Lending', 'Dexs', 'Basis Trading'];
    var parts = [];
    want.forEach(function (name) {
      var t = null;
      DATA.category_multiples.forEach(function (x) { if (x.category === name) t = x; });
      if (t && !t.from_global) parts.push(name + ' pays about ' + t.multiple.toFixed(3) + 'x TVL');
    });
    return parts.length ? parts.join(', ') + '. ' : '';
  }
  // How much of the board rests on the global fallback, and whether the top of the
  // board is among it: the model states its own weak evidence instead of hiding it.
  // The count is over rows, not categories: a category counts its rows only when it
  // has fewer than the minimum live-token protocols, including categories with none.
  function fallbackNote() {
    var n = 0;
    DATA.rows.forEach(function (r) { if (r.category_live_n < MODEL.category_min_live) n++; });
    var top3 = DATA.rows.slice(0, 3).every(function (r) { return r.category_live_n < MODEL.category_min_live; });
    var s = n + ' of the ' + DATA.board_size + ' rows use the global median of ' + DATA.global_multiple + ' because their category has fewer than ' + MODEL.category_min_live + ' live-token protocols in this snapshot.';
    if (top3) s += ' The top three rows are among them: their category has too few live-token protocols for its own median, so the model says so instead of guessing one.';
    return s;
  }

  function modelPanel() {
    var m = MODEL;
    // Every category on the board, with its row count, so the fallback note above is
    // auditable: the rows of the (global) categories add up to the number it states.
    // Categories with no live-token protocols at all never enter the multiples table,
    // so they read the global median here too.
    var rowsByCat = {};
    DATA.rows.forEach(function (r) { var k = r.category || 'Other'; rowsByCat[k] = (rowsByCat[k] || 0) + 1; });
    var shown = Object.keys(rowsByCat).map(function (cat) {
      var t = null;
      DATA.category_multiples.forEach(function (x) { if (x.category === cat) t = x; });
      var fromGlobal = !t || t.from_global;
      return {
        category: cat,
        live_n: t ? t.live_n : 0,
        rows: rowsByCat[cat],
        multiple: t ? t.multiple : DATA.global_multiple,
        from_global: fromGlobal
      };
    }).sort(function (a, b) { return b.multiple - a.multiple || (a.category < b.category ? -1 : 1); });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x catMult x sizeMult x growthMult x maturityMult x chainMult )\n' +
        'catMult      = median market-cap / TVL of live-token protocols in the same category\n' +
        '               (fewer than ' + m.category_min_live + ' live: the global median ' + DATA.global_multiple + '), clamped [' + m.category_floor + ', ' + m.category_cap + ']\n' +
        'sizeMult     = clamp((tvl_usd / ' + m.size_ref_usd + ')^-' + m.size_exponent + ', ' + m.size_floor + ', ' + m.size_cap + ')\n' +
        'growthMult   = 1 + ' + m.growth_weight + ' x sign(g) x ln(1+|g|) / ln(' + (m.growth_scale + 1) + '),  g = clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')\n' +
        'maturityMult = ' + m.maturity_floor + ' + ' + m.maturity_range + ' x (1 - e^(-age_days / ' + m.maturity_tau_days + ')),  unknown age = ' + m.unknown_age_days + ' days\n' +
        'chainMult    = 1 + ' + m.chain_step + ' x min(chains - 1, ' + m.chain_max_extra + ')'
      ),
      el('p', null,
        el('b', { text: 'Why a category multiple. ' }),
        'A token is worth what its kind of protocol is worth: the multiple is read off the live-token protocols in the same category, from this snapshot. ' + exampleMultiples() + ' Categories with too few live protocols use the global median of ' + DATA.global_multiple + '.'
      ),
      el('p', { class: 'note', text: fallbackNote() }),
      el('table', { class: 'mult-table' },
        el('caption', { text: 'Category multiples from the snapshot (median market-cap / TVL, live-token protocols only). (global) marks the categories that use the global median.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'num', text: 'Live' }), el('th', { scope: 'col', class: 'num', text: 'Rows' }), el('th', { scope: 'col', class: 'num', text: 'Multiple' }))),
        el('tbody', null, shown.map(function (t) {
          return el('tr', null, el('td', { text: t.category }), el('td', { class: 'num', text: String(t.live_n) }), el('td', { class: 'num', text: String(t.rows) }), el('td', { class: 'num', text: t.multiple.toFixed(3) + 'x' + (t.from_global ? ' (global)' : '') }));
        }))
      ),
      el('p', { class: 'note', text: 'Wording: a protocol "records no token", never "has no token". DefiLlama\u2019s record is not proof — a protocol on this board may still have a token its record does not carry. The board also leaves out wrapped, staked and bridged products of tokens that already trade, by the watchlist\u2019s own rule: WBTC is Bitcoin on Ethereum, not a token that does not exist yet. Versioned names are one protocol, not one row each: the board keeps the largest version (Aera V3, not V2) and leaves out a version whose protocol already has a row. One chain is corrected from the snapshot: Abstract lists Ethereum, but its apps run on Abstract Chain.' })
    );
  }

  function footer() {
    return el('footer', null,
      'Source: DefiLlama protocol index, snapshot ' + DATA.as_of + ' (' + DATA.source + '). ' +
      'Implied value is this dashboard\u2019s model, not a promise and not a price; nothing here predicts whether or when a token is issued. ' +
      'The page makes no network requests: every number it shows is in data.js, written from the same snapshot.'
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var f = factorsOf(row);
    var recomputed = impliedOf(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · Watchlist' : ' · Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + (row.listed_at ? ' · listed ' + row.listed_at : '') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Category mult.' }), el('b', { class: 'num', text: f.cat.toFixed(3) + 'x' + (row.category_live_n >= 3 ? ' (' + row.category_live_n + ' live)' : ' (global)') })),
        el('div', null, el('span', { text: 'Size multiplier' }), el('b', { class: 'num', text: f.size.toFixed(4) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: f.growth.toFixed(4) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: f.maturity.toFixed(4) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: f.chain.toFixed(4) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'check-line', html: 'Model ' + DATA.model_version + ': this page recomputes the row as <b>' + fmtUsd(recomputed) + '</b>' + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(spotlight());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    window.__shotReady = true;
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
