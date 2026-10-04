// Logic tests: run with `node tests/logic.test.mjs`
import assert from 'node:assert/strict';
import { newLeague, currentSeason, simGames, startNextSeason, addTeam, addConference, renameTeam, beginOffseason, draftRemoveTeam, draftWarnings, LAST_POLL_WEEK } from '../js/league.js';
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

assert.ok(s.polls[0].ranks.length === 25, 'preseason poll');

// Full season
simGames(s, undefined, { autoLock: true });
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

// Coaches
assert.equal(s.teams['Oklahoma'].coach, 'JT Gasso');
assert.ok(Object.values(s.teams).every(t => t.coach), 'every team has a coach');
assert.ok(Object.values(s.teams).every(t => !t.staff), 'no pitching staffs');
assert.ok(s.games.every(g => !g.pitching && !g.wp), 'no pitching stats');

// Offseason: new conference, new team, realignment, a team leaves
const d = beginOffseason(league);
assert.equal(d.year, 2017);
addConference(league, 'Summit', { color: '#123456' });
addTeam(league, d.teams, { school: 'Oregon State', conference: 'Summit', coach: 'Pat Casey' });
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
assert.equal(s2.teams['Oregon State'].coach, 'Pat Casey');
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
