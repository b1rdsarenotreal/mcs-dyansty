// Shared UI state and pieces used by every page: the league, saving,
// team labels and logos, game cards, and the game editor.

import { saveLeague } from './store.js';
import { logoFor } from './logos.js';
import { LOGO_ALIASES } from './data.js';
import { ovr, winProbability, starterSlot } from './sim.js';
import { records, isFinal, winnerOf } from './standings.js';
import { latestPoll, pollRankMap } from './polls.js';
import { afterChange, applyResult, clearResult, simResult, deleteGame, weekName } from './league.js';
import { DAY_ORDER } from './schedule.js';
import { esc } from './util.js';

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
  reset() { this._recs = null; this._ranks = null; },
  recs() { return (this._recs ||= records(S())); },
  ranks() { return (this._ranks ||= pollRankMap(latestPoll(S()))); },
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

export function team(name, { rank = true, record = false, seed = null, link = true, size = 18 } = {}) {
  if (!name) return '<span class="muted">TBD</span>';
  const t = teamInfo(name);
  const rk = cache.ranks()[name];
  const r = seed ? `<span class="rank" title="National seed">(${seed})</span>` : rank && rk ? `<span class="rank">${rk}</span>` : '';
  let rec = '';
  if (record && S().teams[name]) { const x = cache.recs()[name]; rec = ` <span class="muted small">${x.w}-${x.l}</span>`; }
  const label = t && link ? `<a class="team-link" href="${teamHref(name)}">${esc(name)}</a>` : esc(name);
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

export function seedOf(g, t) {
  if (!['regional', 'mcws'].includes(g.type)) return null;
  return S().post?.field?.find(f => f.team === t)?.seed ?? null;
}

export function resultText(g) {
  const w = winnerOf(g), l = w === g.home ? g.away : g.home;
  const extra = g.homeLine.length > 7 || g.awayLine.length > 7 ? ` (${Math.max(g.homeLine.length, g.awayLine.length)})` : g.runRule ? ` (${Math.max(g.homeLine.length, g.awayLine.length)}, run rule)` : '';
  return `${w} ${Math.max(g.homeR, g.awayR)}, ${l} ${Math.min(g.homeR, g.awayR)}${extra}`;
}

export function gameCard(g) {
  const s = S();
  const n = Math.max(7, g.homeLine.length, g.awayLine.length);
  const fin = isFinal(g);
  const w = fin ? winnerOf(g) : null;
  const confGame = g.type === 'regular' && g.confGame;
  const conf = confGame ? s.teams[g.home]?.conference : g.type === 'conf' ? g.event.replace(/^ct-/, '') : null;
  const cell = (arr, i) => (fin ? (i < arr.length ? (arr[i] === null ? 'X' : arr[i]) : '') : '');
  const recs = cache.recs();
  const line = (t, arr, R, H, E) => `<div class="line sb" style="--q:${n}">
      <div class="${fin ? (w === t ? 'winner' : 'loser') : ''}">${team(t, { seed: seedOf(g, t) })}${!fin && recs[t] ? ` <span class="pre-rec">${recs[t].w}-${recs[t].l}</span>` : ''}</div>
      ${Array.from({ length: n }, (_, i) => `<div class="q">${cell(arr, i)}</div>`).join('')}
      <div class="total">${fin ? R : ''}</div><div class="q he">${fin ? H : ''}</div><div class="q he">${fin ? E : ''}</div></div>`;
  const head = `<div class="line sb head" style="--q:${n}"><div></div>${Array.from({ length: n }, (_, i) => `<div class="q">${i + 1}</div>`).join('')}<div class="q">R</div><div class="q">H</div><div class="q">E</div></div>`;
  let meta = '';
  if (g.label) meta += `<span class="badge gold">${esc(g.label.split(' · ').slice(-1)[0])}</span>`;
  if (fin) {
    const inn = Math.max(g.homeLine.length, g.awayLine.length);
    meta += `<span class="badge final">Final${inn !== 7 ? '/' + inn : ''}</span>${g.source ? `<span class="badge ${g.source}">${g.source}</span>` : ''}`;
    if (g.wp) meta += `<span class="pit">W: ${esc(g.wp)}${g.lp ? ` · L: ${esc(g.lp)}` : ''}${g.sv ? ` · S: ${esc(g.sv)}` : ''}</span>`;
  } else if (g.home && g.away && s.teams[g.home] && s.teams[g.away]) {
    const wp = winProbability(s.teams[g.home], s.teams[g.away], g, { volatility: s.settings.volatility });
    const fav = wp >= 0.5 ? g.home : g.away;
    meta += `<span>${esc(s.teams[fav].abbr)} ${Math.round(Math.max(wp, 1 - wp) * 100)}%</span>`;
    if (g.neutral) meta += '<span>Neutral</span>';
    meta += `<button class="btn sm" data-simgame="${g.id}" title="Simulate this game and save the result">🎲 Sim</button>`;
  }
  const confAttrs = conf ? ` conf-game" style="--cc:${esc(confColor(conf))}` : '';
  const corner = conf ? `<a class="corner-logo" href="${confHref(conf)}" title="${esc(conf)}${confGame ? ' game' : ' Tournament'}">${confLogo(conf, 20)}</a>` : '';
  return `<div class="game${confAttrs}" data-game="${g.id}" tabindex="0">${corner}${head}${line(g.away, g.awayLine, g.awayR, g.awayH, g.awayE)}${line(g.home, g.homeLine, g.homeR, g.homeH, g.homeE)}<div class="meta">${meta}</div></div>`;
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
  $$('.game[data-game]', root).forEach(el => {
    el.onclick = e => { if (!e.target.closest('a, button')) openGame(Number(el.dataset.game)); };
    el.onkeydown = e => { if (e.key === 'Enter') openGame(Number(el.dataset.game)); };
  });
}

// ---------- game editor ----------

export function openGame(id, { isNew = false } = {}) {
  const s = S(), g = s.games.find(x => x.id === id);
  if (!g) return;
  let source = g.source, pitching = g.pitching, simPicks = null;
  let n = Math.max(7, g.homeLine.length, g.awayLine.length);
  const regular = g.type === 'regular';
  const cellVal = (arr, i) => (isFinal(g) && i < arr.length ? (arr[i] === null ? '' : arr[i]) : '');

  modal.innerHTML = `
    <div class="modal-head"><h2>${esc(g.label || `${weekName(g.week)} · ${DAY_NAMES[g.day] || g.day}`)}</h2><button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack">
      ${regular ? `<div class="row">
        <label class="field" style="flex:1;min-width:140px">Away <select id="m-away">${teamOptions(g.away)}</select></label>
        <label class="field" style="flex:1;min-width:140px">Home <select id="m-home">${teamOptions(g.home)}</select></label>
        <label class="field" style="width:64px">Week <input type="number" id="m-week" min="1" max="14" value="${g.week}"></label>
        <label class="field" style="width:84px">Day <select id="m-day">${DAYS.map(d => `<option ${d === g.day ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <div class="row"><label class="check"><input type="checkbox" id="m-neutral" ${g.neutral ? 'checked' : ''}> Neutral site</label>
        <label class="check"><input type="checkbox" id="m-conf" ${g.confGame ? 'checked' : ''}> Conference game</label></div>` : ''}
      <div class="row" id="m-starters"></div>
      <div class="table-wrap"><div class="lsgrid" id="m-grid"></div></div>
      <div class="row"><button class="btn sm" id="m-addinn">+ Extra inning</button><button class="btn sm" id="m-delinn">− Inning</button>
        <span class="small muted">Leave the home team's last inning blank for an "X" (they didn't need to bat).</span></div>
      <div class="row" id="m-pitchers"></div>
      <div id="m-preview"></div>
      <div id="m-box"></div>
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
  const staffOpts = (t, sel, blank = true) => (blank ? '<option value="">—</option>' : '') + (s.teams[t]?.staff || []).map(p => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');

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
    $$('#m-grid input', modal).forEach(i => (i.oninput = () => { source = 'manual'; pitching = null; readGrid(); totals(); }));
    totals();
  };
  const totals = () => { for (const side of ['away', 'home']) $(`#m-${side}-R`, modal).textContent = sum(values[side].slice(0, n)); };
  const slotName = (t, side) => { const tm = s.teams[t]; if (!tm) return ''; const i = starterSlot({ ...g, home: cur().home, away: cur().away }, side); return tm.staff[i] || ''; };
  const drawStarters = () => {
    const t = cur();
    const pick = side => {
      const fixed = side === 'home' ? g.homeStarter : g.awayStarter;
      const tm = s.teams[t[side]];
      if (!tm) return '';
      return `<label class="field" style="flex:1;min-width:150px">${esc(tm.abbr)} starter <select data-starter="${side}">
        <option value="">Rotation (${esc(slotName(t[side], side))})</option>${tm.staff.map((p, i) => `<option value="${i}" ${fixed === i ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>`;
    };
    $('#m-starters', modal).innerHTML = pick('away') + pick('home');
    $$('[data-starter]', modal).forEach(sel => (sel.onchange = () => { const v = sel.value === '' ? null : Number(sel.value); if (sel.dataset.starter === 'home') g.homeStarter = v; else g.awayStarter = v; refresh(); }));
  };
  const drawPitchers = (picks = { wp: g.wp, lp: g.lp, sv: g.sv }) => {
    const t = cur();
    const both = sel => `<option value="">—</option>${[t.away, t.home].filter(Boolean).map(tm => `<optgroup label="${esc(tm)}">${staffOpts(tm, sel, false)}</optgroup>`).join('')}`;
    $('#m-pitchers', modal).innerHTML = ['wp', 'lp', 'sv'].map(k => `<label class="field" style="flex:1;min-width:130px">${{ wp: 'Winning pitcher', lp: 'Losing pitcher', sv: 'Save' }[k]} <select id="m-${k}">${both(picks[k])}</select></label>`).join('');
  };
  const refresh = () => {
    const t = cur(), prev = $('#m-preview', modal);
    if (t.home && t.away && s.teams[t.home] && s.teams[t.away] && t.home !== t.away) {
      const wp = winProbability(s.teams[t.home], s.teams[t.away], { ...g, home: t.home, away: t.away, neutral: t.neutral }, { volatility: s.settings.volatility });
      const ch = c => s.teams[c]?.color || '#999';
      prev.innerHTML = `<div class="small muted" style="margin-bottom:4px">Pre-game: ${esc(t.home)} wins ${Math.round(wp * 100)}%, ${esc(t.away)} ${Math.round((1 - wp) * 100)}% · OVR ${ovr(s.teams[t.away])} vs ${ovr(s.teams[t.home])}</div>
        <div class="wpbar"><div style="width:${(1 - wp) * 100}%;background:${esc(ch(t.away))}"></div><div style="width:${wp * 100}%;background:${esc(ch(t.home))}"></div></div>`;
    } else prev.innerHTML = '';
    drawBox();
  };
  const drawBox = () => {
    const box = $('#m-box', modal);
    if (!pitching) { box.innerHTML = ''; return; }
    const t = cur();
    const ip = o => `${Math.floor(o / 3)}.${o % 3}`;
    const tbl = side => `<table class="box"><thead><tr><th>${esc(t[side])} pitching</th><th class="num">IP</th><th class="num">H</th><th class="num">R</th><th class="num">BB</th><th class="num">K</th></tr></thead><tbody>
      ${(pitching[side] || []).map(p => `<tr><td>${esc(p.name)}</td><td class="num">${ip(p.outs)}</td><td class="num">${p.h}</td><td class="num">${p.r}</td><td class="num">${p.bb}</td><td class="num">${p.k}</td></tr>`).join('')}</tbody></table>`;
    box.innerHTML = `<div class="box-grid">${tbl('away')}${tbl('home')}</div>`;
  };

  drawGrid(); drawStarters(); drawPitchers(); refresh();

  if (regular) {
    const onTeams = () => {
      const t = cur();
      if (t.home && t.away && s.teams[t.home] && s.teams[t.away]) $('#m-conf', modal).checked = s.teams[t.home].conference === s.teams[t.away].conference;
      drawGrid(); drawStarters(); drawPitchers(); refresh();
    };
    $('#m-home', modal).onchange = onTeams; $('#m-away', modal).onchange = onTeams;
    $('#m-neutral', modal).onchange = refresh;
  }
  $('#m-addinn', modal).onclick = () => { readGrid(); n++; drawGrid(); };
  $('#m-delinn', modal).onclick = () => { readGrid(); if (n > 1) { n--; values.home.length = Math.min(values.home.length, n); values.away.length = Math.min(values.away.length, n); } drawGrid(); };
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => {
    if (isNew && !isFinal(g) && (!g.home || !g.away)) deleteGame(s, g.id);
    ctx.render();
  };

  $('#m-sim', modal).onclick = () => {
    const t = cur();
    if (!t.home || !t.away || t.home === t.away) return toast('Pick two different teams first.', true);
    const res = simResult(s, { ...g, ...t });
    n = Math.max(7, res.homeLine.length, res.awayLine.length);
    values.away = res.awayLine.map(v => (v === null ? '' : v));
    values.home = res.homeLine.map(v => (v === null ? '' : v));
    Object.assign(values, { awayH: res.away.H, awayE: res.away.E, homeH: res.home.H, homeE: res.home.E });
    pitching = res.pitching; source = 'sim'; simPicks = { wp: res.wp, lp: res.lp, sv: res.sv };
    drawGrid(); drawPitchers(simPicks); refresh();
  };
  if ($('#m-clear', modal)) $('#m-clear', modal).onclick = () => { clearResult(g); modal.close(); changed(); toast('Result cleared.'); };
  if ($('#m-del', modal)) $('#m-del', modal).onclick = () => {
    if (!confirm('Delete this game from the schedule?')) return;
    deleteGame(s, g.id); isNew = false; modal.close(); changed();
  };

  $('#m-save', modal).onclick = () => {
    readGrid();
    const t = cur();
    if (!t.home || !t.away) return toast('Pick both teams.', true);
    if (t.home === t.away) return toast("A team can't play itself.", true);
    const num = v => /^\d+$/.test(String(v).trim());
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
    if (regular) {
      g.home = t.home; g.away = t.away; g.neutral = t.neutral; g.confGame = $('#m-conf', modal).checked;
      g.week = Math.max(1, Math.min(14, Number($('#m-week', modal).value) || g.week));
      g.day = $('#m-day', modal).value; g.order = DAY_ORDER[g.day];
    }
    const winSide = hr > ar ? 'home' : 'away', loseSide = winSide === 'home' ? 'away' : 'home';
    const starter = side => slotName(t[side], side);
    const pick = k => $(`#m-${k}`, modal).value || null;
    applyResult(g, {
      homeLine, awayLine,
      home: { R: hr, H: Number(values.homeH || 0), E: Number(values.homeE || 0) },
      away: { R: ar, H: Number(values.awayH || 0), E: Number(values.awayE || 0) },
      wp: pick('wp') || starter(winSide), lp: pick('lp') || starter(loseSide), sv: pick('sv'),
      pitching: source === 'sim' ? pitching : null,
      runRule: n < 7,
    }, source === 'sim' ? 'sim' : 'manual');
    isNew = false; modal.close(); changed(); toast('Result saved.');
  };
  modal.showModal();
}
