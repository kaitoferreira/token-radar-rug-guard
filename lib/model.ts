// Rug-Guard Radar — token-radar-01, angle: rug detection (variant 9).
//
// The question this radar answers is not "which pre-token protocol is
// biggest" but "which pre-token protocol is biggest *after you price in
// the chance the money never comes back". Every row is scored twice:
// once for raw implied value (TVL x multiple x growth x maturity) and
// once for rug risk, derived only from the sealed snapshot's own
// figures. The board ranks by the risk-adjusted value, so a huge
// protocol with severe rug signals falls below a smaller, steadier one.
// No protocol name is ever special-cased: the same five signals score
// every row, and the dashboard shows each signal so a farmer can
// disagree with the weight and re-sort.
//
// The five rug signals (each 0-100, higher = riskier):
//   flight         35%  TVL flight in the last 7 days. A sharp outflow
//                       (capital leaving) and a sharp inflow (mercenary,
//                       possibly inflated TVL) are both suspicious; a
//                       flat week is calm.
//   youth          20%  How long DefiLlama has tracked the protocol.
//                       Young or undated protocols have no track record
//                       to rug-test against; old ones survived cycles.
//   concentration  20%  How concentrated the TVL is: one chain only
//                       scores high, many chains score low.
//   category       15%  Base risk of the category: bridges and
//                       derivatives hold other people's funds in
//                       transit or on leverage; lending and chains
//                       have slower, more observable failure modes.
//   thinness       10%  Small TVL is easier to move, fake, or drain.
//
// RugScore = weighted sum, 0-100. Bands: LOW <30, GUARDED 30-44,
// ELEVATED 45-57, HIGH 58-69, SEVERE >=70 (the bands are set against the
// signals' reachable range: the highest weighted sum the five signals
// can produce is about 82, and the riskiest row in this snapshot scores
// 73, so a SEVERE line above 70 would never fire on this data).
// Risk-adjusted implied value = raw implied x (1 - 0.8 x RugScore/100),
// floored at 15% of raw, so even a SEVERE protocol keeps a rank instead
// of vanishing — the farmer sees it, flagged, at the bottom of its
// size class, instead of the board pretending it does not exist.
//
// Farm steps are rug-aware: every plan starts with a verification
// checklist (contract, admin keys, withdrawal test) sized to the row's
// band, and high-risk rows get a small-test-first plan with a hard
// exit trigger (a TVL drop that means "leave now") instead of a
// hold-for-60-days plan.

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
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  rug_discount: number;
  rug_floor: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  rug_discount: 0.8,
  rug_floor: 0.15,
};

/** Rug-signal weights: they sum to 1. */
export const RUG_WEIGHTS = {
  flight: 0.35,
  youth: 0.2,
  concentration: 0.2,
  category: 0.15,
  thinness: 0.1,
} as const;

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'rug-guard-1';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

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
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A rug-risk band. */
export type RiskBand = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'SEVERE';

/** The five rug signals for one protocol, each 0-100. */
export interface RugBreakdown {
  flight: number;
  youth: number;
  concentration: number;
  category: number;
  thinness: number;
}

/** The dashboard's compact view of one row, with its rug score. */
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
  age_days: number | null;
  implied_value_usd: number;
  raw_implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  rug_score: number;
  risk_band: RiskBand;
  rug: RugBreakdown;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
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
  rows: RadarRow[];
  live: LiveRow[];
  risk_counts: Record<RiskBand, number>;
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

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Flight signal: outflow and violent inflow both score high; a flat week scores low. */
export function flightScore(change7d: number | null): number {
  if (change7d === null) return 55;
  if (change7d <= -50) return 98;
  if (change7d <= -30) return 85;
  if (change7d <= -15) return 68;
  if (change7d <= -8) return 48;
  if (change7d <= -3) return 28;
  if (change7d <= 8) return 10;
  if (change7d <= 20) return 22;
  if (change7d <= 50) return 45;
  if (change7d <= 100) return 70;
  return 92;
}

/** Youth signal: young or undated protocols have no survival record. */
export function youthScore(age: number | null): number {
  if (age === null) return 70;
  if (age < 30) return 92;
  if (age < 90) return 76;
  if (age < 180) return 58;
  if (age < 365) return 38;
  if (age < 730) return 22;
  return 10;
}

/** Concentration signal: one chain, one point of failure. */
export function concentrationScore(p: SnapshotProtocol): number {
  const chains = p.chains.length;
  if (chains <= 0) return 65;
  if (chains === 1) return 58;
  if (chains === 2) return 36;
  if (chains <= 4) return 20;
  return 10;
}

/** Category base risk: who holds the funds, and how fast they can leave. */
export function categoryScore(p: SnapshotProtocol): number {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('bridge')) return 72;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('leveraged')) return 66;
  if (c.includes('yield') || c.includes('farm')) return 60;
  if (c.includes('dex')) return 55;
  if (c.includes('liquid staking') || c.includes('restak')) return 48;
  if (c.includes('rwa') || c.includes('real world')) return 42;
  if (c.includes('cdp') || c.includes('collateral')) return 40;
  if (c.includes('lend')) return 34;
  if (c.includes('chain')) return 30;
  if (c.includes('insurance')) return 38;
  if (c.includes('curator') || c.includes('allocator')) return 52;
  return 50;
}

/** Thinness signal: small TVL is easier to move, fake, or drain. */
export function thinnessScore(p: SnapshotProtocol): number {
  if (p.tvl_usd < 10_000_000) return 72;
  if (p.tvl_usd < 25_000_000) return 58;
  if (p.tvl_usd < 50_000_000) return 46;
  if (p.tvl_usd < 250_000_000) return 34;
  if (p.tvl_usd < 1_000_000_000) return 24;
  return 16;
}

/** The five signals and the weighted rug score for one protocol. */
export function rugScore(p: SnapshotProtocol, asOf: string): { score: number; band: RiskBand; breakdown: RugBreakdown } {
  const age = ageDays(asOf, p.listed_at);
  const breakdown: RugBreakdown = {
    flight: flightScore(p.change_7d),
    youth: youthScore(age),
    concentration: concentrationScore(p),
    category: categoryScore(p),
    thinness: thinnessScore(p),
  };
  const score = Math.round(
    breakdown.flight * RUG_WEIGHTS.flight +
      breakdown.youth * RUG_WEIGHTS.youth +
      breakdown.concentration * RUG_WEIGHTS.concentration +
      breakdown.category * RUG_WEIGHTS.category +
      breakdown.thinness * RUG_WEIGHTS.thinness,
  );
  const band: RiskBand = score >= 70 ? 'SEVERE' : score >= 58 ? 'HIGH' : score >= 45 ? 'ELEVATED' : score >= 30 ? 'GUARDED' : 'LOW';
  return { score, band, breakdown };
}

/** The three multipliers and the raw implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** Risk-adjusted value: raw implied discounted by rug risk, floored so severe rows stay visible. */
export function adjustedValue(raw: number, rug: number, model: ModelConstants): number {
  const factor = Math.max(model.rug_floor, 1 - model.rug_discount * (rug / 100));
  return Math.max(1, Math.round(raw * factor));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest (risk-adjusted) first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model);
    const rug = rugScore(p, snapshot.as_of);
    return { p, raw: implied, adjusted: adjustedValue(implied, rug.score, model), growthPct, growthMult, maturityMult, age, rug };
  });
  scored.sort((a, b) => b.adjusted - a.adjusted || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
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
    age_days: s.age,
    implied_value_usd: s.adjusted,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, s.rug.band, s.rug.score).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
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

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol, band: RiskBand): number {
  if (band === 'SEVERE' || band === 'HIGH') return 25;
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age and risk band: risky rows get a short test, not a long lock. */
function holdDaysFor(age: number | null, band: RiskBand): number {
  if (band === 'SEVERE') return 7;
  if (band === 'HIGH') return 14;
  if (age === null) return 30;
  if (age < 180) return 45;
  if (age < 365) return 30;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The rug check that opens every farm plan, sized to the row's band. */
function rugCheckStep(p: SnapshotProtocol, band: RiskBand, score: number): FarmStep {
  const base = `Rug check first: this row scores ${score}/100 ${band} risk, so verify the protocol's own contract address, who holds the admin keys, and whether withdrawals work before any deposit.`;
  if (band === 'SEVERE' || band === 'HIGH') {
    return { text: `${base} Treat it as unproven until a small test withdrawal succeeds twice, on different days.`, cost: 'under $3 of gas for the test transactions', time: '20 minutes across 2 days' };
  }
  return { text: base, cost: 'under $3 of gas for the first transaction', time: '10 minutes' };
}

/**
 * A protocol's farm plan: seven steps. Step 1 is always the rug check;
 * the rest are the category action, weekly activity, a hold sized to
 * the risk band, an exit trigger (a TVL drop that means leave now),
 * a claim-safety step, and a farm log.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, band: RiskBand = 'GUARDED', score: number = 50): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p, band);
  const hold = holdDaysFor(age, band);
  const action = actionFor(p, capital, chain);
  const exitDrop = band === 'SEVERE' || band === 'HIGH' ? 10 : 25;
  return [
    rugCheckStep(p, band, score),
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'nothing but the wallet',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and re-check the 7-day TVL change each time.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, but exit at once if TVL falls ${exitDrop}% in a week or withdrawals slow down: that is the rug signal this radar watches.`,
      cost: `the $${capital} stays in the position until you exit`,
      time: `${hold} days, or less if the exit trigger fires`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
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
export function radarRow(row: BoardRow, snapshot: Snapshot): RadarRow {
  const p = snapshot.protocols.find((x) => x.slug === row.slug)!;
  const rug = rugScore(p, snapshot.as_of);
  const { implied } = impliedValue(p, snapshot.as_of, MODEL);
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
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    raw_implied_value_usd: implied,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    rug_score: rug.score,
    risk_band: rug.band,
    rug: rug.breakdown,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const risk_counts: Record<RiskBand, number> = { LOW: 0, GUARDED: 0, ELEVATED: 0, HIGH: 0, SEVERE: 0 };
  for (const r of board) {
    const p = snapshot.protocols.find((x) => x.slug === r.slug)!;
    risk_counts[rugScore(p, snapshot.as_of).band]++;
  }
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
    rows: board.map((r) => radarRow(r, snapshot)),
    live,
    risk_counts,
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
