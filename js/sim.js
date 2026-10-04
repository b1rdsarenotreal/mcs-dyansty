// Softball game simulator. Plays every plate appearance from the teams'
// OFF (hitting), PIT (pitching) and DEF (fielding) ratings and returns a full
// line score: runs by inning, R/H/E, pitching lines, and the winning, losing
// and saving pitchers. NCAA rules: 7 innings, 8-run rule after 5, and from
// the 8th inning each half starts with a runner on second.
// A simulation is only a suggestion — the commissioner reviews and saves it.

import { rng as makeRng, hashStr } from './util.js';

export const OVR_WEIGHTS = { off: 0.4, pit: 0.4, def: 0.2 };
export function ovr(t) { return Math.round(t.off * OVR_WEIGHTS.off + t.pit * OVR_WEIGHTS.pit + t.def * OVR_WEIGHTS.def); }

// League-average plate appearance for two 70-rated teams.
const BASE = { k: 0.19, bb: 0.08, hbp: 0.017, hr: 0.024, tri: 0.006, dbl: 0.045, sgl: 0.152, err: 0.03 };
const TALENT = 28; // rating points per unit of talent gap

// Starter quality by rotation slot: Friday ace, Saturday, Sunday, midweek / relief.
const SLOT_ADJ = [2, 0, -2, -4];

function paProbs(off, pit, def, home, vol) {
  const t = (off - pit) / TALENT / vol;
  const d = (def - 70) / TALENT / vol;
  const hitDef = Math.exp(-0.07 * d) * (home ? 1.02 : 1);
  const p = {
    k: BASE.k * Math.exp(-0.32 * t),
    bb: BASE.bb * Math.exp(0.22 * t),
    hbp: BASE.hbp,
    hr: BASE.hr * Math.exp(0.5 * t) * (home ? 1.03 : 1),
    tri: BASE.tri * Math.exp(0.3 * t) * hitDef,
    dbl: BASE.dbl * Math.exp(0.36 * t) * hitDef,
    sgl: BASE.sgl * Math.exp(0.26 * t) * hitDef,
    err: BASE.err * Math.exp(-0.5 * d),
  };
  // Keep at least 40% of plate appearances ending in an out on a ball in play.
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  if (sum > 0.6) for (const k in p) p[k] *= 0.6 / sum;
  return p;
}

function outcome(p, r) {
  let x = r();
  for (const k of ['k', 'bb', 'hbp', 'hr', 'tri', 'dbl', 'sgl', 'err']) { if ((x -= p[k]) < 0) return k; }
  return 'out';
}

// Which staff member starts: rotation by day for the regular season,
// or an explicit slot (postseason, or a commissioner pick).
export function starterSlot(game, side) {
  const fixed = side === 'home' ? game.homeStarter : game.awayStarter;
  if (fixed != null) return fixed;
  const byDay = { Fri: 0, Sat: 1, Sun: 2 };
  if (game.type === 'regular') return byDay[game.day] ?? 3;
  return (side === 'home' ? game.homeSlot : game.awaySlot) ?? 0;
}

export function simulateGame(homeTeam, awayTeam, game = {}, { seed, volatility = 1, runRule = true, tiebreaker = true } = {}) {
  const r = makeRng(seed);
  const vol = volatility;
  const neutral = !!game.neutral;
  const sides = {
    home: { team: homeTeam, staff: homeTeam.staff || ['Pitcher 1', 'Pitcher 2', 'Pitcher 3', 'Pitcher 4'] },
    away: { team: awayTeam, staff: awayTeam.staff || ['Pitcher 1', 'Pitcher 2', 'Pitcher 3', 'Pitcher 4'] },
  };
  for (const s of ['home', 'away']) {
    const slot = starterSlot(game, s);
    const st = sides[s];
    st.used = [slot];
    st.lines = [newLine(st.staff[slot] || `Pitcher ${slot + 1}`, slot, true)];
    st.cur = st.lines[0];
    st.R = 0; st.H = 0; st.E = 0; st.innings = [];
  }

  function newLine(name, slot, starter) { return { name, slot, starter, outs: 0, h: 0, r: 0, bb: 0, k: 0, bf: 0 }; }

  function pitRating(st) {
    const base = st.team.pit + (SLOT_ADJ[st.cur.slot] ?? -4) + (st.cur.starter ? 0 : 1);
    const tired = Math.max(0, st.cur.bf - 24) * 0.6;
    return base - tired;
  }

  function maybePull(st, inning, inningRuns, force = false) {
    const c = st.cur;
    let pull = force;
    if (c.starter) {
      if (c.r >= 5 || inningRuns >= 4) pull = true;
      else if (c.r >= 4 && inning >= 4 && r() < 0.6) pull = true;
      else if (c.bf > 27 && r() < 0.35) pull = true;
    } else if (c.r >= 4 || inningRuns >= 4) pull = true;
    if (!pull) return;
    const usedSlots = new Set(st.used);
    const order = [3, 2, 1, 0].filter(i => !usedSlots.has(i) && i < st.staff.length);
    if (!order.length) return;
    const slot = order[0];
    st.used.push(slot);
    st.cur = newLine(st.staff[slot], slot, false);
    st.lines.push(st.cur);
  }

  let goAhead = null;
  let gameOver = false, runRuleEnd = false;
  const score = () => ({ home: sides.home.R, away: sides.away.R });

  function halfInning(inning, batSide) {
    const defSide = batSide === 'home' ? 'away' : 'home';
    const bat = sides[batSide], fld = sides[defSide];
    let outs = 0, runs = 0;
    const b = [false, false, false];
    if (tiebreaker && inning >= 8) b[1] = true;
    const isHome = batSide === 'home' && !neutral;

    const scoreRuns = n => {
      for (let i = 0; i < n; i++) {
        const before = bat.R - fld.R;
        bat.R++; runs++; fld.cur.r++;
        if (before === 0) goAhead = { side: batSide, winP: bat.cur, loseP: fld.cur };
        if (batSide === 'home' && inning >= 7 && bat.R > fld.R) gameOver = true; // walk-off
        if (runRule && batSide === 'home' && inning >= 5 && bat.R - fld.R >= 8) { gameOver = true; runRuleEnd = true; }
      }
    };

    while (outs < 3 && !gameOver) {
      const p = paProbs(bat.team.off, pitRating(fld), fld.team.def, isHome, vol);
      const o = outcome(p, r);
      const c = fld.cur;
      c.bf++;
      let n = 0;
      switch (o) {
        case 'k': outs++; c.k++; c.outs++; break;
        case 'bb': case 'hbp':
          if (o === 'bb') c.bb++;
          if (b[0] && b[1] && b[2]) n++;
          b[2] = b[2] || (b[0] && b[1]); b[1] = b[1] || b[0]; b[0] = true;
          break;
        case 'hr': n = 1 + b.filter(Boolean).length; b[0] = b[1] = b[2] = false; bat.H++; c.h++; break;
        case 'tri': n = b.filter(Boolean).length; b[0] = b[1] = false; b[2] = true; bat.H++; c.h++; break;
        case 'dbl': {
          if (b[2]) n++; if (b[1]) n++;
          const third = b[0] && !(r() < 0.45 && ++n);
          b[0] = false; b[1] = true; b[2] = !!third;
          bat.H++; c.h++; break;
        }
        case 'sgl': {
          const nb = [true, false, false];
          if (b[2]) n++;
          if (b[1]) { if (r() < 0.6) n++; else nb[2] = true; }
          if (b[0]) { if (!nb[2] && r() < 0.28) nb[2] = true; else nb[1] = true; }
          b[0] = nb[0]; b[1] = nb[1]; b[2] = nb[2];
          bat.H++; c.h++; break;
        }
        case 'err': {
          const nb = [true, false, false];
          if (b[2]) n++;
          if (b[1]) { if (r() < 0.4) n++; else nb[2] = true; }
          if (b[0]) nb[1] = true;
          b[0] = nb[0]; b[1] = nb[1]; b[2] = nb[2];
          fld.E++; break;
        }
        default: { // ball in play, out
          outs++; c.outs++;
          if (outs < 3 && b[0] && r() < 0.13) { outs++; c.outs++; b[0] = false; } // double play
          if (outs < 3) {
            if (b[2] && r() < 0.42) { n++; b[2] = false; }
            if (b[1] && !b[2] && r() < 0.35) { b[2] = true; b[1] = false; }
          }
        }
      }
      if (n) scoreRuns(n);
      if (!gameOver && outs < 3) maybePull(fld, inning, runs);
    }
    bat.innings.push(runs);
    if (!gameOver) maybePull(fld, inning, runs);
  }

  for (let inning = 1; inning <= 30 && !gameOver; inning++) {
    halfInning(inning, 'away');
    const s = score();
    // Home team doesn't bat in the last inning if already ahead; run rule after 4½.
    if (inning >= 7 && s.home > s.away) { sides.home.innings.push(null); break; }
    if (runRule && inning >= 5 && s.home - s.away >= 8) { sides.home.innings.push(null); runRuleEnd = true; break; }
    halfInning(inning, 'home');
    const t = score();
    if (gameOver) break;
    if (runRule && inning >= 5 && Math.abs(t.home - t.away) >= 8) { runRuleEnd = true; break; }
    if (inning >= 7 && t.home !== t.away) break;
  }

  // Pitchers of record.
  const winSide = sides.home.R > sides.away.R ? 'home' : 'away';
  const loseSide = winSide === 'home' ? 'away' : 'home';
  const W = sides[winSide], L = sides[loseSide];
  const ga = goAhead && goAhead.side === winSide ? goAhead : { winP: W.lines[0], loseP: L.lines[0] };
  let wp = ga.winP;
  const fullGame = sides.away.innings.length >= 5;
  if (wp.starter && wp.outs < 12 && fullGame && W.lines.length > 1) {
    // A starter needs 4 innings for the win; otherwise the most effective reliever gets it.
    wp = W.lines.slice(1).sort((a, b) => (b.outs - b.r * 3) - (a.outs - a.r * 3))[0];
  }
  const last = W.lines[W.lines.length - 1];
  const margin = W.R - L.R;
  const sv = last !== wp && margin <= 3 && last.outs >= 1 ? last.name : null;

  const line = st => st.lines.map(({ name, outs, h, r: runs, bb, k }) => ({ name, outs, h, r: runs, bb, k }));
  return {
    homeLine: sides.home.innings, awayLine: sides.away.innings,
    home: { R: sides.home.R, H: sides.home.H, E: sides.home.E },
    away: { R: sides.away.R, H: sides.away.H, E: sides.away.E },
    pitching: { home: line(sides.home), away: line(sides.away) },
    wp: wp.name, lp: ga.loseP.name, sv,
    innings: sides.away.innings.length, runRule: runRuleEnd,
  };
}

// Home team's chance to win. A logistic fit to thousands of simulated games:
// each point of rating edge is worth about 0.1 on the log-odds scale, so a
// team 10 points better wins ~73% and one 20 points better ~88%.
export function winProbability(homeTeam, awayTeam, game = {}, { volatility = 1 } = {}) {
  const hp = homeTeam.pit + (SLOT_ADJ[starterSlot(game, 'home')] ?? -4);
  const ap = awayTeam.pit + (SLOT_ADJ[starterSlot(game, 'away')] ?? -4);
  const d = OVR_WEIGHTS.off * (homeTeam.off - awayTeam.off) + OVR_WEIGHTS.pit * (hp - ap) + OVR_WEIGHTS.def * (homeTeam.def - awayTeam.def);
  const x = (0.1 * d) / volatility + (game.neutral ? 0 : 0.04);
  return 1 / (1 + Math.exp(-x));
}

// Slower check of the formula above by simulating the matchup.
export function simulatedWinRate(homeTeam, awayTeam, game = {}, opts = {}, n = 2000) {
  let wins = 0;
  for (let i = 0; i < n; i++) { const res = simulateGame(homeTeam, awayTeam, game, { ...opts, seed: i * 7919 + 1 }); if (res.home.R > res.away.R) wins++; }
  return wins / n;
}
