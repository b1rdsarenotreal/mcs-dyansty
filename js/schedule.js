// Regular-season schedule: 14 weeks. Weeks 1–4 are non-conference weekend
// series, weeks 5–14 are conference series (round robin, three games each),
// and from week 2 on every team also plays a Tuesday midweek game.
// Teams without a conference series in a week get a non-conference series.

import { rng, shuffle, hashStr } from './util.js';

export const REG_WEEKS = 14;
export const NONCONF_WEEKS = 4;
export const DAY_ORDER = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function blankGame(season, fields) {
  return {
    id: season.nextId++, type: 'regular', week: 1, day: 'Fri', order: DAY_ORDER.Fri,
    home: null, away: null, neutral: false, confGame: false, series: null, label: '',
    final: false, homeLine: [], awayLine: [], homeR: null, homeH: null, homeE: null, awayR: null, awayH: null, awayE: null,
    pitching: null, source: null, ...fields,
  };
}

// Circle-method round robin. Returns rounds of [a, b] pairs (null = bye).
export function roundRobin(teams, r) {
  const list = shuffle(teams, r);
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let k = 0; k < n - 1; k++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      pairs.push(k % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

// Pair teams across conferences, avoiding repeat opponents when possible.
function crossPairs(pool, teams, met, r, played = null) {
  // With an odd number, the team that has played the most sits out.
  let idle = [];
  if (pool.length % 2 && played) {
    const most = Math.max(...pool.map(t => played[t]));
    const cands = pool.filter(t => played[t] === most);
    idle = [cands[Math.floor(r() * cands.length)]];
    pool = pool.filter(t => t !== idle[0]);
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const left = shuffle(pool, r), pairs = [];
    let ok = true;
    while (left.length > 1) {
      const a = left.shift();
      let j = left.findIndex(b => teams[b].conference !== teams[a].conference && !met.has(key(a, b)));
      if (j < 0 && attempt > 120) j = left.findIndex(b => teams[b].conference !== teams[a].conference);
      if (j < 0 && attempt > 170) j = 0;
      if (j < 0) { ok = false; break; }
      pairs.push([a, left.splice(j, 1)[0]]);
    }
    if (ok) return { pairs, idle: [...idle, ...left] };
  }
  return { pairs: [], idle: [...idle, ...pool] };
}
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function generateSchedule(season, seed = hashStr(String(season.year))) {
  const r = rng(seed);
  const teams = season.teams;
  const names = Object.keys(teams);
  const homeCount = Object.fromEntries(names.map(n => [n, 0]));
  const played = Object.fromEntries(names.map(n => [n, 0]));
  const metSeries = new Set(), metMid = new Set();
  const games = [];
  let seriesNo = 1;

  const orient = (a, b) => {
    if (homeCount[a] > homeCount[b]) return [b, a];
    if (homeCount[a] < homeCount[b]) return [a, b];
    return r() < 0.5 ? [a, b] : [b, a];
  };
  const addSeries = (week, home, away, conf) => {
    const sid = `${season.year}-${seriesNo++}`;
    for (const day of ['Fri', 'Sat', 'Sun']) {
      games.push(blankGame(season, { week, day, order: DAY_ORDER[day], home, away, confGame: conf, series: sid }));
    }
    homeCount[home] += 3; played[home] += 3; played[away] += 3;
    metSeries.add(key(home, away));
  };

  // Conference rounds placed into weeks 5–14.
  const confWeeks = REG_WEEKS - NONCONF_WEEKS;
  const byConf = {};
  for (const n of names) (byConf[teams[n].conference] ||= []).push(n);
  const weekPairs = {}; // week -> conference pairs
  for (const [conf, list] of Object.entries(byConf)) {
    if (list.length < 2) continue;
    let rounds = roundRobin(list, r);
    if (rounds.length > confWeeks) rounds = rounds.slice(0, confWeeks);
    // Spread open weeks through the conference season.
    const weeks = [];
    const open = confWeeks - rounds.length;
    const openWeeks = new Set(shuffle([...Array(confWeeks).keys()].slice(1), r).slice(0, open));
    for (let w = 0; w < confWeeks; w++) if (!openWeeks.has(w)) weeks.push(NONCONF_WEEKS + 1 + w);
    rounds.forEach((pairs, i) => { (weekPairs[weeks[i]] ||= []).push(...pairs.filter(([a, b]) => a && b).map(p => [...p, conf])); });
  }

  for (let week = 1; week <= REG_WEEKS; week++) {
    const busy = new Set();
    for (const [a, b] of weekPairs[week] || []) {
      const [h, aw] = orient(a, b);
      addSeries(week, h, aw, true); busy.add(a); busy.add(b);
    }
    const free = names.filter(n => !busy.has(n));
    const { pairs } = crossPairs(free, teams, metSeries, r, played);
    for (const [a, b] of pairs) { const [h, aw] = orient(a, b); addSeries(week, h, aw, false); }

    if (week >= 2) {
      const { pairs: mids } = crossPairs(names, teams, metMid, r, played);
      for (const [a, b] of mids) {
        const [h, aw] = orient(a, b);
        games.push(blankGame(season, { week, day: 'Tue', order: DAY_ORDER.Tue, home: h, away: aw }));
        homeCount[h]++; played[a]++; played[b]++; metMid.add(key(a, b));
      }
    }
  }
  return games;
}
