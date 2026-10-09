// Dynasty record book: program totals, best single seasons, single-game
// marks and coaching leaders, across every season in the league.

import { records, isFinal, winnerOf, regSeasonChamps, conferences } from './standings.js?v=20261008184207';
import { wsTeams } from './postseason.js?v=20261008184207';
import { pct } from './util.js?v=20261008184207';

export function recordBook(league) {
  const years = Object.keys(league.seasons).map(Number).sort((a, b) => a - b);
  const programs = {}, seasons = [], games = [], coaches = {};
  const prog = t => (programs[t] ||= { team: t, seasons: 0, w: 0, l: 0, reg: 0, conf: 0, ncaa: 0, mcws: 0, titles: 0, rs: 0, ra: 0 });
  for (const y of years) {
    const se = league.seasons[y];
    const played = se.games.filter(isFinal);
    if (!played.length) continue;
    const done = se.phase === 'complete';
    const recs = records(se);
    const reg = records(se, g => g.type === 'regular');
    const field = new Set((se.post?.field || []).map(f => f.team));
    const ws = new Set(wsTeams(se));
    // Regular-season titles count once the regular season is over.
    const regDone = se.games.some(g => g.type === 'regular') && se.games.filter(g => g.type === 'regular').every(isFinal);
    const regChamps = new Set(regDone ? conferences(se).flatMap(c => regSeasonChamps(se, c, reg)) : []);
    const confChamps = new Set(Object.values(se.post?.confT || {}).map(ev => ev.champion).filter(Boolean));
    for (const [t, r] of Object.entries(recs)) {
      if (!r.w && !r.l) continue;
      const p = prog(t);
      p.seasons++; p.w += r.w; p.l += r.l; p.rs += r.rs; p.ra += r.ra;
      if (regChamps.has(t)) p.reg++;
      if (confChamps.has(t)) p.conf++;
      if (field.has(t) && se.post?.regionals) p.ncaa++;
      if (ws.has(t)) p.mcws++;
      if (se.post?.champion === t) p.titles++;
      // Longest winning streak inside the season.
      let best = 0, run = 0;
      for (const x of r.results) { run = x === 'W' ? run + 1 : 0; best = Math.max(best, run); }
      seasons.push({ year: y, team: t, done, w: r.w, l: r.l, pct: pct(r.w, r.l), g: r.w + r.l, rs: r.rs, ra: r.ra, diff: r.rs - r.ra, cw: reg[t]?.cw ?? 0, cl: reg[t]?.cl ?? 0, streak: best, champ: se.post?.champion === t });
      const cid = se.teams[t]?.coachId;
      if (cid) {
        const c = (coaches[cid] ||= { id: cid, w: 0, l: 0, seasons: 0, titles: 0, mcws: 0, teams: new Set() });
        c.w += r.w; c.l += r.l; c.seasons++; c.teams.add(t);
        if (se.post?.champion === t) c.titles++;
        if (ws.has(t)) c.mcws++;
      }
    }
    for (const g of played) {
      const n = Math.max(g.homeLine?.length || 0, g.awayLine?.length || 0);
      const w = winnerOf(g), l = w === g.home ? g.away : g.home;
      games.push({ year: y, week: g.week, type: g.type, label: g.label, home: g.home, away: g.away, homeR: g.homeR, awayR: g.awayR, homeH: g.homeH, awayH: g.awayH, w, l, wR: Math.max(g.homeR, g.awayR), lR: Math.min(g.homeR, g.awayR), innings: n, source: g.source });
    }
  }
  return { programs: Object.values(programs), seasons, games, coaches: Object.values(coaches).map(c => ({ ...c, teams: [...c.teams] })), years };
}

// Top `n` by a score (higher first), with ties kept in order.
export const top = (list, score, n = 5, filter = () => true) => list.filter(filter).map(x => [x, score(x)]).filter(([, v]) => v != null && !Number.isNaN(v)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([x]) => x);
