// Softball game simulator. Plays every plate appearance from the teams'
// OFF (hitting), PIT (pitching) and DEF (fielding) ratings and returns a full
// line score: runs by inning and R/H/E. NCAA rules: 7 innings, 8-run rule
// after 5, and from the 8th inning each half starts with a runner on second.
// A simulation is only a suggestion — the commissioner reviews and saves it.

import { rng as makeRng } from './util.js?v=20261004183556';

export const OVR_WEIGHTS = { off: 0.4, pit: 0.4, def: 0.2 };
const ovrExact = t => t.off * OVR_WEIGHTS.off + t.pit * OVR_WEIGHTS.pit + t.def * OVR_WEIGHTS.def;
export function ovr(t) { return Math.round(t.off * OVR_WEIGHTS.off + t.pit * OVR_WEIGHTS.pit + t.def * OVR_WEIGHTS.def); }

// League-average plate appearance for two 70-rated teams.
const BASE = { k: 0.19, bb: 0.08, hbp: 0.017, hr: 0.024, tri: 0.006, dbl: 0.045, sgl: 0.152, err: 0.03 };
const TALENT = 28; // rating points per unit of talent gap

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

export function simulateGame(homeTeam, awayTeam, game = {}, { seed, volatility = 1, runRule = true, tiebreaker = true } = {}) {
  const r = makeRng(seed);
  const vol = volatility;
  const neutral = !!game.neutral;
  const sides = {
    home: { team: homeTeam, R: 0, H: 0, E: 0, innings: [] },
    away: { team: awayTeam, R: 0, H: 0, E: 0, innings: [] },
  };

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
        bat.R++; runs++;
        if (batSide === 'home' && inning >= 7 && bat.R > fld.R) gameOver = true; // walk-off
        if (runRule && batSide === 'home' && inning >= 5 && bat.R - fld.R >= 8) { gameOver = true; runRuleEnd = true; }
      }
    };

    while (outs < 3 && !gameOver) {
      const p = paProbs(bat.team.off, fld.team.pit, fld.team.def, isHome, vol);
      const o = outcome(p, r);
      let n = 0;
      switch (o) {
        case 'k': outs++; break;
        case 'bb': case 'hbp':
          if (b[0] && b[1] && b[2]) n++;
          b[2] = b[2] || (b[0] && b[1]); b[1] = b[1] || b[0]; b[0] = true;
          break;
        case 'hr': n = 1 + b.filter(Boolean).length; b[0] = b[1] = b[2] = false; bat.H++; break;
        case 'tri': n = b.filter(Boolean).length; b[0] = b[1] = false; b[2] = true; bat.H++; break;
        case 'dbl': {
          if (b[2]) n++; if (b[1]) n++;
          const third = b[0] && !(r() < 0.45 && ++n);
          b[0] = false; b[1] = true; b[2] = !!third;
          bat.H++; break;
        }
        case 'sgl': {
          const nb = [true, false, false];
          if (b[2]) n++;
          if (b[1]) { if (r() < 0.6) n++; else nb[2] = true; }
          if (b[0]) { if (!nb[2] && r() < 0.28) nb[2] = true; else nb[1] = true; }
          b[0] = nb[0]; b[1] = nb[1]; b[2] = nb[2];
          bat.H++; break;
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
          outs++;
          if (outs < 3 && b[0] && r() < 0.13) { outs++; b[0] = false; } // double play
          if (outs < 3) {
            if (b[2] && r() < 0.42) { n++; b[2] = false; }
            if (b[1] && !b[2] && r() < 0.35) { b[2] = true; b[1] = false; }
          }
        }
      }
      if (n) scoreRuns(n);
    }
    bat.innings.push(runs);
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

  return {
    homeLine: sides.home.innings, awayLine: sides.away.innings,
    home: { R: sides.home.R, H: sides.home.H, E: sides.home.E },
    away: { R: sides.away.R, H: sides.away.H, E: sides.away.E },
    innings: sides.away.innings.length, runRule: runRuleEnd,
  };
}

// Home team's chance to win. A logistic fit to thousands of simulated games:
// each point of rating edge is worth about 0.1 on the log-odds scale, so a
// team 10 points better wins ~73% and one 20 points better ~88%.
export function winProbability(homeTeam, awayTeam, game = {}, { volatility = 1 } = {}) {
  const d = ovrExact(homeTeam) - ovrExact(awayTeam);
  const x = (0.1 * d) / volatility + (game.neutral ? 0 : 0.04);
  return 1 / (1 + Math.exp(-x));
}

// Slower check of the formula above by simulating the matchup.
export function simulatedWinRate(homeTeam, awayTeam, game = {}, opts = {}, n = 2000) {
  let wins = 0;
  for (let i = 0; i < n; i++) { const res = simulateGame(homeTeam, awayTeam, game, { ...opts, seed: i * 7919 + 1 }); if (res.home.R > res.away.R) wins++; }
  return wins / n;
}
