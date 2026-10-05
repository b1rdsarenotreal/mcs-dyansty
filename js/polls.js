// Generated Top 15 poll. Simulated voters each fill out a ballot from team
// strength (OVR) early in the season, shifting to résumé (record and RPI)
// as games are played. They remember last week's poll, so teams move the
// way real polls do. The commissioner can edit any published poll.

import { rng, normal, hashStr } from './util.js?v=20261004212143';
import { ovr } from './sim.js?v=20261004212143';
import { records, rpi, isFinal } from './standings.js?v=20261004212143';

export const VOTERS = 40;
export const POLL_SIZE = 15;

function zmap(obj) {
  const v = Object.values(obj), n = v.length || 1;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / n) || 1;
  return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, (x - m) / sd]));
}

export function previousPoll(season, week) {
  const weeks = Object.keys(season.polls || {}).filter(k => k !== 'final').map(Number).filter(w => w < week).sort((a, b) => b - a);
  return weeks.length ? season.polls[weeks[0]] : season.carryPoll || null;
}

// Résumé-plus-strength score used by voters (and the selection committee).
export function teamScores(season, week, { postBonus = null } = {}) {
  const filter = g => g.week <= week;
  const recs = records(season, filter), r = rpi(season, filter);
  const teams = Object.keys(season.teams);
  const zO = zmap(Object.fromEntries(teams.map(t => [t, ovr(season.teams[t])])));
  const zR = zmap(Object.fromEntries(teams.map(t => [t, r[t].rpi])));
  const zW = zmap(Object.fromEntries(teams.map(t => { const x = recs[t]; return [t, (x.w + 1) / (x.w + x.l + 2)]; })));
  const out = {};
  for (const t of teams) {
    const n = recs[t].w + recs[t].l;
    const wr = Math.min(0.85, n / 28);
    out[t] = (1 - wr) * zO[t] + wr * (0.5 * zR[t] + 0.5 * zW[t]) + (postBonus?.[t] || 0);
  }
  return { scores: out, recs, rpi: r };
}

export function generatePoll(season, week, { final = false, postBonus = null } = {}) {
  const { scores, recs } = teamScores(season, final ? 99 : week, { postBonus });
  const prev = final ? season.polls?.[Math.max(...Object.keys(season.polls).filter(k => k !== 'final').map(Number))] : previousPoll(season, week);
  const prevRank = {};
  prev?.ranks.forEach((x, i) => { prevRank[x.team] = i + 1; });
  const inertia = week === 0 ? 0.35 : final ? 0.1 : 0.45;
  const base = {};
  for (const t of Object.keys(scores)) base[t] = scores[t] + (prevRank[t] ? inertia * (POLL_SIZE + 1 - prevRank[t]) / POLL_SIZE : 0);

  const r = rng(hashStr(`${season.year}-${final ? 'final' : week}`));
  const pts = {}, fp = {};
  for (let v = 0; v < VOTERS; v++) {
    const vr = rng(hashStr(`voter-${v}-${season.year}`));
    const ballot = Object.keys(base).map(t => {
      const bias = normal(rng(hashStr(`${v}|${t}|${season.year}`))) * 0.18;
      return [t, base[t] + bias + normal(r) * 0.16 + normal(vr) * 0.02];
    }).sort((a, b) => b[1] - a[1]).slice(0, POLL_SIZE);
    ballot.forEach(([t], i) => { pts[t] = (pts[t] || 0) + POLL_SIZE - i; if (i === 0) fp[t] = (fp[t] || 0) + 1; });
  }
  // Champion is unanimous #1 in the final poll.
  let order = Object.keys(pts).sort((a, b) => pts[b] - pts[a] || scores[b] - scores[a]);
  if (final && season.post?.champion) {
    const c = season.post.champion;
    order = [c, ...order.filter(t => t !== c)];
    pts[c] = VOTERS * POLL_SIZE; fp[c] = VOTERS;
    for (const t of Object.keys(fp)) if (t !== c) fp[t] = 0;
  }
  const rec = t => `${recs[t].w}-${recs[t].l}`;
  return {
    week: final ? 'final' : week, voters: VOTERS, edited: false,
    ranks: order.slice(0, POLL_SIZE).map(t => ({ team: t, pts: pts[t], fp: fp[t] || 0, record: rec(t) })),
    others: order.slice(POLL_SIZE).filter(t => pts[t] > 0).map(t => ({ team: t, pts: pts[t], record: rec(t) })),
  };
}

// A week's poll comes out once all of that week's games are final.
export function weekComplete(season, week) {
  const gs = season.games.filter(g => g.week === week);
  return gs.length > 0 && gs.every(isFinal);
}

// Release any polls that are now due. Returns the weeks released.
export function releaseDuePolls(season, lastPollWeek) {
  const released = [];
  season.polls ||= {};
  for (let w = 1; w <= lastPollWeek; w++) {
    if (season.polls[w]) continue;
    if (!weekComplete(season, w)) break;
    season.polls[w] = generatePoll(season, w);
    released.push(w);
  }
  return released;
}

export function latestPoll(season) {
  if (season.polls?.final) return season.polls.final;
  const weeks = Object.keys(season.polls || {}).filter(k => k !== 'final').map(Number);
  return weeks.length ? season.polls[Math.max(...weeks)] : null;
}

export function pollRankMap(poll) {
  const m = {};
  poll?.ranks.forEach((x, i) => { m[x.team] = i + 1; });
  return m;
}
