// Generated Top-N poll (15 by default; Settings changes the size). A fixed
// panel of 23 voters fills out ballots. Every voter starts from the same
// picture — team strength (OVR) early in the season, shifting to résumé
// (RPI and record) as games are played, plus last week's poll — and then
// leans a little according to a built-in personality: some trust talent,
// some trust numbers, some punish bad losses, some watch one conference
// closely. The leans are small, so the poll stays close to a consensus.
// Personalities live here in the code and aren't editable in the app.
// The commissioner can still edit any published poll.

import { rng, normal, hashStr, clamp } from './util.js?v=20261006113505';
import { ovr } from './sim.js?v=20261006113505';
import { records, rpi, isFinal, winnerOf } from './standings.js?v=20261006113505';

export const DEFAULT_POLL_SIZE = 15;
export const POLL_SIZES = [10, 15, 20, 25];
export const pollSizeOf = season => season?.settings?.pollSize ?? DEFAULT_POLL_SIZE;

// talent:  >0 keeps trusting rosters longer, <0 moves to the résumé sooner
// rpi:     share of the résumé from RPI (the rest is win-loss record)
// sos:     extra credit for a tough schedule
// loyalty: how much last week's ranking carries over (1 = consensus)
// recency: reaction to this week's results
// losses:  penalty for losing to teams outside last week's poll
// region:  the conference (by position in the league) this voter covers, with a small boost
// noise:   how much this voter's ballot wanders week to week
const P = (o) => ({ talent: 0, rpi: 0.5, sos: 0, loyalty: 1, recency: 0, losses: 0, region: null, regionBoost: 0, noise: 0.1, ...o });
export const VOTER_PANEL = [
  { id: 'v1', name: 'Hank Dobbins', outlet: 'Plains Ledger', style: 'Old school. Trusts proven programs and is slow to move teams.', ...P({ talent: 0.25, loyalty: 1.35, noise: 0.08 }) },
  { id: 'v2', name: 'Priya Raman', outlet: 'Diamond Analytics', style: 'Numbers first. Leans on the RPI and strength of schedule.', ...P({ talent: -0.2, rpi: 0.75, sos: 0.14, loyalty: 0.85 }) },
  { id: 'v3', name: 'Marcus Bell', outlet: 'Gulf Coast Gazette', style: 'Regional voter. Gives the {conf} a little extra credit.', ...P({ region: 0, regionBoost: 0.09 }) },
  { id: 'v4', name: 'Lena Kowalski', outlet: 'Great Lakes Sports Radio', style: 'Regional voter. Watches the {conf} closely.', ...P({ region: 1, regionBoost: 0.08 }) },
  { id: 'v5', name: 'Tom Whitfield', outlet: 'Desert Sun', style: 'Regional voter. Sees a lot of the {conf}.', ...P({ region: 2, regionBoost: 0.08 }) },
  { id: 'v6', name: 'Carla Mendes', outlet: 'National Wire', style: 'Middle of the road. Her ballot tracks the consensus.', ...P({ noise: 0.05 }) },
  { id: 'v7', name: 'Jake Orr', outlet: 'Grandstand Report', style: 'Reacts to last week. Big weeks move teams up fast.', ...P({ recency: 0.2, loyalty: 0.7, noise: 0.12 }) },
  { id: 'v8', name: 'Dana Pruitt', outlet: 'Heartland Herald', style: 'Punishes bad losses.', ...P({ losses: 0.12 }) },
  { id: 'v9', name: 'Russ Kemper', outlet: 'The Dugout Daily', style: 'Win-loss record above all.', ...P({ talent: -0.15, rpi: 0.25 }) },
  { id: 'v10', name: 'Mei Chen', outlet: 'Pacific Sports Journal', style: 'Rewards teams that play tough schedules.', ...P({ sos: 0.15, rpi: 0.6 }) },
  { id: 'v11', name: 'Gil Navarro', outlet: 'Fastpitch Insider', style: 'Talent evaluator. Ranks the best rosters, records aside.', ...P({ talent: 0.3, loyalty: 1.1 }) },
  { id: 'v12', name: 'Beth Abernathy', outlet: 'Mountain West Times', style: 'Steady. Rarely moves a team more than a spot or two.', ...P({ loyalty: 1.4, noise: 0.06 }) },
  { id: 'v13', name: 'Omar Haddad', outlet: 'Riverfront Press', style: 'Wildcard. His ballot is the hardest to predict.', ...P({ noise: 0.2 }) },
  { id: 'v14', name: 'Sully Grant', outlet: 'Hot Corner Podcast', style: 'Likes hot teams. Streaks and big weeks count.', ...P({ recency: 0.15, loyalty: 0.85 }) },
  { id: 'v15', name: 'Nora Lindqvist', outlet: 'North Star Tribune', style: 'Balanced and careful. Close to the consensus.', ...P({ noise: 0.07 }) },
  { id: 'v16', name: 'Pete Varga', outlet: 'Lakeshore Courier', style: 'Regional voter. Gives the {conf} the benefit of the doubt.', ...P({ region: 3, regionBoost: 0.09 }) },
  { id: 'v17', name: 'Alicia Brooks', outlet: 'Box Score Weekly', style: 'Leans on the RPI more than most.', ...P({ talent: -0.1, rpi: 0.68 }) },
  { id: 'v18', name: 'Ray Thibodeaux', outlet: 'Bayou Sports', style: 'Old school, and hard on teams that lose to unranked opponents.', ...P({ talent: 0.15, losses: 0.1, loyalty: 1.15 }) },
  { id: 'v19', name: 'Kim Sato', outlet: 'Collegiate Softball Today', style: 'Consensus voter. Rarely far from the field.', ...P({ noise: 0.05 }) },
  { id: 'v20', name: 'Walt Hensley', outlet: 'Valley Voice', style: 'Loyal to his preseason picks.', ...P({ talent: 0.2, loyalty: 1.3 }) },
  { id: 'v21', name: 'Jess Moreno', outlet: 'Southwest Sports Network', style: 'Résumé voter. Moves to results early in the season.', ...P({ talent: -0.25, rpi: 0.45 }) },
  { id: 'v22', name: 'Dev Patel', outlet: 'Ratings Lab', style: 'Schedule strength and RPI, with little attention to preseason hype.', ...P({ talent: -0.15, rpi: 0.7, sos: 0.12 }) },
  { id: 'v23', name: 'Frank Lacey', outlet: 'Coastal Chronicle', style: 'Regional voter. Keeps a close eye on the {conf}.', ...P({ region: 4, regionBoost: 0.08 }) },
];
export const VOTERS = VOTER_PANEL.length;

// The conference a regional voter covers this season (by position, so it
// still works after conferences are renamed or added).
export function voterConference(season, v) {
  if (v.region == null) return null;
  const confs = [...new Set(Object.values(season.teams).map(t => t.conference))].sort();
  return confs.length ? confs[v.region % confs.length] : null;
}
export function voterStyle(season, v) {
  return v.style.replace('{conf}', voterConference(season, v) || 'their region');
}

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

// The pieces every voter looks at, through `week`.
function pollInputs(season, week) {
  const filter = g => g.week <= week;
  const recs = records(season, filter), r = rpi(season, filter);
  const teams = Object.keys(season.teams);
  const zO = zmap(Object.fromEntries(teams.map(t => [t, ovr(season.teams[t])])));
  const zR = zmap(Object.fromEntries(teams.map(t => [t, r[t].rpi])));
  const zW = zmap(Object.fromEntries(teams.map(t => { const x = recs[t]; return [t, (x.w + 1) / (x.w + x.l + 2)]; })));
  const zS = zmap(Object.fromEntries(teams.map(t => [t, r[t].sos || 0])));
  const wr = Object.fromEntries(teams.map(t => [t, Math.min(0.85, (recs[t].w + recs[t].l) / 28)]));
  return { teams, recs, r, zO, zR, zW, zS, wr };
}

// Consensus résumé-plus-strength score (also used by the selection committee).
export function teamScores(season, week, { postBonus = null } = {}) {
  const { teams, recs, r, zO, zR, zW, wr } = pollInputs(season, week);
  const out = {};
  for (const t of teams) out[t] = (1 - wr[t]) * zO[t] + wr[t] * (0.5 * zR[t] + 0.5 * zW[t]) + (postBonus?.[t] || 0);
  return { scores: out, recs, rpi: r };
}

export function generatePoll(season, week, { final = false, postBonus = null } = {}) {
  const size = pollSizeOf(season);
  const wk = final ? 99 : week;
  const inp = pollInputs(season, wk);
  const { teams, recs, zO, zR, zW, zS, wr } = inp;
  const prev = final ? season.polls?.[Math.max(...Object.keys(season.polls).filter(k => k !== 'final').map(Number))] : previousPoll(season, week);
  const prevRank = {};
  prev?.ranks.forEach((x, i) => { prevRank[x.team] = i + 1; });
  const prevSize = prev?.ranks.length || size;
  const inertia = week === 0 ? 0.35 : final ? 0.1 : 0.45;

  // This week's results: net wins (as a z-score) and losses to teams outside last week's poll.
  const weekNet = {}, badLosses = {};
  for (const t of teams) { weekNet[t] = 0; badLosses[t] = 0; }
  if (!final && week > 0) {
    for (const g of season.games) {
      if (g.week !== week || !isFinal(g)) continue;
      const w = winnerOf(g), l = w === g.home ? g.away : g.home;
      if (weekNet[w] !== undefined) weekNet[w]++;
      if (weekNet[l] !== undefined) { weekNet[l]--; if (!prevRank[w]) badLosses[l]++; }
    }
  }
  const zWeek = zmap(weekNet);

  const pts = {}, fp = {}, ballots = {};
  for (const v of VOTER_PANEL) {
    const vconf = voterConference(season, v);
    const noise = rng(hashStr(`${v.id}|${season.year}|${final ? 'final' : week}`));
    const ballot = teams.map(t => {
      const wrV = clamp(wr[t] * (1 - v.talent), 0, 0.92);
      let sc = (1 - wrV) * zO[t] + wrV * (v.rpi * zR[t] + (1 - v.rpi) * zW[t]);
      sc += v.sos * zS[t] * Math.min(1, wr[t] * 2);
      if (prevRank[t]) sc += inertia * v.loyalty * (prevSize + 1 - prevRank[t]) / prevSize;
      sc += v.recency * zWeek[t];
      sc -= v.losses * badLosses[t];
      if (vconf && season.teams[t].conference === vconf) sc += v.regionBoost;
      sc += postBonus?.[t] || 0;
      sc += normal(noise) * v.noise;
      return [t, sc];
    }).sort((a, b) => b[1] - a[1]).slice(0, size).map(x => x[0]);
    ballots[v.id] = ballot;
    ballot.forEach((t, i) => { pts[t] = (pts[t] || 0) + size - i; if (i === 0) fp[t] = (fp[t] || 0) + 1; });
  }
  // Ties in points go to the consensus score.
  const cons = teamScores(season, wk, { postBonus }).scores;
  let order = Object.keys(pts).sort((a, b) => pts[b] - pts[a] || cons[b] - cons[a]);
  // The champion is the unanimous #1 in the final poll.
  if (final && season.post?.champion) {
    const c = season.post.champion;
    order = [c, ...order.filter(t => t !== c)];
    pts[c] = VOTERS * size; fp[c] = VOTERS;
    for (const t of Object.keys(fp)) if (t !== c) fp[t] = 0;
    for (const id of Object.keys(ballots)) ballots[id] = [c, ...ballots[id].filter(t => t !== c)].slice(0, size);
  }
  const rec = t => `${recs[t].w}-${recs[t].l}`;
  return {
    week: final ? 'final' : week, voters: VOTERS, size, edited: false, ballots,
    ranks: order.slice(0, size).map(t => ({ team: t, pts: pts[t], fp: fp[t] || 0, record: rec(t) })),
    others: order.slice(size).filter(t => pts[t] > 0).map(t => ({ team: t, pts: pts[t], record: rec(t) })),
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
