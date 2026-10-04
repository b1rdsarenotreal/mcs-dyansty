// League pages: teams, team profiles, conferences, history, settings.

import { ctx, S, app, modal, $, $$, esc, toast, changed, persist, flushSave, cache, team, teamInfo, logoImg, teamOptions, teamHref, confLogo, confHref, confInfo, confColor, imageFileToDataUrl, readableOn, openGame, resultText } from './ui.js';
import { isFinal, winnerOf, records, rpi, confStandings, regSeasonChamp } from './standings.js';
import { ovr } from './sim.js';
import { latestPoll, pollRankMap } from './polls.js';
import { addTeam, removeTeam, renameTeam, addConference, renameConference, deleteConference, rebuildSchedule, startNextSeason, weekName, newLeague } from './league.js';
import { postseasonFinish } from './postseason.js';
import { exportLeague, clearLeague } from './store.js';
import { clamp } from './util.js';

const ui = { confFilter: '' };
const ROLES = ['Friday starter', 'Saturday starter', 'Sunday starter', 'Midweek / relief'];
const rate = v => clamp(Math.round(Number(v) || 0), 40, 99);

function ratingBar(label, v, color) {
  const pct = ((v - 40) / 59) * 100;
  return `<div class="rbar"><span class="rl">${label}</span><div class="rtrack"><div style="width:${pct}%;background:${esc(color)}"></div></div><span class="rv">${v}</span></div>`;
}

// ---------- Teams ----------

export function renderTeams() {
  const s = S(), recs = cache.recs(), pr = cache.ranks();
  const confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  const list = Object.values(s.teams).filter(t => !ui.confFilter || t.conference === ui.confFilter)
    .sort((a, b) => a.conference.localeCompare(b.conference) || ovr(b) - ovr(a));
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Teams</h1><span class="muted">${Object.keys(s.teams).length} teams</span><span class="spacer"></span><button class="btn primary" id="t-add">+ Add team</button></div>
    <div class="chips"><button class="chip ${!ui.confFilter ? 'active' : ''}" data-cf="">All</button>${confs.map(c => `<button class="chip ${ui.confFilter === c ? 'active' : ''}" data-cf="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="card"><div class="table-wrap"><table class="teams-table">
      <thead><tr><th>Team</th><th>Conference</th><th class="num">OFF</th><th class="num">PIT</th><th class="num">DEF</th><th class="num">OVR</th><th class="num">Record</th><th class="num">Poll</th></tr></thead>
      <tbody>${list.map(t => `<tr><td>${team(t.school, { rank: false })}</td>
        <td><select data-conf="${esc(t.school)}">${confs.map(c => `<option ${c === t.conference ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
        ${['off', 'pit', 'def'].map(k => `<td class="num"><input type="number" min="40" max="99" class="rin" data-rate="${k}" data-team="${esc(t.school)}" value="${t[k]}"></td>`).join('')}
        <td class="num"><b data-ovr="${esc(t.school)}">${ovr(t)}</b></td><td class="num">${recs[t.school].w}-${recs[t.school].l}</td><td class="num muted">${pr[t.school] ?? ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Ratings run 40–99. OVR = 40% OFF (hitting) + 40% PIT (pitching staff) + 20% DEF (fielding). Changes apply to games simulated from now on. Moving a team to another conference doesn't change games already scheduled; rebuild the schedule in Settings before the season starts, or edit games on the Schedule page.</p></div>`;
  $$('[data-cf]').forEach(b => (b.onclick = () => { ui.confFilter = b.dataset.cf; renderTeams(); }));
  $$('[data-rate]').forEach(inp => (inp.onchange = () => {
    const t = s.teams[inp.dataset.team];
    t[inp.dataset.rate] = rate(inp.value); inp.value = t[inp.dataset.rate];
    $(`[data-ovr="${CSS.escape(t.school)}"]`).textContent = ovr(t);
    persist();
  }));
  $$('[data-conf]').forEach(sel => (sel.onchange = () => { s.teams[sel.dataset.conf].conference = sel.value; changed({ progress: false }); }));
  $('#t-add').onclick = () => teamForm();
}

function teamForm() {
  const s = S(), confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  const canRebuild = !s.games.some(g => g.type === 'regular' && isFinal(g));
  modal.innerHTML = `<div class="modal-head"><h2>Add a team</h2><button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack">
      <div class="row"><label class="field" style="flex:2">School <input type="text" id="f-school" placeholder="e.g. Oregon State"></label>
        <label class="field" style="flex:1">Mascot <input type="text" id="f-mascot" placeholder="Beavers"></label>
        <label class="field" style="width:90px">Abbr. <input type="text" id="f-abbr" maxlength="5" placeholder="ORST"></label></div>
      <div class="row"><label class="field" style="flex:1">Conference <select id="f-conf">${confs.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label class="field">Color <input type="color" id="f-color" value="#DC4405"></label><label class="field">Alt color <input type="color" id="f-alt" value="#000000"></label></div>
      <div class="row">${['off', 'pit', 'def'].map(k => `<label class="field" style="width:90px">${k.toUpperCase()} <input type="number" min="40" max="99" id="f-${k}" value="65"></label>`).join('')}</div>
      ${canRebuild ? '<label class="check"><input type="checkbox" id="f-rebuild" checked> Rebuild this season\'s schedule to include the new team</label>' : '<p class="small muted">Games have been played this season, so the new team starts with an empty schedule. Add its games on the Schedule page; it gets a full schedule next season.</p>'}
    </div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="f-save">Add team</button></div>`;
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => ctx.render();
  $('#f-save', modal).onclick = () => {
    const v = id => $(id, modal).value.trim();
    try {
      addTeam(ctx.league, s, { school: v('#f-school'), mascot: v('#f-mascot'), abbr: v('#f-abbr').toUpperCase() || undefined, conference: v('#f-conf'), color: v('#f-color'), altColor: v('#f-alt'), off: rate(v('#f-off')), pit: rate(v('#f-pit')), def: rate(v('#f-def')) });
      if ($('#f-rebuild', modal)?.checked) rebuildSchedule(s);
    } catch (e) { return toast(e.message, true); }
    modal.close(); changed({ progress: false }); toast('Team added.');
  };
  modal.showModal();
}

// ---------- Team profile ----------

function pitcherStats(s, school) {
  const out = {};
  const t = s.teams[school];
  for (const name of t?.staff || []) out[name] = { w: 0, l: 0, sv: 0, outs: 0, h: 0, r: 0, bb: 0, k: 0, app: 0 };
  for (const g of s.games) {
    if (!isFinal(g) || (g.home !== school && g.away !== school)) continue;
    const side = g.home === school ? 'home' : 'away';
    const won = winnerOf(g) === school;
    const ensure = n => (out[n] ||= { w: 0, l: 0, sv: 0, outs: 0, h: 0, r: 0, bb: 0, k: 0, app: 0, former: true });
    for (const p of g.pitching?.[side] || []) { const x = ensure(p.name); x.outs += p.outs; x.h += p.h; x.r += p.r; x.bb += p.bb; x.k += p.k; x.app++; }
    if (won && g.wp) ensure(g.wp).w++;
    if (!won && g.lp) ensure(g.lp).l++;
    if (won && g.sv) ensure(g.sv).sv++;
  }
  return out;
}

function seasonSummary(season, name) {
  const recs = records(season), reg = records(season, g => g.type === 'regular');
  if (!recs[name]) return null;
  const st = confStandings(season, season.teams[name].conference, reg);
  const pos = st.findIndex(x => x.team === name) + 1;
  const fp = season.polls?.final ? pollRankMap(season.polls.final)[name] : null;
  return { rec: recs[name], pos, confSize: st.length, tChamp: season.post?.confT?.[season.teams[name].conference]?.champion === name, regChamp: regSeasonChamp(season, season.teams[name].conference, reg, rpi(season, g => g.type === 'regular')) === name && (reg[name].cw + reg[name].cl > 0), finish: postseasonFinish(season, name), finalRank: fp };
}

export function renderTeamPage(name) {
  const s = S(), t = s.teams[name] || teamInfo(name);
  if (!t) { app.innerHTML = `<div class="empty">No team called ${esc(name)}. <a href="#/teams">All teams</a></div>`; return; }
  const inSeason = !!s.teams[name];
  const recs = cache.recs(), r = rpi(s), pr = cache.ranks();
  const rec = recs[name] || { w: 0, l: 0, cw: 0, cl: 0, rs: 0, ra: 0, streak: '', hw: 0, hl: 0, aw: 0, al: 0 };
  const games = s.games.filter(g => g.home === name || g.away === name).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id);
  const ps = pitcherStats(s, name);
  const ip = o => `${Math.floor(o / 3)}.${o % 3}`;
  const pollRow = Object.entries(s.polls || {}).sort((a, b) => (a[0] === 'final' ? 99 : +a[0]) - (b[0] === 'final' ? 99 : +b[0]))
    .map(([w, p]) => [w, pollRankMap(p)[name]]);
  const history = Object.keys(ctx.league.seasons).map(Number).sort((a, b) => b - a).map(y => [y, ctx.league.seasons[y]]).filter(([, se]) => se.teams[name]).map(([y, se]) => [y, seasonSummary(se, name)]);
  const confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  app.innerHTML = `
    <div class="team-hero" style="--tc:${esc(t.color)};--ta:${esc(t.altColor)};color:${esc(readableOn(t.color, null))}">
      <div class="team-hero-logo">${logoImg(t, 64)}</div>
      <div style="flex:1;min-width:200px">
        <div class="team-hero-name">${pr[name] ? `<span class="team-hero-rank">#${pr[name]}</span> ` : ''}${esc(name)}</div>
        <div class="team-hero-sub">${esc(t.mascot || '')} · <a href="${confHref(t.conference)}" style="color:inherit">${esc(t.conference)}</a> · ${rec.w}-${rec.l} (${rec.cw}-${rec.cl} conf) · OVR ${ovr(t)}</div>
      </div>
      <a class="btn" href="#/teams">All teams</a>
    </div>
    ${inSeason ? '' : `<div class="hint" style="margin-bottom:14px">${esc(name)} isn't in the ${s.year} season. Showing its dynasty record.</div>`}
    <div class="grid">
      <div class="card"><h2>Ratings</h2>
        ${ratingBar('OFF', t.off, t.color)}${ratingBar('PIT', t.pit, t.color)}${ratingBar('DEF', t.def, t.color)}${ratingBar('OVR', ovr(t), t.altColor && readableOn('#ffffff', t.altColor) !== '#ffffff' ? t.altColor : t.color)}
        ${inSeason ? `<div class="row" style="margin-top:10px">${['off', 'pit', 'def'].map(k => `<label class="field" style="width:80px">${k.toUpperCase()} <input type="number" min="40" max="99" data-r="${k}" value="${t[k]}"></label>`).join('')}</div>` : ''}
      </div>
      <div class="card"><h2>${s.year} season</h2>
        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><div class="v">${rec.w}-${rec.l}</div><div class="l">Overall</div></div>
          <div class="kpi"><div class="v">${rec.cw}-${rec.cl}</div><div class="l">Conference</div></div>
          <div class="kpi"><div class="v">${r[name]?.rank ?? '—'}</div><div class="l">RPI rank</div></div>
          <div class="kpi"><div class="v">${rec.rs}-${rec.ra}</div><div class="l">Runs for-against</div></div>
          <div class="kpi"><div class="v">${rec.hw}-${rec.hl} / ${rec.aw}-${rec.al}</div><div class="l">Home / away</div></div>
          <div class="kpi"><div class="v">${rec.streak || '—'}</div><div class="l">Streak</div></div>
        </div>
        ${postseasonFinish(s, name) ? `<p><span class="badge gold">${esc(postseasonFinish(s, name))}</span></p>` : ''}
        ${pollRow.length ? `<div class="small muted">Poll: ${pollRow.map(([w, k]) => `<span title="${w === 'final' ? 'Final' : w === '0' ? 'Preseason' : 'Week ' + w}">${w === 'final' ? 'F' : w === '0' ? 'P' : w}:<b>${k ?? '–'}</b></span>`).join(' ')}</div>` : ''}
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Schedule & results</h2><div class="table-wrap"><table><thead><tr><th>Wk</th><th>Day</th><th>Opponent</th><th>Result</th><th class="small">Decision</th></tr></thead><tbody>
        ${games.map(g => {
          const home = g.home === name, opp = home ? g.away : g.home;
          const fin = isFinal(g), won = fin && winnerOf(g) === name;
          const inn = Math.max(g.homeLine.length, g.awayLine.length);
          const res = fin ? `<b class="${won ? 'good' : 'bad'}">${won ? 'W' : 'L'}</b> ${home ? g.homeR : g.awayR}-${home ? g.awayR : g.homeR}${inn !== 7 ? ` <span class="muted small">(${inn})</span>` : ''}` : '<span class="muted">—</span>';
          const dec = fin ? (won ? `W: ${esc(g.wp || '')}` : `L: ${esc(g.lp || '')}`) : '';
          return `<tr class="clickable" data-g="${g.id}"><td class="small">${g.week > 14 ? esc(weekName(g.week).replace('Conf. Tournaments', 'Conf T')) : g.week}</td><td class="small">${esc(g.day)}</td>
            <td>${g.neutral ? 'vs' : home ? '' : '@'} ${team(opp)}${g.label ? ` <span class="muted small">${esc(g.label.split(' · ')[0])}</span>` : g.confGame ? ' <span class="muted small">*</span>' : ''}</td><td>${res}</td><td class="small muted">${dec}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="muted">No games.</td></tr>'}</tbody></table></div><p class="small muted">* conference game</p></div>
    <div class="grid" style="margin-top:16px">
      <div class="card"><h2>Pitching staff</h2><div class="table-wrap"><table><thead><tr><th>Pitcher</th><th class="num">W-L</th><th class="num">SV</th><th class="num">IP</th><th class="num">H</th><th class="num">R</th><th class="num">BB</th><th class="num">K</th><th class="num">RA/7</th></tr></thead><tbody>
        ${Object.entries(ps).map(([n, x]) => { const i = t.staff?.indexOf(n) ?? -1; return `<tr><td>${inSeason && i >= 0 ? `<input type="text" class="pin" data-p="${i}" value="${esc(n)}"><div class="small muted">${ROLES[i]}</div>` : `${esc(n)} <span class="muted small">${x.former ? '(no longer on staff)' : ''}</span>`}</td>
          <td class="num">${x.w}-${x.l}</td><td class="num">${x.sv}</td><td class="num">${ip(x.outs)}</td><td class="num">${x.h}</td><td class="num">${x.r}</td><td class="num">${x.bb}</td><td class="num">${x.k}</td><td class="num">${x.outs ? ((x.r * 21) / x.outs).toFixed(2) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="small muted">Pitching lines come from simulated games. Results you type in count toward W-L and saves only.</p></div>
    <div class="card"><h2>Dynasty record</h2><div class="table-wrap"><table><thead><tr><th>Season</th><th class="num">Record</th><th class="num">Conf</th><th>Conference</th><th>Postseason</th><th class="num">Final rank</th></tr></thead><tbody>
      ${history.map(([y, h]) => `<tr><td>${y}</td><td class="num">${h.rec.w}-${h.rec.l}</td><td class="num">${h.rec.cw}-${h.rec.cl}</td><td>${h.pos ? `${h.pos} of ${h.confSize}` : ''}${h.regChamp ? ' 👑' : ''}${h.tChamp ? ' <span class="badge gold">Tournament champ</span>' : ''}</td><td>${h.finish ? esc(h.finish) : '<span class="muted">—</span>'}</td><td class="num">${h.finalRank ?? '<span class="muted">NR</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    ${inSeason ? `<div class="card" style="margin-top:16px"><h2>Commissioner edits</h2>
      <div class="row"><label class="field" style="flex:2;min-width:160px">School <input type="text" id="e-school" value="${esc(name)}"></label>
        <label class="field" style="flex:1;min-width:120px">Mascot <input type="text" id="e-mascot" value="${esc(t.mascot || '')}"></label>
        <label class="field" style="width:90px">Abbr. <input type="text" id="e-abbr" maxlength="5" value="${esc(t.abbr || '')}"></label>
        <label class="field" style="flex:1;min-width:140px">Conference <select id="e-conf">${confs.map(c => `<option ${c === t.conference ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="field">Color <input type="color" id="e-color" value="${esc(t.color)}"></label><label class="field">Alt color <input type="color" id="e-alt" value="${esc(t.altColor)}"></label></div>
      <div class="row" style="margin-top:10px"><label class="field" style="flex:1;min-width:220px">Logo image link <input type="text" id="e-logo" placeholder="https://…" value="${esc(t.logoOverride && !t.logoOverride.startsWith('data:') ? t.logoOverride : '')}"></label>
        <label class="btn" style="align-self:flex-end">Upload logo <input type="file" id="e-file" accept="image/*" hidden></label>
        ${t.logoOverride ? '<button class="btn" id="e-clearlogo" style="align-self:flex-end">Use default logo</button>' : ''}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="e-save">Save changes</button><span class="spacer"></span><button class="btn danger" id="e-remove">Remove from ${s.year}</button></div>
    </div>` : ''}`;

  $$('[data-g]').forEach(rw => (rw.onclick = e => { if (!e.target.closest('a')) openGame(Number(rw.dataset.g)); }));
  if (!inSeason) return;
  $$('[data-r]').forEach(inp => (inp.onchange = () => { t[inp.dataset.r] = rate(inp.value); changed({ progress: false }); }));
  $$('[data-p]').forEach(inp => (inp.onchange = () => { const v = inp.value.trim(); if (v) { t.staff[+inp.dataset.p] = v; changed({ progress: false }); } }));
  const applyLogo = url => { for (const se of Object.values(ctx.league.seasons)) if (se.teams[name]) se.teams[name].logoOverride = url; };
  $('#e-file').onchange = async e => {
    try { applyLogo(await imageFileToDataUrl(e.target.files[0])); changed({ progress: false }); toast('Logo updated.'); } catch (err) { toast(err.message, true); }
  };
  if ($('#e-clearlogo')) $('#e-clearlogo').onclick = () => { applyLogo(null); changed({ progress: false }); };
  $('#e-save').onclick = () => {
    const v = id => $(id).value.trim();
    Object.assign(t, { mascot: v('#e-mascot'), abbr: v('#e-abbr').toUpperCase() || t.abbr, conference: v('#e-conf'), color: v('#e-color'), altColor: v('#e-alt') });
    if (v('#e-logo')) applyLogo(v('#e-logo'));
    const newName = v('#e-school');
    try { if (newName !== name) { renameTeam(ctx.league, s, name, newName); location.hash = teamHref(newName); } } catch (e) { return toast(e.message, true); }
    changed({ progress: false }); toast('Saved.');
  };
  $('#e-remove').onclick = () => {
    if (!confirm(`Remove ${name} from the ${s.year} season? Its unplayed games are deleted; games already played stay in the record.`)) return;
    removeTeam(s, name); location.hash = '#/teams'; changed();
  };
}

// ---------- Conferences ----------

export function renderConferences() {
  const s = S(), recs = cache.recs();
  const confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  app.innerHTML = `
    <div class="section-head"><h1>Conferences</h1><span class="spacer"></span><button class="btn primary" id="c-add">+ Add conference</button></div>
    <div class="grid">${confs.map(c => {
      const ts = Object.values(s.teams).filter(t => t.conference === c);
      const avg = ts.length ? Math.round(ts.reduce((a, t) => a + ovr(t), 0) / ts.length) : '—';
      const st = ts.length ? confStandings(s, c, records(s, g => g.type === 'regular')) : [];
      const ch = s.post?.confT?.[c]?.champion;
      return `<a class="card conf-card" href="${confHref(c)}"><div class="row">${confLogo(c, 44)}<div><h2 style="margin:0">${esc(c)}</h2><div class="muted small">${ts.length} teams · avg OVR ${avg}</div></div></div>
        <div class="small" style="margin-top:10px">${st[0] && st[0].cw + st[0].cl ? `Leader: <b>${esc(st[0].team)}</b> ${st[0].cw}-${st[0].cl}` : 'No conference games yet'}${ch ? ` · Tournament champion: <b>${esc(ch)}</b>` : ''}</div></a>`;
    }).join('')}</div>`;
  $('#c-add').onclick = () => {
    modal.innerHTML = `<div class="modal-head"><h2>Add a conference</h2><button class="btn ghost" data-x>✕</button></div>
      <div class="modal-body stack"><div class="row"><label class="field" style="flex:1">Name <input type="text" id="cf-name" placeholder="e.g. West Coast"></label>
        <label class="field" style="width:90px">Abbr. <input type="text" id="cf-abbr" maxlength="5"></label><label class="field">Color <input type="color" id="cf-color" value="#2C5F8A"></label></div>
        <p class="small muted">Move teams into it from the Teams page or a team's profile. Each conference gets an automatic NCAA bid.</p></div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="cf-save">Add conference</button></div>`;
    $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
    modal.onclose = () => ctx.render();
    $('#cf-save', modal).onclick = () => {
      try { addConference(ctx.league, $('#cf-name', modal).value, { abbr: $('#cf-abbr', modal).value.trim().toUpperCase() || undefined, color: $('#cf-color', modal).value }); }
      catch (e) { return toast(e.message, true); }
      modal.close(); changed({ progress: false }); toast('Conference added.');
    };
    modal.showModal();
  };
}

export function renderConferencePage(c) {
  const s = S(), info = ctx.league.conferences[c];
  if (!info) { app.innerHTML = `<div class="empty">No conference called ${esc(c)}. <a href="#/conferences">All conferences</a></div>`; return; }
  const recs = cache.recs(), reg = records(s, g => g.type === 'regular');
  const st = confStandings(s, c, reg);
  const years = Object.keys(ctx.league.seasons).map(Number).sort((a, b) => b - a);
  const hist = years.map(y => {
    const se = ctx.league.seasons[y];
    if (!Object.values(se.teams).some(t => t.conference === c)) return null;
    const rg = records(se, g => g.type === 'regular');
    const bids = (se.post?.field || []).filter(f => f.conf === c);
    const best = bids.map(f => postseasonFinish(se, f.team)).filter(Boolean);
    return { y, reg: regSeasonChamp(se, c, rg, rpi(se, g => g.type === 'regular')), t: se.post?.confT?.[c]?.champion, bids: bids.length, best: best.includes('National champion') ? 'National champion' : best.includes('MCWS runner-up') ? 'MCWS runner-up' : best.find(b => /World Series/.test(b)) || best[0] || '' };
  }).filter(Boolean);
  app.innerHTML = `
    <div class="conf-hero" style="border-bottom-color:${esc(info.color)}"><div class="conf-hero-logo">${confLogo(c, 76)}</div><div style="flex:1"><div class="team-hero-name">${esc(c)}</div><div class="team-hero-sub">${st.length} teams</div></div><a class="btn" href="#/conferences">All conferences</a></div>
    <div class="grid">
      <div class="card"><h2>${s.year} standings</h2><div class="table-wrap"><table><thead><tr><th></th><th>Team</th><th class="num">Conf</th><th class="num">Overall</th><th class="num">OVR</th></tr></thead><tbody>
        ${st.map((x, i) => `<tr><td class="num muted">${i + 1}</td><td>${team(x.team)}</td><td class="num"><b>${x.cw}-${x.cl}</b></td><td class="num">${recs[x.team].w}-${recs[x.team].l}</td><td class="num">${ovr(s.teams[x.team])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h2>Champions</h2><div class="table-wrap"><table><thead><tr><th>Season</th><th>Regular season</th><th>Tournament</th><th class="num">NCAA bids</th><th>Best finish</th></tr></thead><tbody>
        ${hist.map(h => `<tr><td>${h.y}</td><td>${h.reg ? team(h.reg, { rank: false }) : '—'}</td><td>${h.t ? team(h.t, { rank: false }) : '—'}</td><td class="num">${h.bids || ''}</td><td class="small">${esc(h.best)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Commissioner edits</h2>
      <div class="row"><label class="field" style="flex:1;min-width:160px">Name <input type="text" id="ce-name" value="${esc(c)}"></label>
        <label class="field" style="width:90px">Abbr. <input type="text" id="ce-abbr" maxlength="5" value="${esc(info.abbr || '')}"></label>
        <label class="field">Color <input type="color" id="ce-color" value="${esc(info.color || '#555555')}"></label>
        <label class="field" style="flex:2;min-width:220px">Logo image link <input type="text" id="ce-logo" placeholder="https://…" value="${esc(info.logo && !info.logo.startsWith('data:') ? info.logo : '')}"></label>
        <label class="btn" style="align-self:flex-end">Upload logo <input type="file" id="ce-file" accept="image/*" hidden></label>
        ${info.logo ? '<button class="btn" id="ce-clear" style="align-self:flex-end">Remove logo</button>' : ''}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="ce-save">Save changes</button><span class="spacer"></span><button class="btn danger" id="ce-del">Delete conference</button></div></div>`;
  $('#ce-file').onchange = async e => { try { info.logo = await imageFileToDataUrl(e.target.files[0]); changed({ progress: false }); toast('Logo updated.'); } catch (err) { toast(err.message, true); } };
  if ($('#ce-clear')) $('#ce-clear').onclick = () => { delete info.logo; changed({ progress: false }); };
  $('#ce-save').onclick = () => {
    info.abbr = $('#ce-abbr').value.trim().toUpperCase() || info.abbr;
    info.color = $('#ce-color').value;
    if ($('#ce-logo').value.trim()) info.logo = $('#ce-logo').value.trim();
    const nn = $('#ce-name').value.trim();
    try { if (nn !== c) { renameConference(ctx.league, c, nn); location.hash = confHref(nn); } } catch (e) { return toast(e.message, true); }
    changed({ progress: false }); toast('Saved.');
  };
  $('#ce-del').onclick = () => {
    try { deleteConference(ctx.league, s, c); } catch (e) { return toast(e.message, true); }
    location.hash = '#/conferences'; changed({ progress: false });
  };
}

// ---------- History ----------

export function renderHistory() {
  const years = Object.keys(ctx.league.seasons).map(Number).sort((a, b) => b - a);
  app.innerHTML = `<div class="section-head"><h1>Dynasty history</h1></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Season</th><th>National champion</th><th>Runner-up</th><th>MCWS</th><th>Final top 5</th><th>Conference tournament champions</th></tr></thead><tbody>
    ${years.map(y => {
      const se = ctx.league.seasons[y], p = se.post || {};
      const top5 = se.polls?.final?.ranks.slice(0, 5).map(x => x.team) || [];
      return `<tr><td><b>${y}</b></td><td>${p.champion ? team(p.champion, { rank: false }) : '<span class="muted">In progress</span>'}</td><td>${p.runnerUp ? esc(p.runnerUp) : ''}</td>
        <td class="small">${(p.mcws?.seeds || []).map(esc).join(', ')}</td><td class="small">${top5.map((t, i) => `${i + 1}. ${esc(t)}`).join('<br>')}</td>
        <td class="small">${Object.values(p.confT || {}).map(ev => `${esc(ev.conf)}: ${esc(ev.champion || '—')}`).join('<br>')}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

// ---------- Settings ----------

export function renderSettings() {
  const L = ctx.league, s = S(), st = s.settings;
  const isCurrent = L.viewYear === L.currentYear;
  const canRebuild = !s.games.some(g => g.type === 'regular' && isFinal(g));
  app.innerHTML = `<div class="section-head"><h1>Settings</h1></div>
    <div class="grid">
      <div class="card stack"><h2>League</h2>
        <label class="field">League name <input type="text" id="s-name" value="${esc(L.name)}"></label>
        <label class="field">${s.year} championship name <input type="text" id="s-mcws" value="${esc(st.mcwsName)}"></label>
        <label class="field">Ratings between seasons <select id="s-dev">${Object.entries({ none: 'Stay the same', small: 'Small changes', normal: 'Normal changes', big: 'Big changes' }).map(([k, l]) => `<option value="${k}" ${st.development === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <p class="small muted">Each new season moves every rating a little toward 70 with some random growth, and about a third of pitchers graduate and are replaced. You can edit any rating afterward.</p>
      </div>
      <div class="card stack"><h2>Simulation (${s.year})</h2>
        <label class="field">Upsets in simulated games <select id="s-vol">${[[0.8, 'Fewer'], [1, 'Realistic'], [1.3, 'More'], [1.8, 'Chaos']].map(([v, l]) => `<option value="${v}" ${Number(st.volatility) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="s-rr" ${st.runRule ? 'checked' : ''}> 8-run rule after 5 innings</label>
        <label class="check"><input type="checkbox" id="s-tb" ${st.tiebreaker ? 'checked' : ''}> Extra innings start with a runner on second (8th inning on)</label>
      </div>
      <div class="card stack"><h2>Season</h2>
        ${isCurrent ? `<button class="btn" id="s-next" ${s.phase === 'complete' ? '' : 'disabled'}>Start the ${s.year + 1} season</button>
          <p class="small muted">${s.phase === 'complete' ? 'Teams, conferences and settings carry over. The final poll seeds the new preseason poll.' : 'Available once the national champion is crowned.'}</p>` : `<p class="muted">You're viewing a past season. Switch to ${L.currentYear} at the top to start a new one.</p>`}
        <button class="btn" id="s-rebuild" ${canRebuild ? '' : 'disabled'}>Rebuild ${s.year} schedule</button>
        <p class="small muted">${canRebuild ? 'Makes a new regular-season schedule from the current teams and conferences.' : 'Locked: regular-season games have been played.'}</p>
      </div>
      <div class="card stack"><h2>Backups</h2>
        <p class="small muted">The dynasty is saved in this browser. Download a backup to keep a copy or move it to another device.</p>
        <div class="row"><button class="btn" id="s-export">Download backup</button><label class="btn">Restore backup <input type="file" id="s-import" accept="application/json,.json" hidden></label></div>
        <button class="btn danger" id="s-reset">Start over with a new league</button>
      </div>
    </div>`;
  $('#s-name').onchange = e => { L.name = e.target.value.trim() || L.name; changed({ progress: false }); };
  $('#s-mcws').onchange = e => { st.mcwsName = e.target.value.trim() || "Men's College World Series"; changed({ progress: false }); };
  $('#s-dev').onchange = e => { st.development = e.target.value; persist(); };
  $('#s-vol').onchange = e => { st.volatility = Number(e.target.value); persist(); };
  $('#s-rr').onchange = e => { st.runRule = e.target.checked; persist(); };
  $('#s-tb').onchange = e => { st.tiebreaker = e.target.checked; persist(); };
  if ($('#s-next')) $('#s-next').onclick = () => {
    const ns = startNextSeason(L); L.viewYear = ns.year; location.hash = '#/home'; changed({ progress: false }); toast(`Welcome to ${ns.year}.`);
  };
  $('#s-rebuild').onclick = () => {
    if (!confirm(`Replace the ${s.year} regular-season schedule with a new one?`)) return;
    try { rebuildSchedule(s); } catch (e) { return toast(e.message, true); }
    changed(); toast('New schedule built.');
  };
  $('#s-export').onclick = () => exportLeague(L);
  $('#s-import').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data.seasons || !data.conferences) throw new Error('That file is not an MCS dynasty backup.');
      if (!confirm('Replace the current dynasty with this backup?')) return;
      data.viewYear = data.currentYear;
      ctx.league = data; await flushSave(); location.hash = '#/home'; ctx.render(); toast('Backup restored.');
    } catch (err) { toast(err.message, true); }
  };
  $('#s-reset').onclick = async () => {
    if (!confirm('Delete this dynasty and start over from 2016? Download a backup first if you want to keep it.')) return;
    await clearLeague();
    ctx.league = newLeague(); ctx.league.viewYear = ctx.league.currentYear;
    await flushSave(); location.hash = '#/home'; ctx.render(); toast('New league created.');
  };
}
