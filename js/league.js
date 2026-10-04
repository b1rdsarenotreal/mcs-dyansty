// League (dynasty) lifecycle: creating the league, saving results,
// simulating, adding teams and conferences, and rolling into new seasons.

import { START_YEAR, CONFERENCES, seedTeams, makeTeam, pitcherName } from './data.js';
import { generateSchedule, blankGame, DAY_ORDER } from './schedule.js';
import { simulateGame } from './sim.js';
import { generatePoll, releaseDuePolls } from './polls.js';
import { progress, lockField, WEEK } from './postseason.js';
import { isFinal } from './standings.js';
import { rng, normal, clamp, hashStr } from './util.js';

export const SCHEMA_VERSION = 1;
export const LAST_POLL_WEEK = 15;

export function defaultSettings() {
  return { volatility: 1, runRule: true, tiebreaker: true, confTourney: {}, mcwsName: "Men's College World Series", development: 'normal' };
}

export function newSeason(year, teams, settings = defaultSettings()) {
  const season = {
    year, teams, games: [], polls: {}, post: {}, phase: 'regular', nextId: 1,
    settings: JSON.parse(JSON.stringify(settings)), overrides: { regChamps: {}, autoBids: {} }, carryPoll: null,
  };
  season.games = generateSchedule(season);
  return season;
}

export function newLeague({ name = 'MCS Dynasty', year = START_YEAR, teams = seedTeams(), conferences = CONFERENCES } = {}) {
  const season = newSeason(year, teams);
  season.polls[0] = generatePoll(season, 0);
  return {
    schema: SCHEMA_VERSION, name, currentYear: year,
    conferences: JSON.parse(JSON.stringify(conferences)),
    seasons: { [year]: season },
  };
}

export const currentSeason = league => league.seasons[league.currentYear];

// ---------- results ----------

export function applyResult(g, res, source = 'sim') {
  g.homeLine = res.homeLine; g.awayLine = res.awayLine;
  g.homeR = res.home.R; g.homeH = res.home.H; g.homeE = res.home.E;
  g.awayR = res.away.R; g.awayH = res.away.H; g.awayE = res.away.E;
  g.wp = res.wp ?? null; g.lp = res.lp ?? null; g.sv = res.sv ?? null;
  g.pitching = res.pitching ?? null; g.runRule = !!res.runRule;
  g.final = true; g.source = source;
}

export function clearResult(g) {
  Object.assign(g, { final: false, homeLine: [], awayLine: [], homeR: null, homeH: null, homeE: null, awayR: null, awayH: null, awayE: null, wp: null, lp: null, sv: null, pitching: null, source: null, runRule: false });
}

export function simResult(season, g, seed) {
  const s = season.settings;
  return simulateGame(season.teams[g.home], season.teams[g.away], g, { seed, volatility: s.volatility, runRule: s.runRule, tiebreaker: s.tiebreaker });
}

// After any change: advance brackets and release polls that are due.
export function afterChange(season) {
  progress(season);
  releaseDuePolls(season, LAST_POLL_WEEK);
}

// Simulate unplayed games matching `filter`, in calendar order. Postseason
// games appear as earlier rounds finish, so keep going until none are left.
export function simGames(season, filter = () => true, { max = 2000, autoLock = false } = {}) {
  let n = 0;
  for (;;) {
    afterChange(season);
    if (autoLock && season.phase === 'selection') { lockField(season); afterChange(season); }
    const next = season.games.filter(g => !isFinal(g) && filter(g)).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id)[0];
    if (!next || n >= max) break;
    applyResult(next, simResult(season, next));
    n++;
  }
  afterChange(season);
  return n;
}

// ---------- editing ----------

export function addGame(season, fields) {
  const g = blankGame(season, { ...fields, order: DAY_ORDER[fields.day] ?? 4 });
  season.games.push(g);
  return g;
}

export function deleteGame(season, id) { season.games = season.games.filter(g => g.id !== id); }

export function addTeam(league, season, fields) {
  if (!fields.school?.trim()) throw new Error('Give the team a name.');
  if (season.teams[fields.school]) throw new Error('There is already a team with that name.');
  if (!league.conferences[fields.conference]) throw new Error('Pick a conference.');
  season.teams[fields.school] = makeTeam(fields);
  return season.teams[fields.school];
}

// Removes the team and its unplayed games. Played games stay in the record.
export function removeTeam(season, school) {
  delete season.teams[school];
  season.games = season.games.filter(g => isFinal(g) || (g.home !== school && g.away !== school));
}

export function renameTeam(league, season, from, to) {
  to = to.trim();
  if (!to || to === from) return;
  if (season.teams[to]) throw new Error('There is already a team with that name.');
  for (const s of Object.values(league.seasons)) {
    if (!s.teams[from]) continue;
    s.teams[to] = { ...s.teams[from], school: to };
    delete s.teams[from];
    const swap = x => (x === from ? to : x);
    for (const g of s.games) { g.home = swap(g.home); g.away = swap(g.away); }
    for (const p of Object.values(s.polls || {})) { for (const r of p.ranks) r.team = swap(r.team); for (const r of p.others || []) r.team = swap(r.team); }
    const post = s.post || {};
    for (const ev of [...Object.values(post.confT || {}), ...(post.regionals || []), ...(post.mcws ? [post.mcws] : [])]) {
      ev.seeds = ev.seeds.map(swap); ev.champion = swap(ev.champion); if (ev.host) ev.host = swap(ev.host);
      for (const n of ev.nodes) { n.winner = swap(n.winner); n.loser = swap(n.loser); }
    }
    if (post.field) for (const f of post.field) f.team = swap(f.team);
    post.champion = swap(post.champion); post.runnerUp = swap(post.runnerUp);
  }
}

export function addConference(league, name, { abbr, color = '#555555' } = {}) {
  name = name.trim();
  if (!name) throw new Error('Give the conference a name.');
  if (league.conferences[name]) throw new Error('That conference already exists.');
  league.conferences[name] = { abbr: abbr || name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4), color };
}

export function renameConference(league, from, to) {
  to = to.trim();
  if (!to || to === from) return;
  if (league.conferences[to]) throw new Error('That conference already exists.');
  league.conferences[to] = league.conferences[from];
  delete league.conferences[from];
  for (const s of Object.values(league.seasons)) {
    for (const t of Object.values(s.teams)) if (t.conference === from) t.conference = to;
    if (s.settings.confTourney?.[from] != null) { s.settings.confTourney[to] = s.settings.confTourney[from]; delete s.settings.confTourney[from]; }
    for (const k of ['regChamps', 'autoBids']) if (s.overrides?.[k]?.[from]) { s.overrides[k][to] = s.overrides[k][from]; delete s.overrides[k][from]; }
    if (s.post?.confT?.[from]) { s.post.confT[to] = { ...s.post.confT[from], conf: to }; delete s.post.confT[from]; }
    for (const f of s.post?.field || []) if (f.conf === from) f.conf = to;
  }
}

export function deleteConference(league, season, name) {
  if (Object.values(season.teams).some(t => t.conference === name)) throw new Error('Move its teams to another conference first.');
  const usedEarlier = Object.values(league.seasons).some(s => Object.values(s.teams).some(t => t.conference === name));
  if (!usedEarlier) delete league.conferences[name];
  else league.conferences[name].retired = true;
}

// Rebuild the regular-season schedule (only before any regular-season game is played).
export function rebuildSchedule(season) {
  if (season.games.some(g => g.type === 'regular' && isFinal(g))) throw new Error('Games have already been played this season.');
  season.games = season.games.filter(g => g.type !== 'regular');
  season.games.push(...generateSchedule(season, hashStr(`${season.year}-${Date.now()}`)));
  season.polls = {};
  season.polls[0] = generatePoll(season, 0);
}

// ---------- next season ----------

const DEV = { none: 0, small: 2, normal: 3.5, big: 5.5 };

export function developTeams(teams, year, level = 'normal') {
  const r = rng(hashStr(`dev-${year}`));
  const sd = DEV[level] ?? DEV.normal;
  const out = JSON.parse(JSON.stringify(teams));
  for (const t of Object.values(out)) {
    for (const k of ['off', 'pit', 'def']) t[k] = clamp(Math.round(70 + (t[k] - 70) * (sd ? 0.9 : 1) + normal(r) * sd), 40, 99);
    // Graduation: some pitchers move on and new ones join the staff.
    t.staff = t.staff.map(n => (sd && r() < 0.3 ? pitcherName(r) : n));
  }
  return out;
}

export function startNextSeason(league) {
  const prev = currentSeason(league);
  const year = prev.year + 1;
  const teams = developTeams(prev.teams, year, prev.settings.development);
  const season = newSeason(year, teams, prev.settings);
  season.carryPoll = prev.polls.final || null;
  season.polls[0] = generatePoll(season, 0);
  league.seasons[year] = season;
  league.currentYear = year;
  return season;
}

export function seasonWeeks(season) {
  const weeks = [...new Set(season.games.map(g => g.week))].sort((a, b) => a - b);
  return weeks;
}

export const WEEK_NAMES = { [WEEK.conf]: 'Conf. Tournaments', [WEEK.regional]: 'Regionals', [WEEK.mcws]: 'MCWS' };
export const weekName = w => WEEK_NAMES[w] || `Week ${w}`;
