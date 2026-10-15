// Regular-season schedule. Its length comes from the season's settings
// (12 weeks by default). The last weeks are conference series (round robin,
// three games each). A conference's size sets when its conference play
// starts: one week per round of its round robin, up to 9 weeks, all ending on
// the final weekend. The weeks before are non-conference weekend series. From week 4
// (a setting) until the week before the last, every team also plays a
// two-game midweek set: a Tuesday doubleheader or a
// Tuesday and Wednesday game against the same opponent (or, in older
// seasons, a single Tuesday game). Teams without a conference series in a
// week get a non-conference series.
// When `prev` (last season) is given, conference opponents who met last year
// swap home and away.
//
// Early-season tournaments: in the first weeks (3 by default, a setting),
// some teams play a Thursday-to-Sunday round robin instead of a weekend
// series: 5 or 6 teams, never two from the same conference, 4 or 5 games
// each, hosted by one of them. Every team plays one or two of them.
// Midweek sets come about every other week (a setting; or every week), with
// teams that played fewer weekend games getting a few more so season totals
// stay close together.

import { isIndependent } from './standings.js?v=20261015122354';
import { rng, shuffle, hashStr } from './util.js?v=20261015122354';

export const DEFAULT_REG_WEEKS = 12;
export const DEFAULT_MIDWEEK_START = 4;
export const DEFAULT_TOURNEY_WEEKS = 3;
export const MIDWEEK_FREQ = { half: 'About every other week', every: 'Every week' };
const TOURNEY_NAMES = ['Classic', 'Invitational', 'Challenge', 'Showcase', 'Kickoff', 'Tournament'];
export const MIDWEEK = { single: 'One game on Tuesday', doubleheader: 'Tuesday doubleheader', split: 'Tuesday and Wednesday', mixed: 'Mix of both' };

// Conference weeks for a season of `regWeeks` weeks whose largest
// conference round robin needs `rounds` weeks.
// No conference plays more than 9 weeks of conference series. A conference
// with more than 10 teams plays 9 of its members each season (which ones
// changes every year); smaller conferences start conference play later.
export const MAX_CONF_WEEKS = 9;
export function confWeeksFor(regWeeks, rounds) { return Math.max(1, Math.min(regWeeks - 2, MAX_CONF_WEEKS, Math.max(rounds, regWeeks - 4))); }
const rrRounds = n => (n < 2 ? 0 : n % 2 ? n : n - 1);
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
function crossPairs(pool, teams, met, r, played = null, sat = null) {
  // With an odd number, one team sits out: whoever has played the most,
  // then whoever has sat out least.
  let idle = [];
  if (pool.length % 2 && played) {
    const most = Math.max(...pool.map(t => played[t]));
    const top = pool.filter(t => played[t] === most);
    const fewest = Math.min(...top.map(t => sat?.[t] || 0));
    const cands = top.filter(t => (sat?.[t] || 0) === fewest);
    idle = [cands[Math.floor(r() * cands.length)]];
    pool = pool.filter(t => t !== idle[0]);
    if (sat) sat[idle[0]] = (sat[idle[0]] || 0) + 1;
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const left = shuffle(pool, r), pairs = [];
    let ok = true;
    while (left.length > 1) {
      const a = left.shift();
      let j = left.findIndex(b => !rival(teams, a, b) && !met.has(key(a, b)));
      if (j < 0 && attempt > 120) j = left.findIndex(b => !rival(teams, a, b));
      if (j < 0) { ok = false; break; }
      pairs.push([a, left.splice(j, 1)[0]]);
    }
    if (ok) return { pairs, idle: [...idle, ...left] };
  }
  return { pairs: [], idle: [...idle, ...pool] };
}
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
// Conference rivals; independents are nobody's rivals.
const rival = (teams, a, b) => teams[a].conference === teams[b].conference && !isIndependent(teams[a].conference);

export function generateSchedule(season, seed = hashStr(String(season.year)), prev = null) {
  const r = rng(seed);
  const teams = season.teams;
  const names = Object.keys(teams);
  const homeCount = Object.fromEntries(names.map(n => [n, 0]));
  const played = Object.fromEntries(names.map(n => [n, 0]));
  const metSeries = new Set(), metMid = new Set(), metThu = new Set();
  const games = [];
  let seriesNo = 1;

  // Who hosted each conference series last season.
  const lastHost = new Map();
  for (const g of prev?.games || []) if (g.type === 'regular' && g.confGame) lastHost.set(key(g.home, g.away), g.home);
  const orientConf = (a, b) => {
    const h = lastHost.get(key(a, b));
    if (h === a) return [b, a];
    if (h === b) return [a, b];
    return orient(a, b);
  };
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

  const REG = season.settings?.regWeeks ?? DEFAULT_REG_WEEKS;
  const midweek = season.settings?.midweek ?? 'mixed';
  const midStart = season.settings?.midweekStart ?? DEFAULT_MIDWEEK_START;
  const midSkipLast = season.settings?.midweekSkipLast ?? true;
  season.regWeeks = REG;
  const byConf = {};
  for (const n of names) if (!isIndependent(teams[n].conference)) (byConf[teams[n].conference] ||= []).push(n);
  // Conference rounds go in the last weeks of the season.
  const confWeeks = confWeeksFor(REG, Math.max(0, ...Object.values(byConf).map(l => rrRounds(l.length))));
  const weekPairs = {}; // week -> conference pairs
  // A conference that needs fewer rounds than there are conference weeks
  // starts its conference play later: its open weeks come first, so once a
  // conference starts it plays every weekend until the end of the season.
  for (const [conf, list] of Object.entries(byConf).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (list.length < 2) continue;
    let rounds = roundRobin(list, r);
    if (rounds.length > confWeeks) rounds = rounds.slice(0, confWeeks);
    const first = REG - rounds.length + 1;
    rounds.forEach((pairs, i) => { (weekPairs[first + i] ||= []).push(...pairs.filter(([a, b]) => a && b).map(p => [...p, conf])); });
  }

  // ---- early-season tournaments: who plays in which week ----
  const TW = Math.max(0, Math.min(season.settings?.tourneyWeeks ?? DEFAULT_TOURNEY_WEEKS, REG));
  const confBusy = w => new Set((weekPairs[w] || []).flatMap(([a, b]) => [a, b]));
  const tCount = Object.fromEntries(names.map(n => [n, 0]));
  const second = new Set(shuffle(names, r).slice(0, Math.round(names.length / 2))); // about half play two
  const eligibleWeeks = n => Array.from({ length: TW }, (_, i) => i + 1).filter(w => !confBusy(w).has(n));
  let tNo = 1;
  const tourneyWeek = (week, free) => {
    if (week > TW) return [];
    const left = TW - week + 1;
    const want = n => tCount[n] < (second.has(n) ? 2 : 1);
    // Teams that still need a first tournament and are running out of weeks go first.
    const remaining = n => eligibleWeeks(n).filter(w => w >= week).length;
    const wanting = free.filter(want);
    // Teams that have already played one (but not two) can fill out an event.
    const cands = shuffle(free.filter(n => tCount[n] < 2), r);
    const must = wanting.filter(n => tCount[n] === 0 && remaining(n) <= 1);
    // Enough events for the teams that must play now, spread by conference.
    const byC = {};
    for (const n of wanting.filter(n => tCount[n] === 0)) (byC[teams[n].conference] ||= []).push(n);
    const perConf = Math.max(0, ...Object.values(byC).map(l => Math.ceil(l.length / left)));
    const target = Math.round((names.length * 1.5) / Math.max(1, TW));
    let E = Math.max(Math.round(target / 5.5), Math.ceil(must.length / 6), perConf);
    E = Math.min(E, Math.floor(cands.length / 5));
    if (!wanting.length) E = 0;
    // Build each event one team at a time, always drawing from the conference
    // with the most teams still waiting, so later weeks aren't left with
    // teams from only a few conferences.
    const events = [];
    const used = new Set();
    const pickFrom = (ev, size) => {
      while (ev.length < size) {
        const open = cands.filter(n => !used.has(n) && !ev.some(x => rival(teams, x, n)));
        if (!open.length) return;
        const demand = {};
        for (const n of names) if (want(n)) demand[teams[n].conference] = (demand[teams[n].conference] || 0) + (tCount[n] === 0 ? 3 : 1);
        const prio = n => (tCount[n] === 0 ? 0 : 10) + (want(n) ? 0 : 30) + remaining(n) - demand[teams[n].conference] * 0.5 + r() * 0.1;
        const n = open.reduce((x, y) => (prio(y) < prio(x) ? y : x));
        ev.push(n); used.add(n);
      }
    };
    for (let e = 0; e < E; e++) { const ev = []; pickFrom(ev, 5); if (ev.length < 5) { ev.forEach(n => used.delete(n)); break; } events.push(ev); }
    // Sixth teams where there's room, starting with teams that haven't played one.
    for (const ev of events) if (wanting.some(n => !used.has(n) && tCount[n] === 0 && !ev.some(x => rival(teams, x, n))) || r() < 0.6) pickFrom(ev, 6);
    const out = [];
    for (const ev of events) out.push(ev);
    for (const ev of out) {
      const host = [...ev].sort((a, b) => homeCount[a] - homeCount[b] || (r() - 0.5))[0];
      const id = `${season.year}-t${tNo++}`;
      const name = `${host} ${TOURNEY_NAMES[hashStr(`${season.year}|${host}|${week}`) % TOURNEY_NAMES.length]}`;
      const rounds = roundRobin(ev, r);
      // Five rounds over four days: Saturday has two.
      const slots = [['Thu', 0], ['Fri', 0], ['Sat', 0], ['Sat', 0.5], ['Sun', 0]];
      rounds.forEach((pairs, k) => {
        const [day, half] = slots[k] || ['Sun', 0.5];
        pairs.filter(([a, b]) => a && b).forEach(([a, b], i) => {
          let home, away;
          if (a === host || b === host) { home = host; away = a === host ? b : a; } else [home, away] = orient(a, b);
          const atHost = home === host;
          games.push(blankGame(season, { week, day, order: DAY_ORDER[day] + half + i * 0.01, home, away, tourney: id, label: name, ...(atHost ? {} : { neutral: true, site: host }) }));
          if (atHost) homeCount[host]++;
          played[a]++; played[b]++;
          metSeries.add(key(a, b));
        });
      });
      for (const n of ev) tCount[n]++;
    }
    return out.flat();
  };

  // ---- weekends ----
  const satWeekend = {};
  for (let week = 1; week <= REG; week++) {
    const busy = new Set();
    for (const [a, b] of weekPairs[week] || []) {
      const [h, aw] = orientConf(a, b);
      addSeries(week, h, aw, true); busy.add(a); busy.add(b);
    }
    const inTourney = new Set(tourneyWeek(week, names.filter(n => !busy.has(n))));
    const free = names.filter(n => !busy.has(n) && !inTourney.has(n));
    const { pairs, idle } = crossPairs(free, teams, metSeries, r, played, satWeekend);
    for (const [a, b] of pairs) { const [h, aw] = orient(a, b); addSeries(week, h, aw, false); }
    // A team without a weekend series (a conference bye with nobody else free,
    // or the odd team out) plays one Thursday game against a team from
    // another conference, preferably one it hasn't played and one with
    // fewer games so far. Teams in a tournament that week are busy Thursday.
    const thu = new Set();
    for (const a of shuffle(idle, r)) {
      const opts = names.filter(b => b !== a && !thu.has(b) && !idle.includes(b) && !inTourney.has(b) && !rival(teams, a, b));
      if (!opts.length) continue;
      const score = b => (metThu.has(key(a, b)) ? 100 : 0) + (metSeries.has(key(a, b)) ? 10 : 0) + played[b] + r();
      const b = opts.reduce((x, y) => (score(y) < score(x) ? y : x));
      const [h, aw] = orient(a, b);
      games.push(blankGame(season, { week, day: 'Thu', order: DAY_ORDER.Thu, home: h, away: aw }));
      homeCount[h]++; played[a]++; played[b]++;
      thu.add(a); thu.add(b); metThu.add(key(a, b));
    }
  }

  // ---- midweek ----
  const midWeeks = [];
  for (let w = midStart; w <= REG - (midSkipLast ? 1 : 0); w++) midWeeks.push(w);
  const freq = season.settings?.midweekFreq ?? 'half';
  const perSet = midweek === 'single' ? 1 : 2;
  // Sets each team should play: every week, or about half the weeks with
  // more for teams that played fewer weekend games (and fewer for more).
  const avgWeekend = names.reduce((a, n) => a + played[n], 0) / (names.length || 1);
  const need = Object.fromEntries(names.map(n => [n, freq === 'every' ? midWeeks.length
    : Math.max(0, Math.min(midWeeks.length, Math.round(midWeeks.length * 0.6 + (avgWeekend - played[n]) / perSet)))]));
  let midNo = 1;
  const satMid = {};
  midWeeks.forEach((week, i) => {
    const weeksLeft = midWeeks.length - i;
    const pool = freq === 'every' ? names : names.filter(n => need[n] > 0 && (need[n] >= weeksLeft || r() < need[n] / weeksLeft));
    const { pairs: mids } = crossPairs(pool, teams, metMid, r, played, satMid);
    for (const [a, b] of mids) {
      const [h, aw] = orient(a, b);
      const fmt = midweek === 'mixed' ? (r() < 0.5 ? 'doubleheader' : 'split') : midweek;
      if (fmt === 'single') {
        games.push(blankGame(season, { week, day: 'Tue', order: DAY_ORDER.Tue, home: h, away: aw }));
        homeCount[h]++; played[a]++; played[b]++;
      } else {
        const sid = `${season.year}-m${midNo++}`;
        const two = fmt === 'doubleheader'
          ? [{ day: 'Tue', order: DAY_ORDER.Tue, label: 'Doubleheader · Game 1' }, { day: 'Tue', order: DAY_ORDER.Tue + 0.5, label: 'Doubleheader · Game 2' }]
          : [{ day: 'Tue', order: DAY_ORDER.Tue }, { day: 'Wed', order: DAY_ORDER.Wed }];
        for (const x of two) games.push(blankGame(season, { week, home: h, away: aw, series: sid, midweek: fmt, ...x }));
        homeCount[h] += 2; played[a] += 2; played[b] += 2;
      }
      need[a]--; need[b]--;
      metMid.add(key(a, b));
    }
  });
  return games;
}
