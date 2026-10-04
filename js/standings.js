// Records, conference standings with tiebreakers, and the RPI.

import { pct } from './util.js';

export const isFinal = g => g.final && g.homeR != null && g.awayR != null;
export const winnerOf = g => (g.homeR > g.awayR ? g.home : g.away);
export const loserOf = g => (g.homeR > g.awayR ? g.away : g.home);

function blank() {
  return { w: 0, l: 0, cw: 0, cl: 0, hw: 0, hl: 0, aw: 0, al: 0, nw: 0, nl: 0, rs: 0, ra: 0, streak: '', results: [] };
}

// filter(g) narrows which games count (e.g. through a given week).
export function records(season, filter = null) {
  const out = {};
  for (const t of Object.keys(season.teams)) out[t] = blank();
  const games = season.games.filter(g => isFinal(g) && (!filter || filter(g))).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id);
  for (const g of games) {
    const hw = g.homeR > g.awayR;
    for (const [t, won, rs, ra, where] of [[g.home, hw, g.homeR, g.awayR, g.neutral ? 'n' : 'h'], [g.away, !hw, g.awayR, g.homeR, g.neutral ? 'n' : 'a']]) {
      const r = out[t];
      if (!r) continue;
      won ? r.w++ : r.l++;
      r[where + (won ? 'w' : 'l')]++;
      if (g.type === 'regular' && g.confGame) won ? r.cw++ : r.cl++;
      r.rs += rs; r.ra += ra;
      r.results.push(won ? 'W' : 'L');
    }
  }
  for (const r of Object.values(out)) {
    const res = r.results;
    if (res.length) {
      const last = res[res.length - 1];
      let n = 0;
      for (let i = res.length - 1; i >= 0 && res[i] === last; i--) n++;
      r.streak = `${last}${n}`;
    }
  }
  return out;
}

// Rating Percentage Index: 25% winning pct, 50% opponents' winning pct
// (excluding games against the team), 25% opponents' opponents' pct.
export function rpi(season, filter = null) {
  const games = season.games.filter(g => isFinal(g) && (!filter || filter(g)));
  const teams = Object.keys(season.teams);
  const opps = {}, wl = {}, vs = {};
  for (const t of teams) { opps[t] = []; wl[t] = { w: 0, n: 0 }; vs[t] = {}; }
  for (const g of games) {
    const w = winnerOf(g);
    for (const [t, o] of [[g.home, g.away], [g.away, g.home]]) {
      if (!wl[t]) continue;
      wl[t].n++; if (w === t) wl[t].w++;
      opps[t].push(o);
      const v = (vs[t][o] ||= { w: 0, n: 0 });
      v.n++; if (w === t) v.w++;
    }
  }
  const wp = t => (wl[t]?.n ? wl[t].w / wl[t].n : 0);
  const wpExcl = (o, t) => {
    const a = wl[o]; if (!a) return 0;
    const v = vs[o][t] || { w: 0, n: 0 };
    const n = a.n - v.n;
    return n > 0 ? (a.w - v.w) / n : 0;
  };
  const owp = {};
  for (const t of teams) owp[t] = opps[t].length ? opps[t].reduce((s, o) => s + wpExcl(o, t), 0) / opps[t].length : 0;
  const out = {};
  for (const t of teams) {
    const oowp = opps[t].length ? opps[t].reduce((s, o) => s + (owp[o] ?? 0), 0) / opps[t].length : 0;
    out[t] = { wp: wp(t), owp: owp[t], oowp, rpi: 0.25 * wp(t) + 0.5 * owp[t] + 0.25 * oowp, games: wl[t].n };
  }
  const ranked = teams.filter(t => out[t].games).sort((a, b) => out[b].rpi - out[a].rpi);
  ranked.forEach((t, i) => { out[t].rank = i + 1; });
  return out;
}

function h2h(season, group) {
  const set = new Set(group), res = {};
  for (const t of group) res[t] = { w: 0, l: 0 };
  for (const g of season.games) {
    if (!isFinal(g) || g.type !== 'regular' || !g.confGame || !set.has(g.home) || !set.has(g.away)) continue;
    const w = winnerOf(g), l = loserOf(g);
    res[w].w++; res[l].l++;
  }
  return res;
}

// Conference table, best first, with games-back.
export function confStandings(season, conf, recs = records(season), r = rpi(season)) {
  const teams = Object.values(season.teams).filter(t => t.conference === conf).map(t => t.school);
  const cp = t => pct(recs[t].cw, recs[t].cl);
  const sorted = [...teams].sort((a, b) => cp(b) - cp(a) || recs[b].cw - recs[a].cw);
  // Break ties: head-to-head within the tied group, then RPI.
  const out = [];
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && cp(sorted[j]) === cp(sorted[i]) && recs[sorted[j]].cw === recs[sorted[i]].cw) j++;
    const grp = sorted.slice(i, j);
    if (grp.length > 1) {
      const hh = h2h(season, grp);
      grp.sort((a, b) => pct(hh[b].w, hh[b].l) - pct(hh[a].w, hh[a].l) || (r[b]?.rpi ?? 0) - (r[a]?.rpi ?? 0));
    }
    out.push(...grp);
    i = j;
  }
  const lead = out[0];
  return out.map(t => ({
    team: t, ...recs[t],
    gb: lead ? ((recs[lead].cw - recs[t].cw) + (recs[t].cl - recs[lead].cl)) / 2 : 0,
    rpiRank: r[t]?.rank ?? null,
  }));
}

export function conferences(season) {
  return [...new Set(Object.values(season.teams).map(t => t.conference))].sort();
}

export function regularSeasonDone(season) {
  return season.games.filter(g => g.type === 'regular').every(isFinal);
}

// Regular-season champion (commissioner override wins).
export function regSeasonChamp(season, conf, recs, r) {
  if (season.overrides?.regChamps?.[conf]) return season.overrides.regChamps[conf];
  const st = confStandings(season, conf, recs, r);
  return st.length && (st[0].cw + st[0].cl) > 0 ? st[0].team : null;
}
