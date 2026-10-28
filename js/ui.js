// Shared UI state and pieces used by every page: the league, saving,
// team labels and logos, game cards, and the game editor.

import { saveLeague } from './store.js?v=20261028160518';
import { logoFor } from './logos.js?v=20261028160518';
import { LOGO_ALIASES } from './data.js?v=20261028160518';
import { ovr, winProbability } from './sim.js?v=20261028160518';
import { records, isFinal, winnerOf, sameConf } from './standings.js?v=20261028160518';
import { latestPoll, pollRankMap } from './polls.js?v=20261028160518';
import { afterChange, applyResult, clearResult, simResult, deleteGame, weekName, estimateHE } from './league.js?v=20261028160518';
import { regWeeksOf, shownSeed, mcwsVenue, gameVenue } from './postseason.js?v=20261028160518';
import { DAY_ORDER } from './schedule.js?v=20261028160518';
import { esc } from './util.js?v=20261028160518';

export { esc };
export const ctx = { league: null, render: () => {} };
export const app = document.getElementById('app');
export const modal = document.getElementById('modal');
export const S = () => ctx.league.seasons[ctx.league.viewYear];
export const $ = (sel, root = app) => root.querySelector(sel);
export const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];
export const sum = a => a.reduce((s, x) => s + (Number(x) || 0), 0);
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

let saveTimer;
export function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveLeague(ctx.league), 200); }
export function flushSave() { clearTimeout(saveTimer); return saveLeague(ctx.league); }

// Save and redraw after a change to results.
export function changed({ progress = true } = {}) {
  if (progress) afterChange(S());
  cache.reset();
  persist();
  ctx.render();
}

export function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), error ? 5000 : 2600);
}

// Per-render caches.
export const cache = {
  _recs: null, _ranks: null,
  reset() { this._recs = null; this._ranks = null; this._at = {}; this._series = null; this._tg = null; },
  recs() { return (this._recs ||= records(S())); },
  ranks() { return (this._ranks ||= pollRankMap(latestPoll(S()))); },
  // Ranks as they stood when a game in `week` was played: the most recent
  // poll released before that week (week 1 uses the preseason poll).
  // Games in weeks with no earlier poll yet use the latest one.
  _at: {},
  ranksAt(week) {
    const s = S();
    const key = Object.keys(s.polls || {}).filter(k => k !== 'final').map(Number).filter(w => w < week).sort((a, b) => b - a)[0];
    if (key === undefined) return this.ranks();
    return (this._at[key] ||= pollRankMap(s.polls[key]));
  },
};

// ---------- teams and logos ----------

export function teamInfo(name) {
  const s = S();
  if (s.teams[name]) return s.teams[name];
  const ys = Object.keys(ctx.league.seasons).map(Number).sort((a, b) => b - a);
  for (const y of ys) if (ctx.league.seasons[y].teams[name]) return ctx.league.seasons[y].teams[name];
  return null;
}
export const teamNames = () => Object.keys(S().teams).sort((a, b) => a.localeCompare(b));
export const teamHref = name => `#/team/${encodeURIComponent(name)}`;
export const confHref = c => `#/conference/${encodeURIComponent(c)}`;

function initials(name) { return name.replace(/[^A-Za-z0-9 &–-]/g, '').split(/[\s&–-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase(); }

export function logoImg(t, size = 18) {
  if (!t) return `<span class="dot" style="background:#999"></span>`;
  const url = logoFor(t, LOGO_ALIASES);
  const badge = `<span class="tbadge" style="width:${size}px;height:${size}px;font-size:${Math.max(7, size * 0.38)}px;background:${esc(t.color)};color:${esc(readableOn(t.color, t.altColor))}">${esc(t.abbr || initials(t.school))}</span>`;
  if (!url) return badge;
  return `<span class="logo" style="width:${size}px;height:${size}px"><img src="${esc(url)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.parentNode.outerHTML=this.parentNode.dataset.fb" ></span>`.replace('class="logo"', `class="logo" data-fb="${esc(badge)}"`);
}

// Pick the alt color for text on the primary color if it contrasts; else white or black.
export function readableOn(bg, alt) {
  const lum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 0.5; const n = parseInt(m[1], 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const lb = lum(bg);
  if (alt && ratio(lb, lum(alt)) >= 3) return alt;
  return ratio(lb, 1) >= ratio(lb, 0) ? '#ffffff' : '#000000';
}

export function team(name, { rank = true, record = false, seed = null, link = true, size = 18, abbrAlt = false, ranks = null } = {}) {
  if (!name) return '<span class="muted">TBD</span>';
  const t = teamInfo(name);
  const rk = (ranks || cache.ranks())[name];
  // Seed in parentheses, then the poll ranking, both right before the name.
  const r = (seed ? `<span class="rank seed" title="Seed">(${seed})</span>` : '') + (rank && rk ? `<span class="rank" title="Poll ranking">${rk}</span>` : '');
  let rec = '';
  if (record && S().teams[name]) { const x = cache.recs()[name]; rec = ` <span class="muted small">${x.w}-${x.l}</span>`; }
  // abbrAlt: also carry the abbreviation, shown instead when the card is narrow.
  const text = abbrAlt && t?.abbr ? `<span class="tn-full">${esc(name)}</span><span class="tn-abbr">${esc(t.abbr)}</span>` : esc(name);
  const label = t && link ? `<a class="team-link" href="${teamHref(name)}" title="${esc(name)}">${text}</a>` : text;
  return `<span class="team">${logoImg(t, size)}${r}${label}${rec}</span>`;
}

export function teamOptions(selected, { blank = true, list = teamNames(), blankLabel = '—' } = {}) {
  return (blank ? `<option value="">${esc(blankLabel)}</option>` : '') + list.map(t => `<option ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

// ---------- conferences ----------

export function confInfo(c) { return ctx.league.conferences[c] || { abbr: initials(c), color: '#555555' }; }
export function confColor(c) { return confInfo(c).color || '#555555'; }
export function confLogo(c, size = 24) {
  const info = confInfo(c);
  const badge = `<span class="conf-badge" style="width:${size}px;height:${size}px;font-size:${Math.max(8, size * 0.34)}px;background:${esc(info.color)}">${esc(info.abbr || initials(c))}</span>`;
  if (!info.logo) return badge;
  return `<span class="conf-logo" style="width:${size}px;height:${size}px"><img src="${esc(info.logo)}" alt="" onerror="this.parentNode.classList.add('broken')">${badge}</span>`;
}

// Read an image file and shrink it to at most `max` pixels, as a data URL.
export function imageFileToDataUrl(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Pick an image file (PNG, JPG, SVG, GIF or WebP).'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const w = img.naturalWidth || max, h = img.naturalHeight || max, k = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- game cards ----------

// Seed shown on a postseason game: the conference tournament seed, or the
// national seed for NCAA regional hosts only.
export function seedOf(g, t) {
  const s = S();
  if (g.type === 'conf') { const ev = Object.values(s.post?.confT || {}).find(e => e.id === g.event); const i = ev ? ev.seeds.indexOf(t) : -1; return i >= 0 ? i + 1 : null; }
  if (!['regional', 'super', 'mcws'].includes(g.type)) return null;
  return shownSeed(s, t);
}

export function resultText(g) {
  const w = winnerOf(g), l = w === g.home ? g.away : g.home;
  const extra = g.homeLine.length > 7 || g.awayLine.length > 7 ? ` (${Math.max(g.homeLine.length, g.awayLine.length)})` : g.runRule ? ` (${Math.max(g.homeLine.length, g.awayLine.length)}, run rule)` : '';
  return `${w} ${Math.max(g.homeR, g.awayR)}, ${l} ${Math.min(g.homeR, g.awayR)}${extra}`;
}

// A team's color for a solid block (the rank on poll rows and game cards):
// its main color, or the alternate when the main one is white.
export function teamBlock(name) {
  const t = teamInfo(name) || {};
  const bg = /^#[0-9a-f]{6}$/i.test(t.color || '') && t.color.toLowerCase() !== '#ffffff' ? t.color : (t.altColor || '#2c3e50');
  return `background:${esc(bg)};color:${esc(readableOn(bg))}`;
}

// A team's record as of a game: through it once it's final, going into it
// before that. Conference games add the conference record: 30-5 (7-0).
export function recordAt(t, g) {
  const s = S();
  cache._tg ||= {};
  const list = (cache._tg[t] ||= s.games.filter(x => isFinal(x) && (x.home === t || x.away === t)).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id));
  const key = x => [x.week, x.order, x.id];
  const before = (a, b) => { const A = key(a), B = key(b); for (let k = 0; k < 3; k++) if (A[k] !== B[k]) return A[k] < B[k]; return false; };
  let w = 0, l = 0, cw = 0, cl = 0;
  for (const x of list) {
    if (x !== g && !before(x, g)) continue;
    const won = winnerOf(x) === t;
    won ? w++ : l++;
    if (x.type === 'regular' && x.confGame) won ? cw++ : cl++;
  }
  return `${w}-${l}${g.type === 'regular' && g.confGame ? ` (${cw}-${cl})` : ''}`;
}

// What a game is: the event, the label and where a series stands.
// `short`: the schedule card's version, with Doubleheader shortened to DH.
function gameTag(g, short = false) {
  const parts = [];
  if (g.tourney) parts.push(esc(g.label));
  else if (g.label) { const l = g.midweek ? g.label.replace(' · ', ' ') : g.label; parts.push(esc(short ? l.replace(/Doubleheader/g, 'DH') : l)); }
  else if (g.midweek) parts.push('Midweek');
  else if (g.dh) parts.push(short ? 'DH' : 'Doubleheader');
  else if (g.type === 'regular' && !g.confGame) parts.push('Non-conference');
  const ser = seriesStatus(g, 30);
  if (ser) parts.push(ser);
  return parts.join(' · ');
}
function gameConf(s, g) {
  if (g.type === 'regular' && g.confGame) return s.teams[g.home]?.conference || null;
  if (g.type === 'conf') return g.event.replace(/^ct-/, '');
  return null;
}
const gameStatus = g => (isFinal(g) ? `Final${(n => (n !== 7 ? `/${n}` : ''))(Math.max(g.homeLine.length, g.awayLine.length))}` : g.day);
const venueText = (s, g) => { const v = gameVenue(s, g); return v.stadium || v.city ? [v.stadium, (v.city || '').split(',')[0]].filter(Boolean).join(', ') : ''; };
function favorite(s, g) {
  if (!(g.home && g.away && s.teams[g.home] && s.teams[g.away])) return '';
  const wp = winProbability(s.teams[g.home], s.teams[g.away], g, { volatility: s.settings.volatility });
  const fav = wp >= 0.5 ? g.home : g.away;
  return `${esc(s.teams[fav].abbr)} ${Math.round(Math.max(wp, 1 - wp) * 100)}%`;
}

// One team's row on a game card or box score: the logo in a box, the poll
// rank and name (the seed in parentheses in the postseason) and the score.
// The winner's row takes a faint wash of its color, strongest at the score.
function teamRow(g, t, R, { big = false, record = false } = {}) {
  const fin = isFinal(g), w = fin ? winnerOf(g) : null;
  const ranks = fin ? cache.ranksAt(g.week) : cache.ranks();
  const seed = seedOf(g, t), poll = showsRank(g.type) ? ranks[t] : null;
  const info = teamInfo(t);
  const cls = fin ? (w === t ? 'win' : 'loss') : '';
  const wc = w === t && /^#[0-9a-f]{6}$/i.test(info?.color || '') && info.color.toLowerCase() !== '#ffffff' ? info.color : w === t ? info?.altColor : null;
  const sub = big ? `<span class="ga-sub">${esc(info?.mascot || '')}${info?.mascot ? ' · ' : ''}${recordAt(t, g)}</span>` : '';
  const rec = record && !big ? `<span class="ga-rec">${recordAt(t, g)}</span>` : '';
  return `<div class="ga-line ${cls}"${wc ? ` style="--wc:${esc(wc)}"` : ''}>
    <a class="ga-logo" href="${t ? teamHref(t) : '#'}" title="${esc(t || '')}">${logoImg(info, big ? 30 : 24)}</a>
    <span class="ga-name">${poll ? `<span class="ga-rk" title="Poll ranking">${poll}</span>` : ''}<a class="team-link" href="${t ? teamHref(t) : '#'}">${seed ? `<span class="ga-seed" title="Seed">(${seed})</span> ` : ''}${esc(t || 'TBD')}</a>${sub}</span>${rec}
    <span class="ga-score">${fin ? R : ''}</span><span class="ga-caret">${w === t ? '◀' : ''}</span></div>`;
}
function gameTop(s, g, close = false, short = !close) {
  const conf = gameConf(s, g);
  return `<div class="ga-top">${conf ? `<a class="ga-conf" href="${confHref(conf)}" title="${esc(conf)}${g.type === 'conf' ? ' Tournament' : ' game'}">${confLogo(conf, 18)}</a>` : ''}<span class="ga-tag">${gameTag(g, short)}</span>
    <b class="ga-status ${isFinal(g) ? '' : 'up'}">${gameStatus(g)}</b>${close ? '<button class="ga-x" data-x aria-label="Close">✕</button>' : ''}</div>`;
}

// A game card: the event and status on top, a slim row per team (like the
// poll), and the field with a box score link (or the favorite and a sim
// button before the game) underneath.
export function gameCard(g) {
  const s = S(), fin = isFinal(g);
  const where = venueText(s, g);
  let right;
  if (fin) right = '<span class="ga-link">Box score ›</span>';
  else {
    const fav = favorite(s, g);
    right = `${fav ? `<span class="ga-fav" title="Win probability">${fav}</span>` : ''}${s.teams[g.home] && s.teams[g.away] ? `<button class="btn sm" data-simgame="${g.id}" title="Simulate this game and save the result">🎲 Sim</button>` : ''}`;
  }
  const conf = gameConf(s, g);
  return `<div class="game ga ${fin ? 'final' : 'upcoming'}${conf ? ' conf-game' : ''}"${conf ? ` style="--cc:${esc(confColor(conf))}"` : ''} data-game="${g.id}" tabindex="0">${gameTop(s, g)}
    ${teamRow(g, g.away, g.awayR, { record: !fin })}${teamRow(g, g.home, g.homeR, { record: !fin })}
    <div class="ga-foot"><span class="ga-where">${esc(where)}</span>${right}</div></div>`;
}

// The read-only box score for a played game; "Edit score" opens the editor.
function boxScore(g) {
  const s = S();
  const n = Math.max(g.homeLine.length, g.awayLine.length), w = winnerOf(g);
  const cell = (arr, i) => (i < arr.length ? (arr[i] === null ? 'X' : arr[i]) : '');
  const row = (t, arr, R, H, E) => `<tr class="${w === t ? 'win' : ''}"><th><span class="bx-chip" style="${teamBlock(t)}">${esc(teamInfo(t)?.abbr || t)}</span></th>${Array.from({ length: n }, (_, i) => `<td>${cell(arr, i)}</td>`).join('')}<td class="bx-r">${R}</td><td>${H ?? ''}</td><td>${E ?? ''}</td></tr>`;
  const v = gameVenue(s, g);
  const kind = g.tourney ? g.label : g.type === 'regular' ? (g.confGame ? `${s.teams[g.home]?.conference || 'Conference'} game` : g.midweek ? 'Midweek game' : 'Non-conference game') : (g.label || '').split(' · ')[0];
  const key = g.series || (g.type === 'mcws' && /^F\d/.test(g.node || '') ? `${g.event}-finals` : null);
  const set = key ? s.games.filter(x => (x.series || (x.type === 'mcws' && /^F\d/.test(x.node || '') ? `${x.event}-finals` : null)) === key).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id) : [];
  const chip = x => {
    const cur = x === g ? ' cur' : '';
    if (!isFinal(x)) return `<span class="bx-sg${cur}"><b>${esc(x.day)}</b><span>Not played</span></span>`;
    const xw = winnerOf(x), xi = Math.max(x.homeLine.length, x.awayLine.length);
    return `<button class="bx-sg${cur}" data-sg="${x.id}"><b>${esc(x.day)}</b><span>${esc(teamInfo(xw)?.abbr || xw)} ${Math.max(x.homeR, x.awayR)}-${Math.min(x.homeR, x.awayR)}${xi !== 7 ? ` (${xi})` : ''}</span></button>`;
  };
  return `<div class="bx">${gameTop(s, g, true)}
    <div class="bx-teams">${teamRow(g, g.away, g.awayR, { big: true })}${teamRow(g, g.home, g.homeR, { big: true })}</div>
    <div class="bx-sec"><div class="table-wrap"><table class="bx-ls"><thead><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}<th class="bx-r">R</th><th>H</th><th>E</th></tr></thead>
      <tbody>${row(g.away, g.awayLine, g.awayR, g.awayH, g.awayE)}${row(g.home, g.homeLine, g.homeR, g.homeH, g.homeE)}</tbody></table></div></div>
    <div class="bx-sec bx-info">
      <div><span class="bx-lbl">Where</span><b>${esc(v.stadium || v.host || 'Neutral site')}</b>${v.city ? `<span>${esc(v.city)}</span>` : ''}</div>
      <div><span class="bx-lbl">When</span><b>${esc(DAY_NAMES[g.day] || g.day)} · ${esc(weekName(g.week, s))}</b>${kind ? `<span>${esc(kind)}</span>` : ''}</div>
      ${set.length > 1 ? `<div class="bx-wide"><span class="bx-lbl">Series</span><div class="bx-series">${set.map(chip).join('')}</div></div>` : ''}
    </div>
    <div class="bx-foot"><button class="btn" id="bx-sim" title="Simulate this game again and save the new result">🎲 Re-simulate</button><button class="btn" id="bx-clear">Clear result</button><span class="spacer"></span><button class="btn primary" id="bx-edit">Edit score</button></div></div>`;
}

// ---------- series tally ----------
// Weekend series (and the MCWS Championship Series): where it stands after
// this game, or going into it if it hasn't been played.
function seriesKey(g) {
  if (g.series) return g.series;
  if (g.type === 'mcws' && /^F\d/.test(g.node || '')) return `${g.event}-finals`;
  return null;
}
export function seriesStatus(g, maxChars = 31) {
  const key = seriesKey(g);
  if (!key) return '';
  const s = S();
  cache._series ||= {};
  const all = (cache._series[key] ||= s.games.filter(x => seriesKey(x) === key).sort((a, b) => a.order - b.order || a.id - b.id));
  const bestOf = g.bestOf || (g.type === 'mcws' && /^F\d/.test(g.node || '') ? 3 : null);
  if (all.length < 2 && !bestOf) return '';
  const idx = all.indexOf(g);
  const fin = isFinal(g);
  const upto = all.slice(0, fin ? idx + 1 : idx).filter(isFinal);
  const wins = {};
  for (const x of upto) { const w = winnerOf(x); wins[w] = (wins[w] || 0) + 1; }
  const wa = wins[g.home] || 0, wb = wins[g.away] || 0;
  const leader = wa > wb ? g.home : g.away, hi = Math.max(wa, wb), lo = Math.min(wa, wb);
  // Full school name when the sentence fits the corner; the abbreviation when it doesn't.
  const fits = t => `${t} leads series 10-10`.length <= maxChars;
  const name = t => (fits(t) ? `<span class="tn-full">${esc(t)}</span><span class="tn-abbr">${esc(teamInfo(t)?.abbr || t)}</span>` : esc(teamInfo(t)?.abbr || t));
  // Weekend and midweek sets play every game; best-of-three series stop at two wins.
  const total = bestOf || all.length;
  const left = total - upto.length;
  const clinched = bestOf ? hi > bestOf / 2 : hi > lo + left;
  const over = bestOf ? clinched : left === 0;
  let text;
  if (!upto.length) text = bestOf ? 'Best of 3' : `Game 1 of ${total}`;
  else if (wa === wb) text = over ? `Series split ${wa}-${wb}` : `Series tied ${wa}-${wb}`;
  else if (clinched) text = `${name(leader)} wins series ${hi}-${lo}`;
  else text = `${name(leader)} leads series ${hi}-${lo}`;
  const prefix = !fin && upto.length ? `Game ${idx + 1} · ` : '';
  const plain = (prefix + text.replace(/<span class="tn-full">([^<]*)<\/span><span class="tn-abbr">[^<]*<\/span>/g, '$1')).replace(/<[^>]+>/g, '');
  return `<span class="series-text" title="${esc(plain)}">${prefix}${text}</span>`;
}

export function bindGameCards(root = app) {
  $$('[data-simgame]', root).forEach(b => (b.onclick = e => {
    e.stopPropagation();
    const g = S().games.find(x => x.id === Number(b.dataset.simgame));
    if (!g || isFinal(g)) return;
    applyResult(g, simResult(S(), g));
    toast(resultText(g));
    changed();
  }));
  $$('.game[data-game], .bgame[data-game]', root).forEach(el => {
    el.onclick = e => { if (!e.target.closest('a, button')) openGame(Number(el.dataset.game)); };
    el.onkeydown = e => { if (e.key === 'Enter') openGame(Number(el.dataset.game)); };
  });
}

// ---------- game editor ----------

// A played game opens as a box score; an unplayed one (or a new one) opens
// the editor.
export function openGame(id, { isNew = false, edit = false } = {}) {
  const s = S(), g = s.games.find(x => x.id === id);
  if (!g) return;
  if (isNew || edit || !isFinal(g)) return editGame(id, { isNew });
  modal.innerHTML = boxScore(g);
  modal.classList.add('bx-modal');
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => { modal.classList.remove('bx-modal'); ctx.render(); };
  $('#bx-edit', modal).onclick = () => { modal.classList.remove('bx-modal'); editGame(id); };
  $$('[data-sg]', modal).forEach(b => (b.onclick = () => openGame(Number(b.dataset.sg))));
  $('#bx-sim', modal).onclick = () => {
    if (!confirm('Simulate this game again? The new result replaces this one.')) return;
    applyResult(g, simResult(s, g)); toast(resultText(g)); changed();
    openGame(id);
  };
  $('#bx-clear', modal).onclick = () => { clearResult(g); modal.close(); changed(); toast('Result cleared.'); };
  if (!modal.open) modal.showModal();
  $('#bx-edit', modal).focus();
}

function editGame(id, { isNew = false } = {}) {
  const s = S(), g = s.games.find(x => x.id === id);
  if (!g) return;
  let source = g.source;
  // Hits and errors that came from a simulation or an estimate (not typed in)
  // are cleared when the runs change, so they get estimated again.
  let autoHE = g.source === 'sim' || !!g.heEstimated;
  let n = isFinal(g) ? Math.max(g.homeLine.length, g.awayLine.length) : 7;
  const regular = g.type === 'regular';
  const cellVal = (arr, i) => (isFinal(g) && i < arr.length ? (arr[i] === null ? '' : arr[i]) : '');

  modal.innerHTML = `
    <div class="modal-head"><h2>${esc(g.label || `${weekName(g.week, s)} · ${DAY_NAMES[g.day] || g.day}`)}</h2>${isFinal(g) ? '<button class="btn sm ghost" id="m-back">‹ Box score</button>' : ''}<button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack">
      ${(v => v.stadium || v.city ? `<div class="small muted venue-line">${esc([v.stadium, v.city].filter(Boolean).join(' · '))}</div>` : '')(gameVenue(s, g))}
      ${regular ? `<div class="row">
        <label class="field" style="flex:1;min-width:140px">Away <select id="m-away">${teamOptions(g.away)}</select></label>
        <label class="field" style="flex:1;min-width:140px">Home <select id="m-home">${teamOptions(g.home)}</select></label>
        <label class="field" style="width:64px">Week <input type="number" id="m-week" min="1" max="${regWeeksOf(s)}" value="${g.week}"></label>
        <label class="field" style="width:84px">Day <select id="m-day">${DAYS.map(d => `<option ${d === g.day ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <div class="row"><label class="check"><input type="checkbox" id="m-neutral" ${g.neutral ? 'checked' : ''}> Neutral site</label>
        <label class="check"><input type="checkbox" id="m-conf" ${g.confGame ? 'checked' : ''}> Conference game</label></div>` : ''}
      <div class="table-wrap"><div class="lsgrid" id="m-grid"></div></div>
      <div class="row"><button class="btn sm" id="m-addinn">+ Extra inning</button><button class="btn sm" id="m-delinn">− Inning</button>
        <button class="btn sm" id="m-est" title="Fill hits and errors from the line score and the teams' ratings">⚾ Estimate H &amp; E</button>
        <span class="small muted">Leave the home team's last inning blank for an "X" (they didn't need to bat). Hits and errors left blank are estimated from the line score and the teams' ratings when you save.</span></div>
      <div id="m-preview"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="m-sim">🎲 Simulate</button>
      ${isFinal(g) ? '<button class="btn" id="m-clear">Clear result</button>' : ''}
      ${regular ? '<button class="btn danger" id="m-del">Delete game</button>' : ''}
      <span class="spacer"></span>
      <button class="btn" data-x>Cancel</button>
      <button class="btn primary" id="m-save">Save final</button>
    </div>`;

  const cur = () => ({
    home: regular ? $('#m-home', modal).value : g.home,
    away: regular ? $('#m-away', modal).value : g.away,
    neutral: regular ? $('#m-neutral', modal).checked : g.neutral,
  });

  // Line score grid. Values are kept across redraws (adding innings).
  const values = { away: g.awayLine.map((_, i) => cellVal(g.awayLine, i)), home: g.homeLine.map((_, i) => cellVal(g.homeLine, i)), awayH: g.awayH ?? '', awayE: g.awayE ?? '', homeH: g.homeH ?? '', homeE: g.homeE ?? '' };
  const readGrid = () => {
    $$('input[data-inn]', modal).forEach(i => { values[i.dataset.side][Number(i.dataset.inn)] = i.value; });
    for (const k of ['awayH', 'awayE', 'homeH', 'homeE']) { const el = $(`#m-${k}`, modal); if (el) values[k] = el.value; }
  };
  const drawGrid = () => {
    const t = cur();
    const cols = `minmax(110px,1fr) repeat(${n}, 34px) 40px 38px 38px`;
    let h = `<div class="lsrow head" style="grid-template-columns:${cols}"><div></div>${Array.from({ length: n }, (_, i) => `<div>${i + 1}</div>`).join('')}<div>R</div><div>H</div><div>E</div></div>`;
    for (const side of ['away', 'home']) {
      h += `<div class="lsrow" style="grid-template-columns:${cols}"><div class="team-cell">${team(t[side], { link: false, rank: false })}</div>
        ${Array.from({ length: n }, (_, i) => `<input type="text" inputmode="numeric" maxlength="2" autocomplete="off" data-side="${side}" data-inn="${i}" value="${esc(values[side][i] ?? '')}" aria-label="${side} inning ${i + 1}">`).join('')}
        <div class="tot" id="m-${side}-R"></div>
        <input type="text" inputmode="numeric" maxlength="2" id="m-${side}H" value="${esc(values[side + 'H'])}" aria-label="${side} hits">
        <input type="text" inputmode="numeric" maxlength="2" id="m-${side}E" value="${esc(values[side + 'E'])}" aria-label="${side} errors"></div>`;
    }
    $('#m-grid', modal).innerHTML = h;
    $$('#m-grid input', modal).forEach(i => (i.oninput = () => {
      source = 'manual';
      if (i.dataset.inn != null) {
        if (autoHE) { autoHE = false; for (const k of ['awayH', 'awayE', 'homeH', 'homeE']) { values[k] = ''; $(`#m-${k}`, modal).value = ''; } }
      } else autoHE = false;
      readGrid(); totals();
    }));
    for (const k of ['awayH', 'awayE', 'homeH', 'homeE']) $(`#m-${k}`, modal).placeholder = 'auto';
    // Tab follows the game: top 1st, bottom 1st, top 2nd, … then hits and
    // errors. Shift+Tab goes back. Each box's number is selected so typing replaces it.
    const order = [];
    for (let i = 0; i < n; i++) order.push($(`input[data-side="away"][data-inn="${i}"]`, modal), $(`input[data-side="home"][data-inn="${i}"]`, modal));
    order.push($('#m-awayH', modal), $('#m-awayE', modal), $('#m-homeH', modal), $('#m-homeE', modal));
    order.forEach((el, idx) => {
      el.onfocus = () => el.select();
      el.onkeydown = e => {
        if (e.key !== 'Tab') return;
        const next = order[idx + (e.shiftKey ? -1 : 1)];
        if (!next) return; // leave the grid normally at either end
        e.preventDefault();
        next.focus();
      };
    });
    totals();
  };
  const totals = () => { for (const side of ['away', 'home']) $(`#m-${side}-R`, modal).textContent = sum(values[side].slice(0, n)); };
  const refresh = () => {
    const t = cur(), prev = $('#m-preview', modal);
    if (t.home && t.away && s.teams[t.home] && s.teams[t.away] && t.home !== t.away) {
      const wp = winProbability(s.teams[t.home], s.teams[t.away], { ...g, home: t.home, away: t.away, neutral: t.neutral }, { volatility: s.settings.volatility });
      const ch = c => s.teams[c]?.color || '#999';
      prev.innerHTML = `<div class="small muted" style="margin-bottom:4px">Pre-game: ${esc(t.home)} wins ${Math.round(wp * 100)}%, ${esc(t.away)} ${Math.round((1 - wp) * 100)}% · OVR ${ovr(s.teams[t.away])} vs ${ovr(s.teams[t.home])}</div>
        <div class="wpbar"><div style="width:${(1 - wp) * 100}%;background:${esc(ch(t.away))}"></div><div style="width:${wp * 100}%;background:${esc(ch(t.home))}"></div></div>`;
    } else prev.innerHTML = '';
  };
  drawGrid(); refresh();

  if (regular) {
    const onTeams = () => {
      const t = cur();
      if (t.home && t.away && s.teams[t.home] && s.teams[t.away]) $('#m-conf', modal).checked = sameConf(s.teams, t.home, t.away);
      drawGrid(); refresh();
    };
    $('#m-home', modal).onchange = onTeams; $('#m-away', modal).onchange = onTeams;
    $('#m-neutral', modal).onchange = refresh;
  }
  $('#m-addinn', modal).onclick = () => { readGrid(); n++; drawGrid(); };
  $('#m-delinn', modal).onclick = () => { readGrid(); if (n > 1) { n--; values.home.length = Math.min(values.home.length, n); values.away.length = Math.min(values.away.length, n); } drawGrid(); };
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  if ($('#m-back', modal)) $('#m-back', modal).onclick = () => openGame(g.id);
  modal.onclose = () => {
    if (isNew && !isFinal(g) && (!g.home || !g.away)) deleteGame(s, g.id);
    ctx.render();
  };

  $('#m-sim', modal).onclick = () => {
    const t = cur();
    if (!t.home || !t.away || t.home === t.away) return toast('Pick two different teams first.', true);
    const res = simResult(s, { ...g, ...t });
    n = Math.max(res.homeLine.length, res.awayLine.length);
    values.away = res.awayLine.map(v => (v === null ? '' : v));
    values.home = res.homeLine.map(v => (v === null ? '' : v));
    Object.assign(values, { awayH: res.away.H, awayE: res.away.E, homeH: res.home.H, homeE: res.home.E });
    source = 'sim'; autoHE = true;
    drawGrid(); refresh();
  };
  if ($('#m-clear', modal)) $('#m-clear', modal).onclick = () => { clearResult(g); modal.close(); changed(); toast('Result cleared.'); };
  if ($('#m-del', modal)) $('#m-del', modal).onclick = () => {
    if (!confirm('Delete this game from the schedule?')) return;
    deleteGame(s, g.id); isNew = false; modal.close(); changed();
  };

  const num = v => /^\d+$/.test(String(v).trim());
  // Check the grid; returns the line scores, or shows what's wrong.
  const readLines = () => {
    readGrid();
    const t = cur();
    if (!t.home || !t.away) return toast('Pick both teams.', true);
    if (t.home === t.away) return toast("A team can't play itself.", true);
    const away = values.away.slice(0, n), home = values.home.slice(0, n);
    while (away.length < n) away.push(''); while (home.length < n) home.push('');
    if (away.some(v => !num(v))) return toast('Fill in every inning for the away team (0 is fine).', true);
    if (home.slice(0, n - 1).some(v => !num(v))) return toast('Fill in every home inning; only the last one can be blank.', true);
    if (home[n - 1] !== '' && !num(home[n - 1])) return toast('Runs must be whole numbers.', true);
    for (const k of ['awayH', 'awayE', 'homeH', 'homeE']) if (values[k] !== '' && !num(values[k])) return toast('Hits and errors must be whole numbers.', true);
    const awayLine = away.map(Number), homeLine = home.map((v, i) => (i === n - 1 && v === '' ? null : Number(v)));
    const hr = sum(homeLine), ar = sum(awayLine);
    if (hr === ar) return toast("Games can't end tied. Add an extra inning.", true);
    if (homeLine[n - 1] === null && hr <= ar) return toast('The home team only skips its last at-bat when it is already ahead.', true);
    return { t, homeLine, awayLine, hr, ar };
  };
  // Fill hits and errors from the ratings: all four, or only the blank ones.
  const fillHE = (L, onlyBlank) => {
    const e = estimateHE(s, { ...g, ...L.t }, L.homeLine, L.awayLine);
    const est = { awayH: e.away.H, awayE: e.away.E, homeH: e.home.H, homeE: e.home.E };
    let filled = 0;
    for (const k of Object.keys(est)) if (!onlyBlank || values[k] === '') { values[k] = est[k]; filled++; }
    return filled;
  };
  $('#m-est', modal).onclick = () => {
    const L = readLines(); if (!L) return;
    fillHE(L, false); autoHE = true; drawGrid();
    toast('Hits and errors estimated. Change any of them before saving.');
  };

  $('#m-save', modal).onclick = () => {
    const L = readLines(); if (!L) return;
    const { t, homeLine, awayLine, hr, ar } = L;
    const nEst = source !== 'sim' ? fillHE(L, true) : 0, estimated = nEst > 0;
    if (regular) {
      g.home = t.home; g.away = t.away; g.neutral = t.neutral; g.confGame = $('#m-conf', modal).checked;
      g.week = Math.max(1, Math.min(regWeeksOf(s), Number($('#m-week', modal).value) || g.week));
      // Keep the game's place in the day (a doubleheader's or tournament's
      // game order) unless it moved to another day.
      const day = $('#m-day', modal).value;
      if (day !== g.day) { g.day = day; g.order = DAY_ORDER[day]; }
    }
    applyResult(g, {
      homeLine, awayLine,
      home: { R: hr, H: Number(values.homeH || 0), E: Number(values.homeE || 0) },
      away: { R: ar, H: Number(values.awayH || 0), E: Number(values.awayE || 0) },
      runRule: n < 7,
    }, source === 'sim' ? 'sim' : 'manual');
    if (nEst === 4 || (autoHE && source !== 'sim')) g.heEstimated = true; else delete g.heEstimated;
    isNew = false; modal.close(); changed(); toast(estimated ? 'Result saved. Blank hits and errors were estimated from the ratings.' : 'Result saved.');
  };
  if (!modal.open) modal.showModal();
}

// ---------- compact bracket cards (team, R, H, E) ----------

// Poll rankings show on regular-season and conference tournament games; NCAA
// games show only the regional hosts' national seeds.
const showsRank = type => type !== 'regional' && type !== 'super' && type !== 'mcws';
// A winner's row in a bracket card: a gradient in the team's color, with
// black or white text, whichever reads better on that color.
function winTint(t) {
  const c = teamInfo(t)?.color;
  if (!/^#[0-9a-f]{6}$/i.test(c || '')) return '';
  const fg = readableOn(c);
  const end = fg === '#ffffff' ? `color-mix(in srgb, ${c} 62%, #000)` : `color-mix(in srgb, ${c} 70%, #fff)`;
  return ` style="--tint:${esc(c)};--tint-end:${end};--tint-fg:${fg}"`;
}
export function compactCard(g, seedFn = () => null) {
  const s = S();
  const fin = isFinal(g);
  const w = fin ? winnerOf(g) : null;
  const inn = Math.max(g.homeLine.length, g.awayLine.length);
  const row = (t, R, H, E) => `<div class="bg-row ${fin ? (w === t ? 'winner win-tint' : 'loser') : ''}"${fin && w === t ? winTint(t) : ''}>
      <span class="bg-team">${team(t, { seed: seedFn(t), size: 16, rank: showsRank(g.type), ranks: fin ? cache.ranksAt(g.week) : null })}</span>
      <span class="bg-n bg-r">${fin ? R : ''}</span></div>`;
  let status = '';
  if (fin) status = `<span class="badge final">Final${inn !== 7 ? '/' + inn : ''}</span>`;
  else if (s.teams[g.home] && s.teams[g.away]) {
    const wp = winProbability(s.teams[g.home], s.teams[g.away], g, { volatility: s.settings.volatility });
    const fav = wp >= 0.5 ? g.home : g.away;
    status = `<span class="muted">${esc(s.teams[fav].abbr)} ${Math.round(Math.max(wp, 1 - wp) * 100)}%</span><button class="btn sm bg-sim" data-simgame="${g.id}" title="Simulate this game and save the result" aria-label="Simulate this game">🎲</button>`;
  }
  const label = g.label ? g.label.split(' · ').slice(-1)[0] : '';
  return `<div class="bgame" data-game="${g.id}" tabindex="0" title="Click for the full line score">
    <div class="bg-row bg-head"><span class="bg-label">${esc(label)}</span><span class="bg-status">${status}</span></div>
    ${row(g.away, g.awayR, g.awayH, g.awayE)}${row(g.home, g.homeR, g.homeH, g.homeE)}</div>`;
}
export function placeholderCard(label, teams, seedFn = () => null, { faded = false, note = '', ranks = true } = {}) {
  const row = t => {
    let inner;
    if (t === 'BYE') inner = '<span class="muted">Bye</span>';
    else if (t && typeof t === 'object') inner = `<span class="muted slot-ref">${esc(t.text)}</span>`;
    else if (t) inner = team(t, { seed: seedFn(t), size: 16, rank: ranks });
    else inner = '<span class="muted">TBD</span>';
    return `<div class="bg-row"><span class="bg-team">${inner}</span><span class="bg-n"></span></div>`;
  };
  return `<div class="bgame placeholder ${faded ? 'faded' : ''}">
    <div class="bg-row bg-head"><span class="bg-label">${esc(label)}</span><span class="bg-status muted">${esc(note)}</span></div>
    ${row(teams[0])}${row(teams[1])}</div>`;
}
