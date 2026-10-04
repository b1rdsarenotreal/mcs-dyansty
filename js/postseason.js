// Postseason: conference tournaments (single elimination, week 15), a
// 16-team NCAA field (week 16 regionals: four 4-team double-elimination
// sites hosted by the top 4 national seeds), and the Men's College World
// Series (week 17: the four regional champions play double elimination down
// to two, then a best-of-three Championship Series).

import { blankGame, DAY_ORDER } from './schedule.js';
import { records, rpi, confStandings, conferences, isFinal, winnerOf, loserOf, regularSeasonDone, regSeasonChamp } from './standings.js';
import { latestPoll, pollRankMap, generatePoll } from './polls.js';

export const WEEK = { conf: 15, regional: 16, mcws: 17 };
export const FIELD_SIZE = 16;

export function defaultConfTourneySize(n) { return n >= 9 ? 6 : n >= 4 ? 4 : 0; }

// ---------- bracket nodes ----------

function bracketOrder(p) {
  let order = [1, 2];
  while (order.length < p) { const n = order.length * 2; order = order.flatMap(s => [s, n + 1 - s]); }
  return order;
}

function singleElim(size) {
  const p = 2 ** Math.ceil(Math.log2(size));
  const order = bracketOrder(p);
  const rounds = Math.log2(p);
  const names = ['Final', 'Semifinal', 'Quarterfinal', 'First round'];
  const days = ['Thu', 'Fri', 'Sat', 'Sun'].slice(4 - Math.min(4, rounds));
  const nodes = [];
  let prev = [];
  for (let i = 0; i < order.length; i += 2) prev.push({ seed: order[i] - 1 }, { seed: order[i + 1] - 1 });
  let refs = prev;
  for (let r = 0; r < rounds; r++) {
    const next = [];
    for (let i = 0; i < refs.length; i += 2) {
      const key = `R${r + 1}-${i / 2 + 1}`;
      nodes.push({ key, a: refs[i], b: refs[i + 1], day: days[r] || 'Sun', label: names[rounds - 1 - r] || `Round ${r + 1}` });
      next.push({ w: key });
    }
    refs = next;
  }
  return nodes;
}

function doubleElim(final = 'g7') {
  const n = [
    { key: 'G1', a: { seed: 0 }, b: { seed: 3 }, day: 'Fri', label: 'Game 1' },
    { key: 'G2', a: { seed: 1 }, b: { seed: 2 }, day: 'Fri', label: 'Game 2' },
    { key: 'G3', a: { l: 'G1' }, b: { l: 'G2' }, day: 'Sat', label: 'Game 3 (elimination)' },
    { key: 'G4', a: { w: 'G1' }, b: { w: 'G2' }, day: 'Sat', label: 'Game 4' },
    { key: 'G5', a: { w: 'G3' }, b: { l: 'G4' }, day: 'Sun', label: 'Game 5 (elimination)' },
  ];
  if (final === 'g7') {
    n.push({ key: 'G6', a: { w: 'G4' }, b: { w: 'G5' }, day: 'Sun', label: 'Regional final' });
    n.push({ key: 'G7', a: { w: 'G4' }, b: { w: 'G5' }, day: 'Mon', label: 'Regional final (if necessary)', cond: 'g7' });
  } else {
    for (const x of n) x.day = { Fri: 'Thu', Sat: 'Fri', Sun: 'Sat' }[x.day];
    n.push({ key: 'F1', a: { w: 'G4' }, b: { w: 'G5' }, day: 'Sun', label: 'Championship Series · Game 1', after: 'G5' });
    n.push({ key: 'F2', a: { w: 'G5' }, b: { w: 'G4' }, day: 'Mon', label: 'Championship Series · Game 2', after: 'F1' });
    n.push({ key: 'F3', a: { w: 'G4' }, b: { w: 'G5' }, day: 'Tue', label: 'Championship Series · Game 3 (if necessary)', cond: 'f3' });
  }
  return n;
}

const nodeOf = (ev, k) => ev.nodes.find(n => n.key === k);
const BYE = '__bye__';

function resolve(ev, ref) {
  if (!ref) return null;
  if ('seed' in ref) return ev.seeds[ref.seed] ?? BYE;
  const n = nodeOf(ev, ref.w || ref.l);
  if (!n) return null;
  return ref.w ? n.winner : n.loser;
}

function condMet(ev, node) {
  if (node.after && !nodeOf(ev, node.after)?.winner) return false;
  if (node.cond === 'g7') { const g6 = nodeOf(ev, 'G6'); return !!g6.winner && g6.winner !== resolve(ev, { w: 'G4' }); }
  if (node.cond === 'f3') { const a = nodeOf(ev, 'F1'), b = nodeOf(ev, 'F2'); return !!a.winner && !!b.winner && a.winner !== b.winner; }
  return true;
}

function eventGamesFor(season, ev, team) {
  return season.games.filter(g => g.event === ev.id && (g.home === team || g.away === team)).length;
}

// Create games whose teams are known; record winners of finished games.
function advanceEvent(season, ev, { type, week, name }) {
  // Re-derive winners from the games, so edited results flow through. Games
  // not yet played whose matchup no longer fits the bracket are removed.
  for (const n of ev.nodes) { n.winner = null; n.loser = null; }
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of ev.nodes) {
      if (node.winner || !node.gameId) continue;
      const g = season.games.find(x => x.id === node.gameId);
      if (!g) { node.gameId = null; continue; }
      const a = resolve(ev, node.a), b = resolve(ev, node.b);
      if (!a || !b) continue;
      const fits = condMet(ev, node) && new Set([a, b, g.home, g.away]).size === 2;
      if (!fits && !isFinal(g)) { season.games = season.games.filter(x => x !== g); node.gameId = null; continue; }
      if (isFinal(g)) { node.winner = winnerOf(g); node.loser = loserOf(g); changed = true; }
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const node of ev.nodes) {
      if (node.winner) continue;
      if (node.gameId) {
        const g = season.games.find(x => x.id === node.gameId);
        if (!g) { node.gameId = null; changed = true; continue; }
        if (isFinal(g)) { node.winner = winnerOf(g); node.loser = loserOf(g); changed = true; }
        continue;
      }
      if (!condMet(ev, node)) continue;
      const a = resolve(ev, node.a), b = resolve(ev, node.b);
      if (!a || !b) continue;
      if (a === BYE || b === BYE) { node.winner = a === BYE ? b : a; node.loser = null; if (node.winner === BYE) node.winner = null; changed = true; continue; }
      const ia = ev.seeds.indexOf(a), ib = ev.seeds.indexOf(b);
      let home = ia <= ib ? a : b, away = home === a ? b : a;
      if (node.key === 'F2') [home, away] = [away, home];
      const hosted = ev.host && (home === ev.host || away === ev.host);
      if (hosted && away === ev.host) [home, away] = [away, home];
      const g = blankGame(season, {
        type, week, day: node.day, order: DAY_ORDER[node.day] + (['Mon', 'Tue'].includes(node.day) ? 7 : 0) + (node.key === 'G6' ? 0.5 : 0),
        home, away, neutral: !hosted, event: ev.id, node: node.key,
        label: `${name} · ${node.label}`,
        homeSlot: eventGamesFor(season, ev, home) % 3, awaySlot: eventGamesFor(season, ev, away) % 3,
      });
      season.games.push(g);
      node.gameId = g.id;
      changed = true;
    }
  }
  ev.champion = eventChampion(ev);
  return ev.champion;
}

function eventChampion(ev) {
  if (ev.kind === 'single') { const last = ev.nodes[ev.nodes.length - 1]; return last.winner || null; }
  if (ev.kind === 'regional') {
    const g6 = nodeOf(ev, 'G6'), g7 = nodeOf(ev, 'G7');
    if (g7.winner) return g7.winner;
    if (g6.winner && g6.winner === resolve(ev, { w: 'G4' })) return g6.winner;
    return null;
  }
  const wins = {};
  for (const k of ['F1', 'F2', 'F3']) { const w = nodeOf(ev, k).winner; if (w) wins[w] = (wins[w] || 0) + 1; }
  return Object.keys(wins).find(t => wins[t] >= 2) || null;
}

export function runnerUp(ev) {
  if (!ev?.champion) return null;
  const finals = ev.kind === 'mcws' ? ['F1'] : ev.kind === 'regional' ? ['G6'] : [ev.nodes[ev.nodes.length - 1].key];
  const n = nodeOf(ev, finals[0]);
  return n.winner === ev.champion ? n.loser : n.winner;
}

// ---------- conference tournaments ----------

export function confTourneySeeds(season, conf) {
  const recs = records(season, g => g.type === 'regular'), r = rpi(season, g => g.type === 'regular');
  return confStandings(season, conf, recs, r).map(x => x.team);
}

export function setupConfTourneys(season) {
  season.post ||= {};
  season.post.confT = {};
  for (const conf of conferences(season)) {
    const n = Object.values(season.teams).filter(t => t.conference === conf).length;
    const size = Math.min(n, season.settings.confTourney?.[conf] ?? defaultConfTourneySize(n));
    if (size < 2) continue;
    const seeds = confTourneySeeds(season, conf).slice(0, size);
    season.post.confT[conf] = { id: `ct-${conf}`, kind: 'single', conf, size, seeds, nodes: singleElim(size), champion: null };
  }
  season.phase = 'conf';
}

// Replace a conference tournament's seeds (only before any of its games are played).
export function reseedConfTourney(season, conf, seeds) {
  const ev = season.post.confT[conf];
  const ids = new Set(ev.nodes.map(n => n.gameId).filter(Boolean));
  if (season.games.some(g => ids.has(g.id) && isFinal(g))) throw new Error('That tournament has already started.');
  season.games = season.games.filter(g => !ids.has(g.id));
  ev.seeds = seeds;
  ev.nodes = singleElim(ev.size);
  ev.champion = null;
}

// ---------- selection ----------

// The committee's order: RPI rank and the latest poll, weighted 60/40.
export function committeeOrder(season) {
  const r = rpi(season);
  const pr = pollRankMap(latestPoll(season));
  const teams = Object.keys(season.teams);
  const score = t => 0.6 * (r[t].rank ?? 99) + 0.4 * (pr[t] ?? 35);
  return teams.sort((a, b) => score(a) - score(b) || r[b].rpi - r[a].rpi);
}

export function autoBids(season) {
  const out = {};
  const recs = records(season, g => g.type === 'regular'), r = rpi(season, g => g.type === 'regular');
  for (const conf of conferences(season)) {
    const ev = season.post?.confT?.[conf];
    out[conf] = season.overrides?.autoBids?.[conf] || ev?.champion || regSeasonChamp(season, conf, recs, r);
  }
  return out;
}

export function proposeField(season, size = FIELD_SIZE) {
  const order = committeeOrder(season);
  const autos = autoBids(season);
  const autoSet = new Set(Object.values(autos).filter(Boolean));
  const field = [...autoSet];
  for (const t of order) { if (field.length >= size) break; if (!field.includes(t)) field.push(t); }
  const seeded = order.filter(t => field.includes(t));
  season.post.field = seeded.map((t, i) => ({ team: t, seed: i + 1, bid: autoSet.has(t) ? 'auto' : 'at-large', conf: season.teams[t].conference }));
  season.post.lastIn = order.filter(t => field.includes(t) && !autoSet.has(t)).slice(-4);
  season.post.firstOut = order.filter(t => !field.includes(t)).slice(0, 4);
  season.phase = 'selection';
}

// Serpentine pods: regional 1 gets seeds 1, 8, 9, 16 and so on.
export function pods(field) {
  const n = field.length / 4, out = Array.from({ length: n }, () => []);
  field.forEach((f, i) => { const rnd = Math.floor(i / n); const k = rnd % 2 === 0 ? i % n : n - 1 - (i % n); out[k].push(f.team); });
  return out;
}

export function lockField(season) {
  const field = [...season.post.field].sort((a, b) => a.seed - b.seed);
  season.post.regionals = pods(field).map((teams, i) => ({
    id: `reg-${i + 1}`, kind: 'regional', seeds: teams, host: teams[0], nodes: doubleElim('g7'), champion: null,
    name: `${teams[0]} Regional`,
  }));
  season.phase = 'regionals';
}

// ---------- driver ----------

// Advance everything that can advance. Call after any result changes.
export function progress(season) {
  if (!season.post) season.post = {};
  const p = season.post;
  if (season.phase === 'regular' && regularSeasonDone(season) && season.games.some(g => g.type === 'regular')) setupConfTourneys(season);
  if (p.confT) for (const ev of Object.values(p.confT)) advanceEvent(season, ev, { type: 'conf', week: WEEK.conf, name: `${ev.conf} Tournament` });
  if (season.phase === 'conf' && Object.values(p.confT || {}).every(ev => ev.champion)) proposeField(season);
  if (p.regionals) for (const ev of p.regionals) advanceEvent(season, ev, { type: 'regional', week: WEEK.regional, name: ev.name });
  if (season.phase === 'regionals' && p.regionals.every(ev => ev.champion)) {
    const seedOf = t => p.field.find(f => f.team === t)?.seed ?? 99;
    const teams = p.regionals.map(ev => ev.champion).sort((a, b) => seedOf(a) - seedOf(b));
    p.mcws = { id: 'mcws', kind: 'mcws', seeds: teams, host: null, nodes: doubleElim('series'), champion: null };
    season.phase = 'mcws';
  }
  if (p.regionals && season.phase !== 'regionals' && !p.regionals.every(ev => ev.champion)) {
    // A regional result was changed after the MCWS was set; rebuild it if it hasn't started.
    const started = season.games.some(g => g.type === 'mcws' && isFinal(g));
    if (!started) { season.games = season.games.filter(g => g.type !== 'mcws'); p.mcws = null; p.champion = null; p.runnerUp = null; delete season.polls.final; season.phase = 'regionals'; }
  }
  if (p.mcws) {
    advanceEvent(season, p.mcws, { type: 'mcws', week: WEEK.mcws, name: season.settings.mcwsName || "Men's College World Series" });
    if (!p.mcws.champion && season.phase === 'complete') { p.champion = null; p.runnerUp = null; delete season.polls.final; season.phase = 'mcws'; }
    if (p.mcws.champion && season.phase !== 'complete') {
      p.champion = p.mcws.champion;
      p.runnerUp = runnerUp(p.mcws);
      season.phase = 'complete';
      season.polls.final = generatePoll(season, 'final', { final: true, postBonus: postseasonBonus(season) });
    }
  }
}

export function postseasonBonus(season) {
  const p = season.post, b = {};
  const add = (t, x) => { if (t) b[t] = Math.max(b[t] || 0, x); };
  for (const ev of Object.values(p.confT || {})) add(ev.champion, 0.3);
  for (const ev of p.regionals || []) { for (const t of ev.seeds) add(t, 0.6); add(runnerUp(ev), 1.5); }
  for (const t of p.mcws?.seeds || []) add(t, 5);
  add(p.runnerUp, 8); add(p.champion, 10);
  return b;
}

// How far each team got (for team pages and history).
export function postseasonFinish(season, team) {
  const p = season.post || {};
  if (p.champion === team) return 'National champion';
  if (p.runnerUp === team) return 'MCWS runner-up';
  if (p.mcws?.seeds.includes(team)) return 'Men\'s College World Series';
  const reg = p.regionals?.find(ev => ev.seeds.includes(team));
  if (reg) return reg.champion === team ? 'Regional champion' : 'NCAA Regional';
  return null;
}

export function allEvents(season) {
  const p = season.post || {};
  return [...Object.values(p.confT || {}), ...(p.regionals || []), ...(p.mcws ? [p.mcws] : [])];
}

// The two teams a bracket node will have (null where still undecided).
export function nodeTeams(ev, node) {
  const f = ref => { const t = resolve(ev, ref); return t === BYE ? 'BYE' : t; };
  return [f(node.a), f(node.b)];
}
export function nodeNeeded(ev, node) { return !node.cond || condMet(ev, node); }
