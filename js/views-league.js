// League pages: teams, team profiles, conferences, history, settings.

import { ctx, S, app, modal, $, $$, esc, toast, changed, persist, flushSave, cache, team, teamInfo, logoImg, teamOptions, teamHref, confLogo, confHref, confInfo, confColor, imageFileToDataUrl, readableOn, openGame, resultText } from './ui.js?v=20261006142335';
import { isFinal, winnerOf, records, rpi, confStandings, regSeasonChamp, regSeasonChamps } from './standings.js?v=20261006142335';
import { ovr } from './sim.js?v=20261006142335';
import { latestPoll, pollRankMap, pollSizeOf, POLL_SIZES, DEFAULT_POLL_SIZE } from './polls.js?v=20261006142335';
import { addTeam, removeTeam, renameTeam, addConference, renameConference, deleteConference, rebuildSchedule, startNextSeason, weekName, newLeague, beginOffseason, draftRemoveTeam, draftRestoreTeam, draftWarnings, coachName, coachSchool, hireCoach, newCoach, availableCoaches, backfillHitsErrors } from './league.js?v=20261006142335';
import { setRating } from './ratings.js?v=20261006142335';
import { postseasonFinish, wsTeams, postWeeks, regWeeksOf, ncaaConfig, ncaaProblems, fieldSize, hasSupers, formatSummary, proposeField, DEFAULT_NCAA } from './postseason.js?v=20261006142335';
import { MIDWEEK, DEFAULT_REG_WEEKS } from './schedule.js?v=20261006142335';
import { exportLeague, clearLeague } from './store.js?v=20261006142335';
import { clamp } from './util.js?v=20261006142335';

const ui = { confFilter: '', ncaaDraft: null };
const rate = v => clamp(Math.round(Number(v) || 0), 40, 99);

function ratingBar(label, v, color, pre = null) {
  const pct = ((v - 40) / 59) * 100;
  const d = pre == null ? 0 : v - pre;
  return `<div class="rbar"><span class="rl">${label}</span><div class="rtrack"><div style="width:${pct}%;background:${esc(color)}"></div>${pre != null && d ? `<i class="rpre" style="left:${((pre - 40) / 59) * 100}%" title="Preseason ${pre}"></i>` : ''}</div><span class="rv">${v}</span><span class="rd ${d > 0 ? 'good' : d < 0 ? 'bad' : 'muted'}">${pre == null ? '' : d ? (d > 0 ? '+' : '') + d : '—'}</span></div>`;
}
const ovrOf = r => Math.round(r.off * 0.4 + r.pit * 0.4 + r.def * 0.2);

// ---------- Coaches (shared pieces) ----------

// Dropdown for a team's head coach. Choosing a coach who leads another
// program hires him away and leaves that job open.
function coachSelect(teams, school, attr) {
  const L = ctx.league, cur = teams[school]?.coachId;
  const avail = availableCoaches(L, teams);
  const others = Object.values(teams).filter(t => t.school !== school && t.coachId).sort((a, b) => coachName(L, a.coachId).localeCompare(coachName(L, b.coachId)));
  return `<select class="coach-sel ${cur ? '' : 'vacant'}" ${attr}="${esc(school)}" aria-label="${esc(school)} head coach">
    ${cur ? `<option value="${cur}" selected>${esc(coachName(L, cur))}</option>` : ''}
    <option value="" ${cur ? '' : 'selected'}>— Vacant —</option>
    ${avail.length ? `<optgroup label="Available">${avail.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>` : ''}
    ${others.length ? `<optgroup label="Hire from another program">${others.map(t => `<option value="${t.coachId}">${esc(coachName(L, t.coachId))} (${esc(t.school)})</option>`).join('')}</optgroup>` : ''}
    <option value="__new">+ New coach…</option></select>`;
}

function askCoachName(title, value = '') {
  return new Promise(resolve => {
    modal.innerHTML = `<div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost" data-x>✕</button></div>
      <div class="modal-body stack"><label class="field">Coach's name <input type="text" id="cn-name" value="${esc(value)}" autocomplete="off"></label></div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="cn-save">Save</button></div>`;
    let result = null;
    $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
    modal.onclose = () => resolve(result);
    const save = () => { const v = $('#cn-name', modal).value.trim(); if (!v) return toast("Type the coach's name.", true); result = v; modal.close(); };
    $('#cn-save', modal).onclick = save;
    $('#cn-name', modal).onkeydown = e => { if (e.key === 'Enter') save(); };
    modal.showModal();
    $('#cn-name', modal).focus();
  });
}

function bindCoachSelects(teams, attr) {
  $$(`[${attr}]`).forEach(sel => (sel.onchange = async () => {
    const school = sel.getAttribute(attr), L = ctx.league;
    let id = sel.value;
    if (id === '__new') {
      const name = await askCoachName(`New head coach for ${school}`);
      if (!name) return ctx.render();
      id = newCoach(L, name);
    }
    const from = hireCoach(teams, school, id || null);
    changed({ progress: false });
    toast(from ? `${coachName(L, id)} leaves ${from} for ${school}. ${from} needs a new coach.` : id ? `${coachName(L, id)} is ${school}'s head coach.` : `${school}'s head coach job is open.`);
  }));
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
      <thead><tr><th>Team</th><th>Head coach</th><th>Conference</th><th class="num">OFF</th><th class="num">PIT</th><th class="num">DEF</th><th class="num">OVR</th><th class="num">Record</th><th class="num">Poll</th></tr></thead>
      <tbody>${list.map(t => `<tr><td>${team(t.school, { rank: false })}</td>
        <td>${coachSelect(s.teams, t.school, 'data-coach')}</td>
        <td><select data-conf="${esc(t.school)}">${confs.map(c => `<option ${c === t.conference ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
        ${['off', 'pit', 'def'].map(k => `<td class="num"><input type="number" min="40" max="99" class="rin" data-rate="${k}" data-team="${esc(t.school)}" value="${t[k]}"></td>`).join('')}
        <td class="num"><b data-ovr="${esc(t.school)}">${ovr(t)}</b>${t.base && ovr(t) !== ovrOf(t.base) ? ` <span class="rd ${ovr(t) > ovrOf(t.base) ? 'good' : 'bad'}" title="Since preseason">${ovr(t) > ovrOf(t.base) ? '▲' : '▼'}${Math.abs(ovr(t) - ovrOf(t.base))}</span>` : ''}</td><td class="num">${recs[t.school].w}-${recs[t.school].l}</td><td class="num muted">${pr[t.school] ?? ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Ratings run 40–99. OVR = 40% OFF (hitting) + 40% PIT (pitching) + 20% DEF (fielding). Ratings also move during the season with results (▲▼ shows the change since preseason); Settings controls how much. Changes you make apply to games simulated from now on. Moving a team to another conference doesn't change games already scheduled; rebuild the schedule in Settings before the season starts, or edit games on the Schedule page.</p></div>`;
  $$('[data-cf]').forEach(b => (b.onclick = () => { ui.confFilter = b.dataset.cf; renderTeams(); }));
  $$('[data-rate]').forEach(inp => (inp.onchange = () => {
    const t = s.teams[inp.dataset.team];
    setRating(t, inp.dataset.rate, rate(inp.value)); inp.value = t[inp.dataset.rate];
    $(`[data-ovr="${CSS.escape(t.school)}"]`).textContent = ovr(t);
    persist();
  }));
  $$('[data-conf]').forEach(sel => (sel.onchange = () => { s.teams[sel.dataset.conf].conference = sel.value; changed({ progress: false }); }));
  bindCoachSelects(s.teams, 'data-coach');
  $('#t-add').onclick = () => teamForm(s.teams, {
    note: !s.games.some(g => g.type === 'regular' && isFinal(g)) ? 'rebuild' : 'played',
    after: f => { if (f.rebuild) rebuildSchedule(s, ctx.league.seasons[s.year - 1] || null); },
  });
}

// Add-team form. `teams` is where the team goes: the current season's teams
// or next season's (offseason).
function teamForm(teams, { note = null, after = () => {}, conference = null } = {}) {
  const confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  modal.innerHTML = `<div class="modal-head"><h2>Add a team</h2><button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack">
      <div class="row"><label class="field" style="flex:2;min-width:160px">School <input type="text" id="f-school" placeholder="e.g. Oregon State"></label>
        <label class="field" style="flex:1;min-width:110px">Mascot <input type="text" id="f-mascot" placeholder="Beavers"></label>
        <label class="field" style="width:90px">Abbr. <input type="text" id="f-abbr" maxlength="5" placeholder="ORST"></label></div>
      <div class="row"><label class="field" style="flex:1;min-width:160px">Head coach <select id="f-coachsel"><option value="__new">New coach (type the name)</option>${availableCoaches(ctx.league, teams).map(c => `<option value="${c.id}">${esc(c.name)} (available)</option>`).join('')}</select></label>
        <label class="field" style="flex:1;min-width:160px" id="f-coachname-wrap">New coach's name <input type="text" id="f-coach" placeholder="Coach's name"></label></div>
      <div class="row">
        <label class="field" style="flex:1;min-width:160px">Conference <select id="f-conf">${confs.map(c => `<option ${c === conference ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
      <div class="row"><label class="field">Color <input type="color" id="f-color" value="#DC4405"></label><label class="field">Alt color <input type="color" id="f-alt" value="#000000"></label>
        ${['off', 'pit', 'def'].map(k => `<label class="field" style="width:80px">${k.toUpperCase()} <input type="number" min="40" max="99" id="f-${k}" value="65"></label>`).join('')}</div>
      ${note === 'rebuild' ? '<label class="check"><input type="checkbox" id="f-rebuild" checked> Rebuild this season\'s schedule to include the new team</label>'
        : note === 'played' ? '<p class="small muted">Games have been played this season, so the new team starts with an empty schedule. Add its games on the Schedule page, or add teams in the offseason so they get a full schedule.</p>' : ''}
    </div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="f-save">Add team</button></div>`;
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => ctx.render();
  $('#f-coachsel', modal).onchange = e => { $('#f-coachname-wrap', modal).style.display = e.target.value === '__new' ? '' : 'none'; };
  $('#f-save', modal).onclick = () => {
    const v = id => $(id, modal).value.trim();
    try {
      const pick = v('#f-coachsel');
      addTeam(ctx.league, teams, { school: v('#f-school'), mascot: v('#f-mascot'), coachId: pick === '__new' ? null : pick, coachName: pick === '__new' ? v('#f-coach') : '', abbr: v('#f-abbr').toUpperCase() || undefined, conference: v('#f-conf'), color: v('#f-color'), altColor: v('#f-alt'), off: rate(v('#f-off')), pit: rate(v('#f-pit')), def: rate(v('#f-def')) });
      after({ rebuild: !!$('#f-rebuild', modal)?.checked });
    } catch (e) { return toast(e.message, true); }
    modal.close(); changed({ progress: false }); toast('Team added.');
  };
  modal.showModal();
}

function conferenceForm(after = () => {}) {
  modal.innerHTML = `<div class="modal-head"><h2>Add a conference</h2><button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack"><div class="row"><label class="field" style="flex:1;min-width:160px">Name <input type="text" id="cf-name" placeholder="e.g. West Coast"></label>
      <label class="field" style="width:90px">Abbr. <input type="text" id="cf-abbr" maxlength="5"></label><label class="field">Color <input type="color" id="cf-color" value="#2C5F8A"></label></div>
      <p class="small muted">Then move teams into it. Each conference gets an automatic NCAA bid.</p></div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="cf-save">Add conference</button></div>`;
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => ctx.render();
  $('#cf-save', modal).onclick = () => {
    try { addConference(ctx.league, $('#cf-name', modal).value, { abbr: $('#cf-abbr', modal).value.trim().toUpperCase() || undefined, color: $('#cf-color', modal).value }); }
    catch (e) { return toast(e.message, true); }
    after(); modal.close(); changed({ progress: false }); toast('Conference added.');
  };
  modal.showModal();
}

// ---------- Offseason ----------

export function renderOffseason() {
  const L = ctx.league, cur = L.seasons[L.currentYear];
  if (cur.phase !== 'complete') {
    app.innerHTML = `<div class="section-head"><h1>Offseason</h1></div><div class="empty">The offseason opens once the ${cur.year} national champion is crowned. Then you can add teams and conferences and realign before the ${cur.year + 1} season.</div>`;
    return;
  }
  const d = beginOffseason(L);
  persist();
  const prev = cur.teams;
  const confs = Object.keys(L.conferences).filter(c => !L.conferences[c].retired);
  const teams = Object.values(d.teams);
  const warnings = draftWarnings(L);
  const delta = (t, k) => { const p = prev[t.school]; const x = p ? t[k] - p[k] : 0; return `<span class="delta ${x > 0 ? 'good' : x < 0 ? 'bad' : ''}">${x ? (x > 0 ? '+' : '') + x : ''}</span>`; };
  const moved = t => prev[t.school] && prev[t.school].conference !== t.conference;
  const card = c => {
    const list = teams.filter(t => t.conference === c).sort((a, b) => a.school.localeCompare(b.school));
    return `<div class="card off-conf"><div class="row" style="margin-bottom:8px">${confLogo(c, 28)}<h2 style="margin:0">${esc(c)}</h2><span class="muted small">${list.length} team${list.length === 1 ? '' : 's'}</span><span class="spacer"></span><button class="btn sm" data-addto="${esc(c)}">+ Team</button></div>
      ${list.length ? `<div class="table-wrap"><table class="off-table"><thead><tr><th>Team</th><th>Head coach</th><th class="num">OFF</th><th class="num">PIT</th><th class="num">DEF</th><th class="num">OVR</th><th>Conference</th><th></th></tr></thead><tbody>
        ${list.map(t => `<tr><td><span class="team">${logoImg(t, 18)}${prev[t.school] ? `<a class="team-link" href="${teamHref(t.school)}">${esc(t.school)}</a>` : esc(t.school)}</span>${!prev[t.school] ? ' <span class="badge real">New</span>' : moved(t) ? ` <span class="badge manual" title="From ${esc(prev[t.school].conference)}">Moved</span>` : ''}</td>
          <td>${coachSelect(d.teams, t.school, 'data-dcoach')}</td>
          ${['off', 'pit', 'def'].map(k => `<td class="num"><span class="rin-wrap"><input type="number" min="40" max="99" class="rin" data-drate="${k}" data-team="${esc(t.school)}" value="${t[k]}">${delta(t, k)}</span></td>`).join('')}
          <td class="num"><b>${ovr(t)}</b></td>
          <td><select data-dconf="${esc(t.school)}" aria-label="Move ${esc(t.school)}">${confs.map(x => `<option ${x === c ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></td>
          <td><button class="btn sm danger" data-drm="${esc(t.school)}" title="Leave the dynasty">✕</button></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted small">No teams yet. Move teams in with the Conference menus, or add a new one.</p>'}
      ${!list.length ? `<button class="btn sm danger" data-delconf="${esc(c)}">Delete conference</button>` : ''}</div>`;
  };
  const removed = Object.keys(d.removed || {});
  app.innerHTML = `
    <div class="section-head"><h1>${d.year} Offseason</h1><span class="muted">${teams.length} teams in ${new Set(teams.map(t => t.conference)).size} conferences</span><span class="spacer"></span>
      <button class="btn" id="o-conf">+ Add conference</button><button class="btn" id="o-team">+ Add team</button><button class="btn primary" id="o-start">Start the ${d.year} season</button></div>
    <div class="hint">Set up the ${d.year} season. Ratings have already changed for the new year (shown as +/−). Move teams with the <b>Conference</b> menus, add new teams or conferences, and make coaching changes (hiring another program's coach opens that job). Nothing is scheduled until you start the season, so every team gets a full schedule.</div>
    ${warnings.length ? `<div class="hint warn" style="margin-top:10px">${warnings.map(esc).join('<br>')}</div>` : ''}
    ${removed.length ? `<div class="card" style="margin-top:14px"><b>Leaving the dynasty:</b> ${removed.map(t => `<span class="chip-static">${esc(t)} <button class="btn sm" data-restore="${esc(t)}">Bring back</button></span>`).join(' ')}</div>` : ''}
    <div class="off-grid" style="margin-top:14px">${confs.map(card).join('')}</div>`;
  const T = d.teams;
  bindCoachSelects(T, 'data-dcoach');
  $$('[data-drate]').forEach(inp => (inp.onchange = () => { const t = T[inp.dataset.team], k = inp.dataset.drate; t[k] = rate(inp.value); t.base = { ...(t.base || {}), [k]: t[k] }; changed({ progress: false }); }));
  $$('[data-dconf]').forEach(sel => (sel.onchange = () => { T[sel.dataset.dconf].conference = sel.value; changed({ progress: false }); toast(`${sel.dataset.dconf} moves to the ${sel.value}.`); }));
  $$('[data-drm]').forEach(b => (b.onclick = () => { if (confirm(`Remove ${b.dataset.drm} from the dynasty starting in ${d.year}? Its history stays.`)) { draftRemoveTeam(L, b.dataset.drm); changed({ progress: false }); } }));
  $$('[data-restore]').forEach(b => (b.onclick = () => { draftRestoreTeam(L, b.dataset.restore); changed({ progress: false }); }));
  $$('[data-addto]').forEach(b => (b.onclick = () => teamForm(T, { conference: b.dataset.addto })));
  $$('[data-delconf]').forEach(b => (b.onclick = () => { try { deleteConference(L, { teams: T }, b.dataset.delconf); changed({ progress: false }); } catch (e) { toast(e.message, true); } }));
  $('#o-team').onclick = () => teamForm(T);
  $('#o-conf').onclick = () => conferenceForm();
  $('#o-start').onclick = () => {
    if (!confirm(`Start the ${d.year} season with ${Object.keys(T).length} teams? The schedule is built from this alignment.`)) return;
    try { const ns = startNextSeason(L); L.viewYear = ns.year; } catch (e) { return toast(e.message, true); }
    location.hash = '#/home'; changed({ progress: false }); toast(`Welcome to ${d.year}.`);
  };
}

// ---------- Team profile ----------

// Line chart of a team's poll rank by week (1 at the top; unranked weeks
// sit on the "NR" line and break the line).
function pollChart(pts, color) {
  const W = 760, H = 210, L = 36, R = 12, T = 12, B = 30;
  const n = pts.length, step = n > 1 ? (W - L - R) / (n - 1) : 0;
  const x = i => L + (n > 1 ? i * step : (W - L - R) / 2);
  const SIZE = Math.max(pollSizeOf(S()), ...pts.map(p => p.rank || 0));
  const y = rk => T + ((rk ?? SIZE + 3) - 1) / (SIZE + 2) * (H - T - B);
  const grid = [1, 5, 10, 15, 20, 25].filter(v => v <= SIZE).map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="pc-grid"/><text x="${L - 8}" y="${y(v) + 4}" class="pc-yl">${v}</text>`).join('')
    + `<line x1="${L}" x2="${W - R}" y1="${y(null)}" y2="${y(null)}" class="pc-grid pc-nr"/><text x="${L - 8}" y="${y(null) + 4}" class="pc-yl">NR</text>`;
  let path = '', open = false;
  pts.forEach((p, i) => { if (p.rank) { path += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`; open = true; } else open = false; });
  const dots = pts.map((p, i) => `<g><title>${esc(p.title)}: ${p.rank ? '#' + p.rank : 'unranked'}</title><circle cx="${x(i)}" cy="${y(p.rank)}" r="${p.rank ? 4.5 : 3}" class="${p.rank ? 'pc-dot' : 'pc-nrdot'}" style="${p.rank ? `fill:${esc(color)}` : ''}"/>${p.rank && (n <= 12 || i % 2 === 0 || i === n - 1) ? `<text x="${x(i)}" y="${y(p.rank) - 9}" class="pc-val">${p.rank}</text>` : ''}</g>`).join('');
  const xl = pts.map((p, i) => `<text x="${x(i)}" y="${H - 10}" class="pc-xl">${esc(p.label)}</text>`).join('');
  return `<div class="pc-wrap"><svg class="pollchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Poll rank by week">${grid}<path d="${path}" class="pc-line" style="stroke:${esc(color)}"/>${dots}${xl}</svg></div>
    <p class="small muted">P = preseason, CT = after conference tournaments, F = final poll.</p>`;
}

function seasonSummary(season, name) {
  const recs = records(season), reg = records(season, g => g.type === 'regular');
  if (!recs[name]) return null;
  const st = confStandings(season, season.teams[name].conference, reg);
  const pos = st.findIndex(x => x.team === name) + 1;
  const fp = season.polls?.final ? pollRankMap(season.polls.final)[name] : null;
  return { rec: recs[name], pos, confSize: st.length, tChamp: season.post?.confT?.[season.teams[name].conference]?.champion === name, ...(() => { const cs = regSeasonChamps(season, season.teams[name].conference, reg, rpi(season, g => g.type === 'regular')); return { regChamp: cs.includes(name), regShared: cs.includes(name) && cs.length > 1 }; })(), finish: postseasonFinish(season, name), finalRank: fp };
}

export function renderTeamPage(name) {
  const s = S(), t = s.teams[name] || teamInfo(name);
  if (!t) { app.innerHTML = `<div class="empty">No team called ${esc(name)}. <a href="#/teams">All teams</a></div>`; return; }
  const inSeason = !!s.teams[name];
  const recs = cache.recs(), r = rpi(s), pr = cache.ranks();
  const rec = recs[name] || { w: 0, l: 0, cw: 0, cl: 0, rs: 0, ra: 0, streak: '', hw: 0, hl: 0, aw: 0, al: 0 };
  const games = s.games.filter(g => g.home === name || g.away === name).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id);
  const pollPts = Object.entries(s.polls || {}).sort((a, b) => (a[0] === 'final' ? 99 : +a[0]) - (b[0] === 'final' ? 99 : +b[0]))
    .map(([w, p]) => ({ label: w === 'final' ? 'F' : w === '0' ? 'P' : +w === postWeeks(s).conf ? 'CT' : w, title: w === 'final' ? 'Final poll' : w === '0' ? 'Preseason' : +w === postWeeks(s).conf ? 'After conference tournaments' : `Week ${w}`, rank: pollRankMap(p)[name] ?? null }));
  const history = Object.keys(ctx.league.seasons).map(Number).sort((a, b) => b - a).map(y => [y, ctx.league.seasons[y]]).filter(([, se]) => se.teams[name]).map(([y, se]) => [y, seasonSummary(se, name)]);
  const confs = Object.keys(ctx.league.conferences).filter(c => !ctx.league.conferences[c].retired);
  app.innerHTML = `
    <div class="team-hero" style="--tc:${esc(t.color)};--ta:${esc(t.altColor)};color:${esc(readableOn(t.color, null))}">
      <div class="team-hero-logo">${logoImg(t, 64)}</div>
      <div style="flex:1;min-width:200px">
        <div class="team-hero-name">${pr[name] ? `<span class="team-hero-rank">#${pr[name]}</span> ` : ''}${esc(name)}</div>
        <div class="team-hero-sub">${t.coachId ? `Head coach ${coachLink(t.coachId, 'color:inherit;text-decoration:underline')} · ` : 'Head coach job open · '}${esc(t.mascot || '')} · <a href="${confHref(t.conference)}" style="color:inherit">${esc(t.conference)}</a> · ${rec.w}-${rec.l} (${rec.cw}-${rec.cl} conf) · OVR ${ovr(t)}</div>
      </div>
      <a class="btn" href="#/teams">All teams</a>
    </div>
    ${inSeason ? '' : `<div class="hint" style="margin-bottom:14px">${esc(name)} isn't in the ${s.year} season. Showing its dynasty record.</div>`}
    <div class="grid">
      <div class="card"><h2>Ratings</h2>
        ${ratingBar('OFF', t.off, t.color, t.base?.off)}${ratingBar('PIT', t.pit, t.color, t.base?.pit)}${ratingBar('DEF', t.def, t.color, t.base?.def)}${ratingBar('OVR', ovr(t), t.color, t.base ? ovrOf(t.base) : null)}
        <p class="small muted" style="margin:6px 0 0">Change since the preseason, from results so far. Ratings rise with wins over better teams and fall with losses to weaker ones.</p>
        ${inSeason ? `<div class="row" style="margin-top:10px">${['off', 'pit', 'def'].map(k => `<label class="field" style="width:80px">${k.toUpperCase()} <input type="number" min="40" max="99" data-r="${k}" value="${t[k]}"></label>`).join('')}</div>` : ''}
      </div>
      <div class="card"><h2>${s.year} season</h2>
        <div class="kpis kpis-sm">
          <div class="kpi"><div class="v">${rec.w}-${rec.l}</div><div class="l">Overall</div></div>
          <div class="kpi"><div class="v">${rec.cw}-${rec.cl}</div><div class="l">Conference</div></div>
          <div class="kpi"><div class="v">${r[name]?.rank ?? '—'}</div><div class="l">RPI rank</div></div>
          <div class="kpi"><div class="v">${rec.rs}<span class="kpi-sep">–</span>${rec.ra}</div><div class="l">Runs for–against</div></div>
          <div class="kpi"><div class="v">${rec.hw}-${rec.hl}</div><div class="l">Home</div></div>
          <div class="kpi"><div class="v">${rec.aw}-${rec.al}</div><div class="l">Away</div></div>
          <div class="kpi"><div class="v">${rec.streak || '—'}</div><div class="l">Streak</div></div>
        </div>
        ${postseasonFinish(s, name) ? `<p><span class="badge gold">${esc(postseasonFinish(s, name))}</span></p>` : ''}
      </div>
    </div>
    ${pollPts.length ? `<div class="card" style="margin-top:16px"><h2>Poll history</h2>${pollChart(pollPts, t.color === '#000000' || t.color === '#FFFFFF' ? t.altColor : t.color)}</div>` : ''}
    <div class="card" style="margin-top:16px"><h2>Schedule & results</h2><div class="table-wrap"><table><thead><tr><th>Wk</th><th>Day</th><th class="num" title="${esc(name)}'s rank going into the game">Rank</th><th>Opponent</th><th>Result</th></tr></thead><tbody>
        ${games.map(g => {
          const home = g.home === name, opp = home ? g.away : g.home;
          const fin = isFinal(g), won = fin && winnerOf(g) === name;
          const inn = Math.max(g.homeLine.length, g.awayLine.length);
          const res = fin ? `<b class="${won ? 'good' : 'bad'}">${won ? 'W' : 'L'}</b> ${home ? g.homeR : g.awayR}-${home ? g.awayR : g.homeR}${inn !== 7 ? ` <span class="muted small">(${inn})</span>` : ''}` : '<span class="muted">—</span>';
          return `<tr class="clickable" data-g="${g.id}"><td class="small">${g.week > regWeeksOf(s) ? esc(weekName(g.week, s).replace('Conf. Tournaments', 'Conf T')) : g.week}</td><td class="small">${esc(g.day)}</td>
            <td class="num muted small">${fin && cache.ranksAt(g.week)[name] ? '#' + cache.ranksAt(g.week)[name] : ''}</td>
            <td>${g.neutral ? 'vs' : home ? '' : '@'} ${team(opp, { ranks: fin ? cache.ranksAt(g.week) : null })}${g.label ? ` <span class="muted small">${esc(g.label.split(' · ')[0])}</span>` : g.confGame ? ' <span class="muted small">*</span>' : ''}</td><td>${res}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="muted">No games.</td></tr>'}</tbody></table></div><p class="small muted">* conference game. Ranks on played games are from the poll in effect when the game was played.</p></div>
    <div class="card" style="margin-top:16px"><h2>Dynasty record</h2><div class="table-wrap"><table><thead><tr><th>Season</th><th>Coach</th><th class="num">Record</th><th class="num">Conf</th><th>Conference</th><th>Postseason</th><th class="num">Final rank</th></tr></thead><tbody>
      ${history.map(([y, h]) => `<tr><td>${y}</td><td>${coachLink(ctx.league.seasons[y].teams[name].coachId) || '—'}</td><td class="num">${h.rec.w}-${h.rec.l}</td><td class="num">${h.rec.cw}-${h.rec.cl}</td><td>${h.pos ? `${h.pos} of ${h.confSize}` : ''}${h.regChamp ? ` <span class="badge">Reg. season ${h.regShared ? 'co-champ' : 'champ'}</span>` : ''}${h.tChamp ? ' <span class="badge gold">Tournament champ</span>' : ''}</td><td>${h.finish ? esc(h.finish) : '<span class="muted">—</span>'}</td><td class="num">${h.finalRank ?? '<span class="muted">NR</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    ${inSeason ? `<div class="card" style="margin-top:16px"><h2>Commissioner edits</h2>
      <div class="row"><label class="field" style="flex:2;min-width:160px">School <input type="text" id="e-school" value="${esc(name)}"></label>
        <label class="field" style="flex:1;min-width:120px">Mascot <input type="text" id="e-mascot" value="${esc(t.mascot || '')}"></label>
        <label class="field" style="flex:1;min-width:180px">Head coach ${coachSelect(s.teams, name, 'data-ecoach')}</label>
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
  $$('[data-r]').forEach(inp => (inp.onchange = () => { setRating(t, inp.dataset.r, rate(inp.value)); changed(); }));
  bindCoachSelects(s.teams, 'data-ecoach');
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

// ---------- Coaches ----------

function coachCareers() {
  const L = ctx.league, out = {};
  for (const c of Object.values(L.coaches || {})) out[c.id] = { ...c, w: 0, l: 0, seasons: [], ct: 0, ncaa: 0, mcws: 0, titles: 0 };
  for (const y of Object.keys(L.seasons).map(Number).sort((a, b) => a - b)) {
    const se = L.seasons[y], recs = records(se);
    for (const t of Object.values(se.teams)) {
      const c = out[t.coachId];
      if (!c) continue;
      c.w += recs[t.school].w; c.l += recs[t.school].l;
      c.seasons.push({ y, school: t.school });
      if (se.post?.confT?.[t.conference]?.champion === t.school) c.ct++;
      if (se.post?.field?.some(f => f.team === t.school)) c.ncaa++;
      if (wsTeams(se).includes(t.school)) c.mcws++;
      if (se.post?.champion === t.school) c.titles++;
    }
  }
  return out;
}

function stints(seasons) {
  const out = [];
  for (const x of seasons) {
    const last = out[out.length - 1];
    if (last && last.school === x.school && last.to === x.y - 1) last.to = x.y; else out.push({ school: x.school, from: x.y, to: x.y });
  }
  return out.map(s => `${esc(s.school)} (${s.from === s.to ? s.from : `${s.from}–${String(s.to).slice(-2)}`})`).join(', ');
}

const fmtPctLocal = x => x.toFixed(3).replace(/^0/, '');

export const coachHref = id => `#/coach/${encodeURIComponent(id)}`;
const coachLink = (id, style = '') => id && ctx.league.coaches?.[id] ? `<a class="team-link" href="${coachHref(id)}"${style ? ` style="${style}"` : ''}>${esc(coachName(ctx.league, id))}</a>` : '';

export function renderCoachPage(id) {
  const L = ctx.league, c = L.coaches?.[id];
  if (!c) { app.innerHTML = `<div class="empty">That coach isn't in this dynasty. <a href="#/coaches">All coaches</a></div>`; return; }
  const cur = L.seasons[L.currentYear];
  const teamsNow = L.draft && cur.phase === 'complete' ? L.draft.teams : cur.teams;
  const now = coachSchool(teamsNow, id);
  const nowTeam = now ? teamsNow[now] : null;
  const rows = [];
  const tot = { w: 0, l: 0, cw: 0, cl: 0, reg: 0, ct: 0, ncaa: 0, mcws: 0, titles: 0, top: 0 };
  for (const y of Object.keys(L.seasons).map(Number).sort((a, b) => b - a)) {
    const se = L.seasons[y];
    const t = Object.values(se.teams).find(x => x.coachId === id);
    if (!t) continue;
    const h = seasonSummary(se, t.school);
    if (!h) continue;
    tot.w += h.rec.w; tot.l += h.rec.l; tot.cw += h.rec.cw; tot.cl += h.rec.cl;
    if (h.regChamp) tot.reg++; if (h.tChamp) tot.ct++;
    if (se.post?.field?.some(f => f.team === t.school)) tot.ncaa++;
    if (wsTeams(se).includes(t.school)) tot.mcws++;
    if (se.post?.champion === t.school) tot.titles++;
    if (h.finalRank) tot.top++;
    rows.push({ y, t, h, inProgress: se.phase !== 'complete' });
  }
  const pctTxt = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '—');
  const color = nowTeam?.color || '#2c3442';
  app.innerHTML = `
    <div class="team-hero" style="--tc:${esc(color)};--ta:${esc(nowTeam?.altColor || '#8892a0')};color:${esc(readableOn(color, null))}">
      <div class="team-hero-logo">${nowTeam ? logoImg(nowTeam, 64) : '<span class="coach-initials">' + esc(c.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)) + '</span>'}</div>
      <div style="flex:1;min-width:200px">
        <div class="team-hero-name">${esc(c.name)}</div>
        <div class="team-hero-sub">${now ? `Head coach, <a href="${teamHref(now)}" style="color:inherit">${esc(now)}</a>` : 'Available — not leading a program'} · ${rows.length} season${rows.length === 1 ? '' : 's'} · ${tot.w}-${tot.l} career</div>
      </div>
      <a class="btn" href="#/coaches">All coaches</a>
    </div>
    <div class="kpis kpis-sm">
      <div class="kpi"><div class="v">${tot.w}-${tot.l}</div><div class="l">Career record</div></div>
      <div class="kpi"><div class="v">${pctTxt(tot.w, tot.l)}</div><div class="l">Win pct</div></div>
      <div class="kpi"><div class="v">${tot.cw}-${tot.cl}</div><div class="l">Conference record</div></div>
      <div class="kpi"><div class="v">${tot.reg}</div><div class="l">Regular-season titles</div></div>
      <div class="kpi"><div class="v">${tot.ct}</div><div class="l">Conf. tournament titles</div></div>
      <div class="kpi"><div class="v">${tot.ncaa}</div><div class="l">NCAA tournaments</div></div>
      <div class="kpi"><div class="v">${tot.mcws}</div><div class="l">MCWS trips</div></div>
      <div class="kpi"><div class="v">${tot.titles}${tot.titles ? ' 🏆' : ''}</div><div class="l">National titles</div></div>
    </div>
    <div class="card"><h2>Season by season</h2><div class="table-wrap"><table>
      <thead><tr><th>Season</th><th>Program</th><th>Conference</th><th class="num">Record</th><th class="num">Conf</th><th>Conference finish</th><th>Postseason</th><th class="num">Final rank</th></tr></thead>
      <tbody>${rows.map(({ y, t, h, inProgress }) => `<tr><td>${y}${inProgress ? ' <span class="muted small">(in progress)</span>' : ''}</td><td>${team(t.school, { rank: false })}</td><td>${confLogo(t.conference, 18)} <span class="small">${esc(t.conference)}</span></td>
        <td class="num">${h.rec.w}-${h.rec.l}</td><td class="num">${h.rec.cw}-${h.rec.cl}</td>
        <td>${h.pos && h.rec.cw + h.rec.cl ? `${h.pos} of ${h.confSize}` : ''}${h.regChamp && !inProgress ? ` <span class="badge">Reg. season ${h.regShared ? 'co-champ' : 'champ'}</span>` : ''}${h.tChamp ? ' <span class="badge gold">Tournament champ</span>' : ''}</td>
        <td>${h.finish ? esc(h.finish) : '<span class="muted">—</span>'}</td><td class="num">${h.finalRank ?? '<span class="muted">NR</span>'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No seasons as a head coach yet.</td></tr>'}</tbody></table></div></div>
    <div class="card" style="margin-top:16px"><h2>Commissioner edits</h2>
      <div class="row"><button class="btn" id="cp-rename">Rename coach</button>
      ${now ? '' : `<label class="field" style="min-width:220px">Hire as head coach of <select id="cp-hire"><option value="">Choose a program…</option>${Object.values(teamsNow).sort((a, b) => a.school.localeCompare(b.school)).map(t => `<option value="${esc(t.school)}">${esc(t.school)}${t.coachId ? ` (replaces ${esc(coachName(L, t.coachId))})` : ' (open job)'}</option>`).join('')}</select></label>`}</div>
      <p class="small muted">${L.draft && cur.phase === 'complete' ? `Hiring here applies to the ${L.draft.year} season being set up in the Offseason.` : 'Hiring here applies to the current season.'}</p></div>`;
  $('#cp-rename').onclick = async () => { const n = await askCoachName('Rename coach', c.name); if (n) { c.name = n; changed({ progress: false }); } else ctx.render(); };
  if ($('#cp-hire')) $('#cp-hire').onchange = e => {
    const school = e.target.value; if (!school) return;
    const replaced = teamsNow[school].coachId;
    hireCoach(teamsNow, school, id);
    changed({ progress: false });
    toast(`${c.name} is now ${school}'s head coach${replaced ? `; ${coachName(L, replaced)} is available` : ''}.`);
  };
}

export function renderCoaches() {
  const L = ctx.league, cur = L.seasons[L.currentYear];
  const teamsNow = L.draft && cur.phase === 'complete' ? L.draft.teams : cur.teams;
  const careers = Object.values(coachCareers()).map(c => ({ ...c, now: coachSchool(teamsNow, c.id) }))
    .sort((a, b) => (b.now ? 1 : 0) - (a.now ? 1 : 0) || b.w - a.w || a.name.localeCompare(b.name));
  app.innerHTML = `
    <div class="section-head"><h1>Coaches</h1><span class="muted">${careers.filter(c => c.now).length} head coaches · ${careers.filter(c => !c.now).length} available</span><span class="spacer"></span><button class="btn primary" id="co-add">+ Add coach</button></div>
    <div class="hint">Coaches are people in the dynasty. Change a program's coach from the Teams page, the team's page, or the Offseason. Picking a coach who leads another program hires him away and leaves that job open. Coaches without a job stay here as available.</div>
    <div class="card" style="margin-top:14px"><div class="table-wrap"><table>
      <thead><tr><th>Coach</th><th>Now</th><th class="num">Seasons</th><th class="num">W-L</th><th class="num">Pct</th><th class="num">Conf. tourney titles</th><th class="num">NCAA</th><th class="num">MCWS</th><th class="num">Natl. titles</th><th>Career</th><th></th></tr></thead>
      <tbody>${careers.map(c => `<tr><td><b>${coachLink(c.id)}</b></td><td>${c.now ? team(c.now, { rank: false }) : '<span class="badge">Available</span>'}</td>
        <td class="num">${c.seasons.length}</td><td class="num">${c.w}-${c.l}</td><td class="num">${c.w + c.l ? fmtPctLocal(c.w / (c.w + c.l)) : '—'}</td>
        <td class="num">${c.ct || ''}</td><td class="num">${c.ncaa || ''}</td><td class="num">${c.mcws || ''}</td><td class="num">${c.titles ? `<b>${c.titles}</b> 🏆` : ''}</td>
        <td class="small muted">${stints(c.seasons) || 'No seasons yet'}</td>
        <td class="num" style="white-space:nowrap"><button class="btn sm" data-rename="${c.id}">Rename</button>${!c.now && !c.seasons.length ? ` <button class="btn sm danger" data-cdel="${c.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#co-add').onclick = async () => { const n = await askCoachName('Add a coach'); if (n) { newCoach(L, n); changed({ progress: false }); toast(`${n} added as an available coach.`); } else ctx.render(); };
  $$('[data-rename]').forEach(b => (b.onclick = async () => { const c = L.coaches[b.dataset.rename]; const n = await askCoachName('Rename coach', c.name); if (n) { c.name = n; changed({ progress: false }); } else ctx.render(); }));
  $$('[data-cdel]').forEach(b => (b.onclick = () => { delete L.coaches[b.dataset.cdel]; changed({ progress: false }); }));
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
  $('#c-add').onclick = () => conferenceForm();
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
    return { y, reg: regSeasonChamps(se, c, rg, rpi(se, g => g.type === 'regular')), t: se.post?.confT?.[c]?.champion, bids: bids.length, best: best.includes('National champion') ? 'National champion' : best.includes('MCWS runner-up') ? 'MCWS runner-up' : best.find(b => /World Series/.test(b)) || best[0] || '' };
  }).filter(Boolean);
  app.innerHTML = `
    <div class="conf-hero" style="border-bottom-color:${esc(info.color)}"><div class="conf-hero-logo">${confLogo(c, 76)}</div><div style="flex:1"><div class="team-hero-name">${esc(c)}</div><div class="team-hero-sub">${st.length} teams</div></div><a class="btn" href="#/conferences">All conferences</a></div>
    <div class="grid">
      <div class="card"><h2>${s.year} standings</h2><div class="table-wrap"><table><thead><tr><th></th><th>Team</th><th class="num">Conf</th><th class="num">Overall</th><th class="num">OVR</th></tr></thead><tbody>
        ${st.map((x, i) => `<tr><td class="num muted">${i + 1}</td><td>${team(x.team)}</td><td class="num"><b>${x.cw}-${x.cl}</b></td><td class="num">${recs[x.team].w}-${recs[x.team].l}</td><td class="num">${ovr(s.teams[x.team])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h2>Champions</h2><div class="table-wrap"><table><thead><tr><th>Season</th><th>Regular season</th><th>Tournament</th><th class="num">NCAA bids</th><th>Best finish</th></tr></thead><tbody>
        ${hist.map(h => `<tr><td>${h.y}</td><td>${h.reg.length ? `<div class="stack-tight">${h.reg.map(t => team(t, { rank: false })).join('')}</div>${h.reg.length > 1 ? '<div class="small muted">Shared</div>' : ''}` : '—'}</td><td>${h.t ? team(h.t, { rank: false }) : '—'}</td><td class="num">${h.bids || ''}</td><td class="small">${esc(h.best)}</td></tr>`).join('')}</tbody></table></div></div>
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
        <td class="small">${wsTeams(se).map(esc).join(', ')}</td><td class="small">${top5.map((t, i) => `${i + 1}. ${esc(t)}`).join('<br>')}</td>
        <td class="small">${Object.values(p.confT || {}).map(ev => `${esc(ev.conf)}: ${esc(ev.champion || '—')}`).join('<br>')}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

// ---------- Settings ----------

// Rough games per team for the schedule settings (a week off here and there
// for teams left without a weekend opponent).
function gamesEstimate(cs) {
  const R = cs.regWeeks ?? 12, start = cs.midweekStart ?? 4, skip = (cs.midweekSkipLast ?? true) ? 1 : 0;
  const mid = Math.max(0, R - skip - start + 1) * ((cs.midweek ?? 'mixed') === 'single' ? 1 : 2);
  const top = R * 3 + mid;
  return `${top - 3}–${top}`;
}

export function renderSettings() {
  const L = ctx.league, s = S(), st = s.settings;
  const isCurrent = L.viewYear === L.currentYear;
  const cur = L.seasons[L.currentYear], cs = cur.settings;
  const saved = { ...DEFAULT_NCAA, ...(cs.ncaa || {}) };
  const nc = ui.ncaaDraft || saved;
  const ncDirty = ['regionals', 'perRegional', 'wsSize'].some(k => nc[k] !== saved[k]);
  const probs = ncaaProblems(nc, Object.keys(cur.teams).length);
  const canRebuild = !s.games.some(g => g.type === 'regular' && isFinal(g));
  const missingHE = s.games.filter(g => g.final && g.source === 'manual' && s.teams[g.home] && s.teams[g.away] && !g.homeH && !g.awayH && !g.homeE && !g.awayE && (g.homeR + g.awayR) > 0).length;
  app.innerHTML = `<div class="section-head"><h1>Settings</h1></div>
    <div class="grid">
      <div class="card stack"><h2>League</h2>
        <label class="field">League name <input type="text" id="s-name" value="${esc(L.name)}"></label>
        <label class="field">${s.year} championship name <input type="text" id="s-mcws" value="${esc(st.mcwsName)}"></label>
        <label class="field">Poll size <select id="s-poll">${POLL_SIZES.map(n => `<option value="${n}" ${pollSizeOf(cur) === n ? 'selected' : ''}>Top ${n}</option>`).join('')}</select></label>
        <p class="small muted" style="margin-top:-6px">Polls released from now on rank this many teams. Polls already out keep their size; regenerate one on the Rankings page to resize it.</p>
        <label class="field">Ratings between seasons <select id="s-dev">${Object.entries({ none: 'Stay the same', small: 'Small changes', normal: 'Normal changes', big: 'Big changes' }).map(([k, l]) => `<option value="${k}" ${st.development === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <p class="small muted">Each new season moves every rating a little toward 70 with some random growth, and you can edit any rating in the offseason.</p>
      </div>
      <div class="card stack"><h2>Simulation (${s.year})</h2>
        <label class="field">Upsets in simulated games <select id="s-vol">${[[0.8, 'Fewer'], [1, 'Realistic'], [1.3, 'More'], [1.8, 'Chaos']].map(([v, l]) => `<option value="${v}" ${Number(st.volatility) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Ratings move with results during the season <select id="s-form">${[['none', 'No — ratings stay put'], ['small', 'A little'], ['normal', 'Normal'], ['big', 'A lot']].map(([v, l]) => `<option value="${v}" ${(st.form || 'normal') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="s-rr" ${st.runRule ? 'checked' : ''}> 8-run rule after 5 innings</label>
        <label class="check"><input type="checkbox" id="s-tb" ${st.tiebreaker ? 'checked' : ''}> Extra innings start with a runner on second (8th inning on)</label>
        <button class="btn" id="s-backfill" ${missingHE ? '' : 'disabled'}>Estimate missing hits &amp; errors${missingHE ? ` (${missingHE} game${missingHE > 1 ? 's' : ''})` : ''}</button>
        <p class="small muted" style="margin-top:-6px">Scores you enter by hand get hits and errors from the line score and the teams' ratings when those boxes are left blank. This fills in ${s.year} games entered earlier with 0 hits and 0 errors for both teams.</p>
      </div>
      <div class="card stack"><h2>Season</h2>
        ${isCurrent ? `<a class="btn ${s.phase === 'complete' ? 'primary' : 'disabled'}" href="#/offseason">Go to the ${s.year + 1} offseason</a>
          <p class="small muted">${s.phase === 'complete' ? 'Add teams and conferences, realign, update coaches, then start the new season. The final poll seeds the new preseason poll.' : 'Opens once the national champion is crowned.'}</p>` : `<p class="muted">You're viewing a past season. Switch to ${L.currentYear} at the top to start a new one.</p>`}
        <button class="btn" id="s-rebuild" ${canRebuild ? '' : 'disabled'}>Rebuild ${s.year} schedule</button>
        <p class="small muted">${canRebuild ? 'Makes a new regular-season schedule from the current teams and conferences.' : 'Locked: regular-season games have been played.'}</p>
      </div>
      <div class="card stack"><h2>Schedule format</h2>
        <label class="field">Regular-season weeks <input type="number" id="s-weeks" min="8" max="16" value="${cs.regWeeks ?? DEFAULT_REG_WEEKS}"></label>
        <label class="field">Midweek games <select id="s-mid">${Object.entries(MIDWEEK).map(([k, l]) => `<option value="${k}" ${(cs.midweek ?? 'mixed') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Midweek games start in <select id="s-midstart">${Array.from({ length: 6 }, (_, i) => i + 1).map(w => `<option value="${w}" ${(cs.midweekStart ?? 4) === w ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="s-midskip" ${(cs.midweekSkipLast ?? true) ? 'checked' : ''}> No midweek games in the last regular-season week</label>
        <p class="small">About <b>${gamesEstimate(cs)}</b> games per team.</p>
        <p class="small muted">Used for every new schedule: the next season, or "Rebuild schedule" before any games are played. ${cur.year} runs ${regWeeksOf(cur)} weeks. Weekends are three-game series; midweek sets are two games against one opponent (a Tuesday doubleheader or Tuesday and Wednesday games). Conference play fills the last weeks. A conference's size sets when it starts (one week per round of its round robin, at most 9 weeks; bigger conferences play 9 of their members), and everyone finishes on the final weekend and nobody plays a non-conference weekend series once their conference season starts. A team with a conference bye plays a single Thursday game against another conference instead.</p>
      </div>
      <div class="card stack ncaa-card"><h2>NCAA tournament</h2>
        <label class="field">Men's College World Series <select id="n-ws">${[[4, '4 teams: double elimination to two, then a best-of-three final'], [8, '8 teams: Bracket A and Bracket B, then a best-of-three final']].map(([v, l]) => `<option value="${v}" ${nc.wsSize === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Regionals <select id="n-reg">${[nc.wsSize, nc.wsSize * 2].map(v => `<option value="${v}" ${nc.regionals === v ? 'selected' : ''}>${v} regionals${v === nc.wsSize ? ': champions go straight to the MCWS' : `: champions meet in ${v / 2} best-of-three super regionals`}</option>`).join('')}</select></label>
        <label class="field">Teams per regional <select id="n-per">${[[2, '2: best-of-three series'], [3, '3: double elimination'], [4, '4: double elimination (classic NCAA)'], [5, '5: double elimination'], [6, '6: double elimination']].map(([v, l]) => `<option value="${v}" ${nc.perRegional === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="kpis kpis-sm" style="margin:0"><div class="kpi"><div class="v">${fieldSize(nc)}</div><div class="l">Qualifiers</div></div><div class="kpi"><div class="v">${Object.keys(ctx.league.conferences).filter(c => Object.values(cur.teams).some(t => t.conference === c)).length}</div><div class="l">Automatic bids</div></div><div class="kpi"><div class="v">${Math.max(0, fieldSize(nc) - Object.keys(ctx.league.conferences).filter(c => Object.values(cur.teams).some(t => t.conference === c)).length)}</div><div class="l">At-large</div></div></div>
        <p class="small">${formatSummary(nc)}</p>
        ${probs.length ? `<div class="hint warn">${probs.map(esc).join('<br>')}</div>` : ''}
        <div class="row"><button class="btn primary" id="n-save" ${probs.length || !ncDirty ? 'disabled' : ''}>Save tournament format</button>${ncDirty ? '<button class="btn" id="n-cancel">Undo changes</button>' : ''}</div>
        <p class="small muted">${cur.post?.cfg ? `The ${cur.year} field is already announced, so a new format starts in ${cur.year + 1}.` : `Applies to the ${cur.year} tournament and every season after.`} Each conference champion gets an automatic bid; the committee picks the rest and seeds the field. The top national seeds host the regionals.</p>
      </div>
      <div class="card stack"><h2>Backups</h2>
        <p class="small muted">The dynasty is saved in this browser. Download a backup to keep a copy or move it to another device.</p>
        <div class="row"><button class="btn" id="s-export">Download backup</button><label class="btn">Restore backup <input type="file" id="s-import" accept="application/json,.json" hidden></label></div>
        <button class="btn danger" id="s-reset">Start over with a new league</button>
      </div>
    </div>`;
  $('#s-poll').onchange = e => { cs.pollSize = +e.target.value; changed({ progress: false }); toast(`Polls from now on will be a Top ${cs.pollSize}.`); };
  $('#s-weeks').onchange = e => { cs.regWeeks = Math.max(8, Math.min(16, Math.round(Number(e.target.value) || DEFAULT_REG_WEEKS))); changed({ progress: false }); toast(`New schedules will run ${cs.regWeeks} weeks.`); };
  $('#s-mid').onchange = e => { cs.midweek = e.target.value; changed({ progress: false }); };
  $('#s-midstart').onchange = e => { cs.midweekStart = +e.target.value; changed({ progress: false }); };
  $('#s-midskip').onchange = e => { cs.midweekSkipLast = e.target.checked; changed({ progress: false }); };
  const draft = () => (ui.ncaaDraft ||= { ...nc });
  $('#n-ws').onchange = e => { const d = draft(); d.wsSize = +e.target.value; if (d.regionals !== d.wsSize && d.regionals !== d.wsSize * 2) d.regionals = d.wsSize === 8 ? 8 : 4; renderSettings(); };
  $('#n-reg').onchange = e => { draft().regionals = +e.target.value; renderSettings(); };
  $('#n-per').onchange = e => { draft().perRegional = +e.target.value; renderSettings(); };
  if ($('#n-cancel')) $('#n-cancel').onclick = () => { ui.ncaaDraft = null; renderSettings(); };
  $('#n-save').onclick = () => {
    cs.ncaa = { regionals: nc.regionals, perRegional: nc.perRegional, wsSize: nc.wsSize };
    ui.ncaaDraft = null;
    if (cur.phase === 'selection') proposeField(cur); // resize the proposed field to the new format
    changed();
    toast(cur.post?.cfg ? `Saved. The new format starts in ${cur.year + 1}.` : `Saved. The ${cur.year} tournament will use ${fieldSize(cs.ncaa)} qualifiers.`);
  };
  $('#s-name').onchange = e => { L.name = e.target.value.trim() || L.name; changed({ progress: false }); };
  $('#s-mcws').onchange = e => { st.mcwsName = e.target.value.trim() || "Men's College World Series"; changed({ progress: false }); };
  $('#s-dev').onchange = e => { st.development = e.target.value; persist(); };
  $('#s-vol').onchange = e => { st.volatility = Number(e.target.value); persist(); };
  $('#s-backfill').onclick = () => {
    if (!confirm(`Estimate hits and errors for ${missingHE} hand-entered ${s.year} game${missingHE > 1 ? 's' : ''} that show 0 hits and 0 errors?`)) return;
    const k = backfillHitsErrors(s); changed({ progress: false }); toast(`Hits and errors estimated for ${k} game${k === 1 ? '' : 's'}.`);
  };
  $('#s-form').onchange = e => { st.form = e.target.value; changed(); };
  $('#s-rr').onchange = e => { st.runRule = e.target.checked; persist(); };
  $('#s-tb').onchange = e => { st.tiebreaker = e.target.checked; persist(); };
  $('#s-rebuild').onclick = () => {
    if (!confirm(`Replace the ${s.year} regular-season schedule with a new one?`)) return;
    try { rebuildSchedule(s, L.seasons[s.year - 1] || null); } catch (e) { return toast(e.message, true); }
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
