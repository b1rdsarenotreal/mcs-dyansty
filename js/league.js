// League (dynasty) lifecycle: creating the league, saving results,
// simulating, adding teams and conferences, and rolling into new seasons.

import { START_YEAR, CONFERENCES, COACHES, seedTeams, makeTeam } from './data.js';
import { generateSchedule, blankGame, DAY_ORDER } from './schedule.js';
import { simulateGame } from './sim.js';
import { generatePoll, releaseDuePolls } from './polls.js';
import { progress, lockField, WEEK } from './postseason.js';
import { isFinal } from './standings.js';
import { rng, normal, clamp, hashStr } from './util.js';

export const SCHEMA_VERSION = 2;
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
  g.runRule = !!res.runRule;
  g.final = true; g.source = source;
}

export function clearResult(g) {
  Object.assign(g, { final: false, homeLine: [], awayLine: [], homeR: null, homeH: null, homeE: null, awayR: null, awayH: null, awayE: null, source: null, runRule: false });
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

// Adds a team to a set of teams (a season's, or the offseason draft's).
export function addTeam(league, teams, fields) {
  fields = { ...fields, school: fields.school?.trim() };
  if (!fields.school) throw new Error('Give the team a name.');
  if (teams[fields.school]) throw new Error('There is already a team with that name.');
  if (!league.conferences[fields.conference]) throw new Error('Pick a conference.');
  teams[fields.school] = makeTeam(fields);
  return teams[fields.school];
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
  if (league.conferences[name]?.retired) { delete league.conferences[name].retired; league.conferences[name].color = color; return; }
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
  }
  return out;
}

// ---------- offseason ----------
// Once the champion is crowned, next season's teams live in a draft the
// commissioner can change: move teams between conferences, add or remove
// teams, change coaches and ratings. Starting the season builds the schedule.

export function beginOffseason(league) {
  const prev = currentSeason(league);
  if (prev.phase !== 'complete') throw new Error('Finish the season first.');
  if (!league.draft || league.draft.year !== prev.year + 1) {
    league.draft = { year: prev.year + 1, teams: developTeams(prev.teams, prev.year + 1, prev.settings.development), removed: {} };
  }
  return league.draft;
}

export function draftRemoveTeam(league, school) {
  const d = league.draft;
  d.removed[school] = d.teams[school];
  delete d.teams[school];
}

export function draftRestoreTeam(league, school) {
  const d = league.draft;
  if (!d.removed[school]) return;
  if (!league.conferences[d.removed[school].conference] || league.conferences[d.removed[school].conference].retired) {
    d.removed[school].conference = Object.keys(league.conferences).find(c => !league.conferences[c].retired);
  }
  d.teams[school] = d.removed[school];
  delete d.removed[school];
}

// Problems that would make next season's schedule lopsided.
export function draftWarnings(league) {
  const out = [];
  const count = {};
  for (const t of Object.values(league.draft.teams)) count[t.conference] = (count[t.conference] || 0) + 1;
  for (const [c, n] of Object.entries(count)) {
    if (n === 1) out.push(`${c} has only one team, so it has no conference games. It still gets an automatic bid.`);
    if (n > 11) out.push(`${c} has ${n} teams. The 10 conference weeks fit 11 teams at most, so some members won't play each other.`);
  }
  if (Object.keys(league.draft.teams).length < 16) out.push('The NCAA field needs at least 16 teams.');
  return out;
}

export function startNextSeason(league) {
  const prev = currentSeason(league);
  const year = prev.year + 1;
  const teams = league.draft?.year === year ? league.draft.teams : developTeams(prev.teams, year, prev.settings.development);
  if (Object.keys(teams).length < 16) throw new Error('The NCAA field needs at least 16 teams.');
  delete league.draft;
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

// Bring an older save up to date: no pitching staffs, and head coaches.
export function migrateLeague(league) {
  if ((league.schema || 1) >= SCHEMA_VERSION) return league;
  for (const se of Object.values(league.seasons)) {
    for (const t of Object.values(se.teams)) {
      delete t.staff;
      if (t.coach === undefined) t.coach = COACHES[t.school] || '';
    }
    for (const g of se.games) { for (const k of ['pitching', 'wp', 'lp', 'sv', 'homeStarter', 'awayStarter', 'homeSlot', 'awaySlot']) delete g[k]; }
  }
  if (league.draft) for (const t of Object.values(league.draft.teams)) { delete t.staff; if (t.coach === undefined) t.coach = COACHES[t.school] || ''; }
  league.schema = SCHEMA_VERSION;
  return league;
}
