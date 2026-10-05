// Shared UI state and pieces used by every page: the league, saving,
// team labels and logos, game cards, and the game editor.

import { saveLeague } from './store.js?v=20261004210717';
import { logoFor } from './logos.js?v=20261004210717';
import { LOGO_ALIASES } from './data.js?v=20261004210717';
import { ovr, winProbability } from './sim.js?v=20261004210717';
import { records, isFinal, winnerOf } from './standings.js?v=20261004210717';
import { latestPoll, pollRankMap } from './polls.js?v=20261004210717';
import { afterChange, applyResult, clearResult, simResult, deleteGame, weekName } from './league.js?v=20261004210717';
import { DAY_ORDER } from './schedule.js?v=20261004210717';
import { esc } from './util.js?v=20261004210717';

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
  reset() { this._recs = null; this._ranks = null; this._at = {}; },
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
  const r = seed ? `<span class="rank" title="National seed">(${seed})</span>` : rank && rk ? `<span class="rank">${rk}</span>` : '';
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
      <div class="${fin ? (w === t ? 'winner' : 'loser') : ''}">${team(t, { seed: seedOf(g, t), abbrAlt: true, ranks: fin ? cache.ranksAt(g.week) : null })}${!fin && recs[t] ? ` <span class="pre-rec">${recs[t].w}-${recs[t].l}</span>` : ''}</div>
      ${Array.from({ length: n }, (_, i) => `<div class="q">${cell(arr, i)}</div>`).join('')}
      <div class="total">${fin ? R : ''}</div><div class="q he">${fin ? H : ''}</div><div class="q he">${fin ? E : ''}</div></div>`;
  const head = `<div class="line sb head" style="--q:${n}"><div></div>${Array.from({ length: n }, (_, i) => `<div class="q">${i + 1}</div>`).join('')}<div class="q">R</div><div class="q">H</div><div class="q">E</div></div>`;
  let meta = '';
  if (g.label) meta += `<span class="badge gold">${esc(g.label.split(' · ').slice(-1)[0])}</span>`;
  if (fin) {
    const inn = Math.max(g.homeLine.length, g.awayLine.length);
    meta += `<span class="badge final">Final${inn !== 7 ? '/' + inn : ''}</span>${g.source ? `<span class="badge ${g.source}">${g.source}</span>` : ''}`;
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
  $$('.game[data-game], .bgame[data-game]', root).forEach(el => {
    el.onclick = e => { if (!e.target.closest('a, button')) openGame(Number(el.dataset.game)); };
    el.onkeydown = e => { if (e.key === 'Enter') openGame(Number(el.dataset.game)); };
  });
}

// ---------- game editor ----------

export function openGame(id, { isNew = false } = {}) {
  const s = S(), g = s.games.find(x => x.id === id);
  if (!g) return;
  let source = g.source;
  let n = isFinal(g) ? Math.max(g.homeLine.length, g.awayLine.length) : 7;
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
      <div class="table-wrap"><div class="lsgrid" id="m-grid"></div></div>
      <div class="row"><button class="btn sm" id="m-addinn">+ Extra inning</button><button class="btn sm" id="m-delinn">− Inning</button>
        <span class="small muted">Leave the home team's last inning blank for an "X" (they didn't need to bat).</span></div>
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
    $$('#m-grid input', modal).forEach(i => (i.oninput = () => { source = 'manual'; readGrid(); totals(); }));
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
      if (t.home && t.away && s.teams[t.home] && s.teams[t.away]) $('#m-conf', modal).checked = s.teams[t.home].conference === s.teams[t.away].conference;
      drawGrid(); refresh();
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
    n = Math.max(res.homeLine.length, res.awayLine.length);
    values.away = res.awayLine.map(v => (v === null ? '' : v));
    values.home = res.homeLine.map(v => (v === null ? '' : v));
    Object.assign(values, { awayH: res.away.H, awayE: res.away.E, homeH: res.home.H, homeE: res.home.E });
    source = 'sim';
    drawGrid(); refresh();
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
    applyResult(g, {
      homeLine, awayLine,
      home: { R: hr, H: Number(values.homeH || 0), E: Number(values.homeE || 0) },
      away: { R: ar, H: Number(values.awayH || 0), E: Number(values.awayE || 0) },
      runRule: n < 7,
    }, source === 'sim' ? 'sim' : 'manual');
    isNew = false; modal.close(); changed(); toast('Result saved.');
  };
  modal.showModal();
}

// ---------- compact bracket cards (team, R, H, E) ----------

export function compactCard(g, seedFn = () => null) {
  const s = S();
  const fin = isFinal(g);
  const w = fin ? winnerOf(g) : null;
  const inn = Math.max(g.homeLine.length, g.awayLine.length);
  const row = (t, R, H, E) => `<div class="bg-row ${fin ? (w === t ? 'winner' : 'loser') : ''}">
      <span class="bg-team">${seedFn(t) ? `<span class="rank">${seedFn(t)}</span>` : ''}${team(t, { rank: false, size: 16 })}</span>
      <span class="bg-n bg-r">${fin ? R : ''}</span><span class="bg-n">${fin ? H : ''}</span><span class="bg-n">${fin ? E : ''}</span></div>`;
  let foot = '';
  if (fin) foot = `<span class="badge final">Final${inn !== 7 ? '/' + inn : ''}</span>`;
  else if (s.teams[g.home] && s.teams[g.away]) {
    const wp = winProbability(s.teams[g.home], s.teams[g.away], g, { volatility: s.settings.volatility });
    const fav = wp >= 0.5 ? g.home : g.away;
    foot = `<span class="muted">${esc(s.teams[fav].abbr)} ${Math.round(Math.max(wp, 1 - wp) * 100)}%</span><button class="btn sm" data-simgame="${g.id}" title="Simulate this game and save the result">🎲 Sim</button>`;
  }
  const label = g.label ? g.label.split(' · ').slice(-1)[0] : '';
  return `<div class="bgame" data-game="${g.id}" tabindex="0" title="Click for the full line score">
    <div class="bg-row bg-head"><span>${esc(label)}</span><span class="bg-n">R</span><span class="bg-n">H</span><span class="bg-n">E</span></div>
    ${row(g.away, g.awayR, g.awayH, g.awayE)}${row(g.home, g.homeR, g.homeH, g.homeE)}
    <div class="bg-foot">${foot}</div></div>`;
}

// A bracket slot whose game doesn't exist yet. `teams` entries are a team
// name, 'BYE', or { text } for "Winner of SF-1" style placeholders.
export function placeholderCard(label, teams, seedFn = () => null, { faded = false, note = '' } = {}) {
  const row = t => {
    let inner;
    if (t === 'BYE') inner = '<span class="muted">Bye</span>';
    else if (t && typeof t === 'object') inner = `<span class="muted slot-ref">${esc(t.text)}</span>`;
    else if (t) inner = `${seedFn(t) ? `<span class="rank">${seedFn(t)}</span>` : ''}${team(t, { rank: false, size: 16 })}`;
    else inner = '<span class="muted">TBD</span>';
    return `<div class="bg-row"><span class="bg-team">${inner}</span><span class="bg-n"></span><span class="bg-n"></span><span class="bg-n"></span></div>`;
  };
  return `<div class="bgame placeholder ${faded ? 'faded' : ''}">
    <div class="bg-row bg-head"><span>${esc(label)}</span><span class="bg-n">R</span><span class="bg-n">H</span><span class="bg-n">E</span></div>
    ${row(teams[0])}${row(teams[1])}<div class="bg-foot"><span class="muted">${esc(note)}</span></div></div>`;
}
