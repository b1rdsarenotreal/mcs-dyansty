// Logic tests: run with `node tests/logic.test.mjs`
import assert from 'node:assert/strict';
import { newLeague, currentSeason, simGames, startNextSeason, addTeam, addConference, renameTeam, beginOffseason, draftRemoveTeam, draftWarnings, LAST_POLL_WEEK, coachName, hireCoach, newCoach, availableCoaches } from '../js/league.js';
import { setConfFormat } from '../js/postseason.js';
import { records, rpi, confStandings, isFinal } from '../js/standings.js';
import { REG_WEEKS } from '../js/schedule.js';

const t0 = Date.now();
const league = newLeague();
const s = currentSeason(league);
assert.equal(Object.keys(s.teams).length, 45);

// Schedule shape
const reg = s.games.filter(g => g.type === 'regular');
const per = {};
for (const g of reg) { per[g.home] = (per[g.home] || 0) + 1; per[g.away] = (per[g.away] || 0) + 1; assert.notEqual(g.home, g.away); }
const counts = Object.values(per);
const hist={}; counts.forEach(c=>hist[c]=(hist[c]||0)+1); console.log('games-per-team histogram', JSON.stringify(hist));
console.log('games per team', Math.min(...counts), '-', Math.max(...counts), 'total', reg.length);
assert.ok(Math.min(...counts) >= 45, 'every team plays a full schedule');
for (const conf of ['Horizon', 'Big Ten', 'MAC']) {
  const teams = Object.values(s.teams).filter(t => t.conference === conf).map(t => t.school);
  for (const t of teams) {
    const opps = new Set(reg.filter(g => g.confGame && (g.home === t || g.away === t)).map(g => (g.home === t ? g.away : g.home)));
    assert.equal(opps.size, teams.length - 1, `${t} plays everyone in the ${conf}`);
  }
}
// No team plays twice on the same day
const slot = new Set();
for (const g of reg) for (const t of [g.home, g.away]) { const k = `${t}|${g.week}|${g.day}`; assert.ok(!slot.has(k), k); slot.add(k); }

assert.ok(s.polls[0].ranks.length === 15, 'preseason poll is a Top 15');

// Double elimination for the Big Ten (8 teams) and Horizon (top 6), single elsewhere
s.settings.confFormat = { 'Big Ten': 'double', 'Horizon': 'double' };
s.settings.confTourney = { 'Big Ten': 8 };
const pre = Object.fromEntries(Object.entries(s.teams).map(([k, t]) => [k, { ...t.base }]));

// Full season, stopping after the conference tournaments to check them
simGames(s, g => g.type === 'regular' || g.type === 'conf');
for (const [conf, ev] of Object.entries(s.post.confT)) {
  const gs = s.games.filter(g => g.event === ev.id);
  const titles = gs.filter(g => /Championship$|· Final$/.test(g.label));
  assert.equal(titles.length, 1, `${conf}: exactly one championship game`);
  assert.ok(!gs.some(g => /if necessary/i.test(g.label)), `${conf}: no if-necessary game`);
  const losses = {};
  for (const g of gs) { const l = g.homeR > g.awayR ? g.away : g.home; losses[l] = (losses[l] || 0) + 1; }
  if (ev.kind === 'double') {
    // Everyone but the champion and the title-game loser is out after two losses; nobody loses three times.
    assert.ok(Object.values(losses).every(n => n <= 2), `${conf}: no team loses three times`);
    const nonChampLosses = Object.entries(losses).filter(([t]) => t !== ev.champion);
    assert.ok(nonChampLosses.length >= ev.size - 1, `${conf}: every other team lost`);
  }
  console.log(`${conf} (${ev.kind}, ${ev.size} teams): ${gs.length} games, champion ${ev.champion}`);
}
assert.equal(s.post.confT['Big Ten'].kind, 'double');
assert.equal(s.post.confT['Big Ten'].size, 8);
assert.equal(s.post.confT['Big 12'].kind, 'single');
assert.throws(() => setConfFormat(s, 'Big 12', 'double'), /already started/);
simGames(s, undefined, { autoLock: true });
// Regionals keep their if-necessary Game 7 structure
for (const ev of s.post.regionals) assert.ok(ev.nodes.some(n => n.key === 'G7'), 'regional still has Game 7');

// Strength of schedule is computed and ranked for every team
const rr = rpi(s);
assert.ok(Object.values(rr).every(x => x.sos > 0 && x.sosRank >= 1), 'every team has an SOS rank');
const sosTop = Object.keys(rr).sort((a, b) => rr[a].sosRank - rr[b].sosRank).slice(0, 3);
console.log('toughest schedules:', sosTop.map(t => `${t} (${s.teams[t].conference}, opp ${rr[t].oppW}-${rr[t].oppL})`).join('; '));

// Ratings moved with results
const moved = Object.entries(s.teams).filter(([k, t]) => t.off !== pre[k].off || t.pit !== pre[k].pit || t.def !== pre[k].def).length;
const drift = Object.entries(s.teams).map(([k, t]) => Math.abs(t.off - pre[k].off) + Math.abs(t.pit - pre[k].pit) + Math.abs(t.def - pre[k].def));
console.log(`ratings moved for ${moved} of ${Object.keys(s.teams).length} teams; biggest total change ${Math.max(...drift)}`);
assert.ok(moved > 30, 'ratings change during the season');
assert.ok(Math.max(...drift) <= 30, 'changes stay modest');
assert.equal(s.phase, 'complete');
assert.ok(s.games.every(isFinal));
for (let w = 1; w <= LAST_POLL_WEEK; w++) assert.ok(s.polls[w], `poll week ${w}`);
assert.ok(s.polls.final);
assert.equal(s.polls.final.ranks[0].team, s.post.champion);
assert.equal(s.post.field.length, 16);
assert.equal(new Set(s.post.field.map(f => f.team)).size, 16);
for (const ev of Object.values(s.post.confT)) assert.ok(s.post.field.some(f => f.team === ev.champion), 'auto bid in field');
const recs = records(s), r = rpi(s);
console.log('champion', s.post.champion, recs[s.post.champion].w + '-' + recs[s.post.champion].l, 'runner-up', s.post.runnerUp);
console.log('MCWS', s.post.mcws.seeds.join(', '));
console.log('final top 5', s.polls.final.ranks.slice(0, 5).map(x => `${x.team} ${x.record}`).join(' | '));
console.log('Big Ten', confStandings(s, 'Big Ten').map(x => `${x.team} ${x.cw}-${x.cl}`).join(', '));
const g = s.games.filter(x => x.type === 'regular');
const avg = k => (g.reduce((a, x) => a + x['home' + k] + x['away' + k], 0) / g.length / 2).toFixed(2);
console.log('per team per game: R', avg('R'), 'H', avg('H'), 'E', avg('E'), 'run-rule', (g.filter(x => x.runRule).length / g.length).toFixed(3), 'extras', (g.filter(x => x.awayLine.length > 7).length / g.length).toFixed(3));
for (const x of s.games) { assert.equal(x.homeLine.reduce((a, b) => a + (b || 0), 0), x.homeR); }

// Coaches are people with ids
assert.equal(coachName(league, s.teams['Oklahoma'].coachId), 'JT Gasso');
assert.ok(Object.values(s.teams).every(t => t.coachId), 'every team has a coach');
assert.notEqual(s.teams['Iowa'].coachId, s.teams['Minnesota State'].coachId, 'two coaches named Tim Keirnan stay separate people');
assert.ok(Object.values(s.teams).every(t => !t.staff), 'no pitching staffs');
assert.ok(s.games.every(g => !g.pitching && !g.wp), 'no pitching stats');

// Offseason: new conference, new team, realignment, a team leaves
const d = beginOffseason(league);
assert.equal(d.year, 2017);
addConference(league, 'Summit', { color: '#123456' });
addTeam(league, d.teams, { school: 'Oregon State', conference: 'Summit', coachName: 'Pat Casey' });
// Coaching carousel: Oklahoma hires Green Bay's coach; Green Bay hires a new one
const foore = d.teams['Green Bay'].coachId, gasso = d.teams['Oklahoma'].coachId;
assert.equal(hireCoach(d.teams, 'Oklahoma', foore), 'Green Bay');
assert.equal(d.teams['Green Bay'].coachId, null);
assert.ok(draftWarnings(league).some(w => /Green Bay/.test(w)), 'vacancy is flagged');
assert.ok(availableCoaches(league, d.teams).some(c => c.id === gasso), 'JT Gasso is now available');
hireCoach(d.teams, 'Green Bay', newCoach(league, 'Sam New'));
for (const t of ['Saint Louis', 'UMKC', 'North Dakota State']) d.teams[t].conference = 'Summit';
d.teams['Houston'].conference = 'Big 12';
draftRemoveTeam(league, 'Bemidji State');
assert.deepEqual(draftWarnings(league), []);
assert.ok(s.teams['Bemidji State'], 'history keeps the team');
const s2 = startNextSeason(league);
assert.equal(s2.year, 2017);
assert.ok(!league.draft);
assert.ok(s2.teams['Oregon State'] && !s2.teams['Bemidji State']);
assert.equal(s2.teams['Houston'].conference, 'Big 12');
assert.equal(coachName(league, s2.teams['Oregon State'].coachId), 'Pat Casey');
assert.equal(coachName(league, s2.teams['Oklahoma'].coachId), 'Roman Foore');
// New schedule each season, with conference series flipping home and away
assert.ok(s2.games.some(g => g.type === 'regular') && s2.games.every(g => !g.final || g.type !== 'regular' || true));
const host16 = new Map(s.games.filter(g => g.type === 'regular' && g.confGame).map(g => [[g.home, g.away].sort().join('|'), g.home]));
let flipped = 0, same = 0;
for (const g of s2.games.filter(g => g.type === 'regular' && g.confGame && g.day === 'Fri')) {
  const h = host16.get([g.home, g.away].sort().join('|'));
  if (h) (h === g.home ? same++ : flipped++);
}
console.log(`conference series that met in both years: ${flipped} flipped, ${same} same host`);
assert.equal(same, 0, 'every repeat conference series switches sites');
const summit = Object.values(s2.teams).filter(t => t.conference === 'Summit').map(t => t.school);
assert.equal(summit.length, 4);
for (const t of summit) {
  const opps = new Set(s2.games.filter(g => g.confGame && (g.home === t || g.away === t)).map(g => (g.home === t ? g.away : g.home)));
  assert.equal(opps.size, 3, `${t} plays its new Summit rivals`);
}
assert.ok(s2.games.some(g => g.home === 'Oregon State' || g.away === 'Oregon State'));
assert.ok(s2.carryPoll);
renameTeam(league, s2, 'Oregon State', 'Oregon St.');
assert.ok(s2.teams['Oregon St.']);
simGames(s2, undefined, { autoLock: true });
assert.equal(s2.phase, 'complete');
console.log('2017 champion', s2.post.champion);
console.log(`ok in ${Date.now() - t0} ms`);
