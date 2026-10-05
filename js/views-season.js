// Season pages: home, schedule, standings, rankings and postseason.

import { ctx, S, app, modal, $, $$, esc, toast, changed, persist, cache, team, teamOptions, teamNames, confLogo, confHref, confColor, gameCard, compactCard, placeholderCard, bindGameCards, openGame, resultText, DAY_NAMES, readableOn, teamInfo } from './ui.js?v=20261005144512';
import { isFinal, records, rpi, confStandings, conferences, regSeasonChamp } from './standings.js?v=20261005144512';
import { latestPoll, generatePoll, pollRankMap, POLL_SIZE } from './polls.js?v=20261005144512';
import { ovr } from './sim.js?v=20261005144512';
import { simGames, addGame, weekName } from './league.js?v=20261005144512';
import { postWeeks, regWeeksOf, ncaaConfig, hasSupers, fieldSize, wsTeams, formatSummary, defaultConfTourneySize, confTourneySeeds, reseedConfTourney, proposeField, lockField, pods, nodeTeams, nodeNeeded, runnerUp, committeeOrder, autoBids, refLabel, setConfFormat, ensureLayout } from './postseason.js?v=20261005144512';
import { fmtPct, hashStr } from './util.js?v=20261005144512';

const ui = { week: null, pollWeek: null, rankTab: 'poll', postTab: null, editPoll: null };
export function resetSeasonUi() { ui.week = null; ui.pollWeek = null; ui.postTab = null; ui.editPoll = null; }

const PHASE_TEXT = { regular: 'Regular season', conf: 'Conference tournaments', selection: 'Selection', regionals: 'NCAA Regionals', supers: 'Super Regionals', mcws: "Men's College World Series", complete: 'Season complete' };

function nextGame(s) {
  return s.games.filter(g => !isFinal(g)).sort((a, b) => a.week - b.week || a.order - b.order || a.id - b.id)[0] || null;
}

function simAndReport(filter, what, opts = {}) {
  const s = S();
  const n = simGames(s, filter, opts);
  changed();
  toast(n ? `${n} game${n === 1 ? '' : 's'} simulated${what ? ' ' + what : ''}.` : 'Nothing left to simulate there.');
}

// ---------- Home ----------

export function renderHome() {
  const s = S(), recs = cache.recs(), poll = latestPoll(s);
  const total = s.games.length, done = s.games.filter(isFinal).length;
  const nx = nextGame(s);
  const best = Object.keys(s.teams).sort((a, b) => (recs[b].w - recs[b].l) - (recs[a].w - recs[a].l) || recs[b].w - recs[a].w)[0];
  const champ = s.post?.champion;
  const ct = champ ? teamInfo(champ) : null;
  const recent = s.games.filter(isFinal).sort((a, b) => b.week - a.week || b.order - a.order || b.id - a.id).slice(0, 8);
  const leaders = Object.keys(ctx.league.conferences).filter(c => Object.values(s.teams).some(t => t.conference === c)).map(c => {
    const st = confStandings(s, c, recs);
    return { c, top: st[0] };
  });
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Season</h1><span class="muted">${PHASE_TEXT[s.phase]}${nx ? ` · next: ${weekName(nx.week, s)}, ${DAY_NAMES[nx.day] || nx.day}` : ''}</span></div>
    ${champ ? `<div class="banner" style="background:linear-gradient(120deg, ${esc(ct.color)}, #15171c)"><span class="trophy">🏆</span><div><div class="small" style="opacity:.8">${s.year} National Champion</div><div class="big">${esc(champ)}</div><div class="small" style="opacity:.8">Beat ${esc(s.post.runnerUp)} in the ${esc(s.settings.mcwsName)} Championship Series · ${recs[champ].w}-${recs[champ].l}</div></div></div><div style="height:16px"></div>` : ''}
    <div class="kpis">
      <div class="kpi"><div class="v">${done}<span class="muted" style="font-size:16px"> / ${total}</span></div><div class="l">Games final</div></div>
      <div class="kpi"><div class="v">${poll?.ranks[0] ? team(poll.ranks[0].team, { rank: false, size: 22 }) : '—'}</div><div class="l">No. 1 ${poll ? (poll.week === 'final' ? '(final poll)' : poll.week === 0 ? '(preseason)' : `(week ${poll.week} poll)`) : ''}</div></div>
      <div class="kpi"><div class="v">${best ? team(best, { rank: false, size: 22 }) : '—'}</div><div class="l">Best record ${best ? `(${recs[best].w}-${recs[best].l})` : ''}</div></div>
      <div class="kpi"><div class="v">${PHASE_TEXT[s.phase]}</div><div class="l">Phase</div></div>
    </div>
    ${nx ? `<div class="card"><div class="row"><div><h2 style="margin:0">Up next: ${weekName(nx.week, s)} · ${DAY_NAMES[nx.day] || nx.day}</h2>
      <div class="muted small">${s.games.filter(g => g.week === nx.week && g.day === nx.day && !isFinal(g)).length} games that day</div></div><span class="spacer"></span>
      <a class="btn" href="#/schedule">Open schedule</a>
      <button class="btn" id="h-day">🎲 Sim next day</button>
      <button class="btn primary" id="h-week">🎲 Sim ${weekName(nx.week, s)}</button></div></div>`
      : s.phase === 'complete' && ctx.league.viewYear === ctx.league.currentYear ? `<div class="card"><div class="row"><div><h2 style="margin:0">On to the ${s.year + 1} offseason</h2><div class="muted small">Add teams and conferences, realign, and update coaches before the new schedule is built.</div></div><span class="spacer"></span><a class="btn primary" href="#/offseason">Open the offseason</a></div></div>`
      : s.phase === 'selection' ? `<div class="card"><div class="row"><h2 style="margin:0">The NCAA field is ready to announce</h2><span class="spacer"></span><a class="btn primary" href="#/postseason">Review the field</a></div></div>` : ''}
    <div class="grid" style="margin-top:16px">
      <div class="card"><h2>${poll ? (poll.week === 'final' ? 'Final poll' : poll.week === 0 ? 'Preseason poll' : `Week ${poll.week} poll`) : 'Poll'}</h2>
        <table><tbody>${(poll?.ranks || []).slice(0, 10).map((x, i) => `<tr><td class="num" style="width:28px">${i + 1}</td><td>${team(x.team, { rank: false })}</td><td class="num muted">${esc(x.record)}</td></tr>`).join('')}</tbody></table>
        <p class="small"><a href="#/rankings">Full Top 15 and RPI →</a></p></div>
      <div class="card"><h2>Conference leaders</h2>
        <table><tbody>${leaders.map(({ c, top }) => `<tr><td style="width:30px"><a href="${confHref(c)}">${confLogo(c, 22)}</a></td><td>${top ? team(top.team) : '—'}</td><td class="num muted">${top ? `${top.cw}-${top.cl}` : ''}</td></tr>`).join('')}</tbody></table>
        <p class="small"><a href="#/standings">Standings →</a></p></div>
      <div class="card"><h2>Latest results</h2>
        ${recent.length ? `<table><tbody>${recent.map(g => `<tr class="clickable" data-open="${g.id}"><td class="small muted" style="width:70px">${esc(weekName(g.week, s).replace('Week ', 'Wk '))} ${esc(g.day)}</td><td>${esc(resultText(g))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No games played yet.</p>'}</div>
    </div>`;
  $$('[data-open]').forEach(r => (r.onclick = () => openGame(Number(r.dataset.open))));
  if ($('#h-day')) $('#h-day').onclick = () => simAndReport(g => g.week === nx.week && g.day === nx.day, `on ${DAY_NAMES[nx.day] || nx.day}`);
  if ($('#h-week')) $('#h-week').onclick = () => simAndReport(g => g.week === nx.week, `in ${weekName(nx.week, s)}`);
}

// ---------- Schedule ----------

function weeksOf(s) { return [...new Set(s.games.map(g => g.week))].sort((a, b) => a - b); }

export function renderSchedule() {
  const s = S();
  const weeks = weeksOf(s);
  if (ui.week === null || !weeks.includes(ui.week)) ui.week = nextGame(s)?.week ?? weeks[weeks.length - 1] ?? 1;
  // Within a day, mix conferences like a real scoreboard. The sort key comes
  // from the series (or the game), so a weekend series keeps its spot
  // Friday through Sunday and the order stays the same between visits.
  const mixKey = g => hashStr(`${s.year}|${g.series || 'g' + g.id}`);
  const games = s.games.filter(g => g.week === ui.week).sort((a, b) => a.order - b.order || (a.type === 'regular' && b.type === 'regular' ? mixKey(a) - mixKey(b) : 0) || a.id - b.id);
  const unplayed = games.filter(g => !isFinal(g));
  const days = [...new Set(games.map(g => g.day))];
  const firstOpenDay = unplayed[0]?.day;
  const isDone = w => s.games.filter(g => g.week === w).every(isFinal);
  const finals = s.games.filter(isFinal).length;
  const regLeft = s.games.filter(g => g.type === 'regular' && !isFinal(g)).length;
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Schedule</h1><span class="muted">${finals} of ${s.games.length} games final</span></div>
    <div class="chips">${weeks.map(w => `<button class="chip ${w === ui.week ? 'active' : ''} ${isDone(w) ? 'done' : ''}" data-week="${w}">${w > regWeeksOf(s) ? esc(weekName(w, s)) : 'Wk ' + w}</button>`).join('')}</div>
    <div class="row" style="margin-bottom:14px">
      <h2 style="margin:0">${esc(weekName(ui.week, s))}</h2><span class="spacer"></span>
      ${firstOpenDay ? `<button class="btn" id="w-day">🎲 Sim ${DAY_NAMES[firstOpenDay] || firstOpenDay}</button>` : ''}
      ${unplayed.length ? `<button class="btn" id="w-sim">🎲 Sim week (${unplayed.length})</button>` : ''}
      ${regLeft && ui.week <= regWeeksOf(s) ? `<button class="btn" id="w-rest">Sim rest of regular season (${regLeft})</button>` : ''}
      ${ui.week <= regWeeksOf(s) ? '<button class="btn" id="w-add">+ Add game</button>' : ''}
    </div>
    ${days.map(d => `<h3 class="day-head">${DAY_NAMES[d] || esc(d)} <span class="muted small">${games.filter(g => g.day === d).length} games</span></h3>
      <div class="games">${games.filter(g => g.day === d).map(gameCard).join('')}</div>`).join('') || '<div class="empty">No games this week.</div>'}
    <p class="small muted" style="margin-top:16px">Click a game to enter its line score by inning or simulate it. Percentages are pre-game win chances from the teams' OFF, PIT and DEF ratings and the day's starting pitchers (Friday aces, Saturday and Sunday starters, midweek arms). Rotation order and starters can be changed in the game editor.</p>`;
  $$('[data-week]').forEach(b => (b.onclick = () => { ui.week = Number(b.dataset.week); renderSchedule(); }));
  bindGameCards();
  if ($('#w-day')) $('#w-day').onclick = () => simAndReport(g => g.week === ui.week && g.day === firstOpenDay, `on ${DAY_NAMES[firstOpenDay] || firstOpenDay}`);
  if ($('#w-sim')) $('#w-sim').onclick = () => simAndReport(g => g.week === ui.week, `in ${weekName(ui.week, s)}`);
  if ($('#w-rest')) $('#w-rest').onclick = () => {
    if (!confirm(`Simulate all ${regLeft} remaining regular-season games? Every result stays editable.`)) return;
    simAndReport(g => g.type === 'regular', 'in the regular season');
  };
  if ($('#w-add')) $('#w-add').onclick = () => {
    const g = addGame(s, { week: ui.week, day: 'Tue' });
    openGame(g.id, { isNew: true });
  };
}

// ---------- Standings ----------

export function renderStandings() {
  const s = S(), recs = cache.recs(), r = rpi(s);
  const regRecs = records(s, g => g.type === 'regular');
  const confs = Object.keys(ctx.league.conferences).filter(c => Object.values(s.teams).some(t => t.conference === c));
  const card = c => {
    const st = confStandings(s, c, regRecs, r);
    const n = st.length;
    const size = Math.min(n, s.settings.confTourney?.[c] ?? defaultConfTourneySize(n));
    const champ = regSeasonChamp(s, c, regRecs, r);
    const tchamp = s.post?.confT?.[c]?.champion;
    const canSize = s.phase === 'regular';
    return `<div class="card">
      <div class="row" style="margin-bottom:8px"><a href="${confHref(c)}">${confLogo(c, 30)}</a><h2 style="margin:0"><a class="team-link" href="${confHref(c)}">${esc(c)}</a></h2><span class="spacer"></span>
        ${tchamp ? `<span class="badge gold">Tournament: ${esc(tchamp)}</span>` : ''}</div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Team</th><th class="num">Conf</th><th class="num">GB</th><th class="num">Overall</th><th class="num">Home</th><th class="num">Away</th><th class="num">Strk</th></tr></thead>
        <tbody>${st.map((x, i) => `<tr class="${i === size - 1 && size < n ? 'cutline' : ''}"><td class="num muted">${i + 1}</td>
          <td>${team(x.team)}</td>
          <td class="num"><b>${x.cw}-${x.cl}</b></td><td class="num">${x.gb ? x.gb.toFixed(1).replace('.0', '') : '—'}</td>
          <td class="num">${recs[x.team].w}-${recs[x.team].l}</td><td class="num">${x.hw}-${x.hl}</td><td class="num">${x.aw}-${x.al}</td>
          <td class="num">${x.streak || ''}</td></tr>`).join('')}</tbody></table></div>
      <details class="small" style="margin-top:8px"><summary class="muted">Commissioner</summary><div class="row" style="margin-top:8px">
        <label class="field">Regular-season champion <select data-champ="${esc(c)}"><option value="">Automatic (${esc(regSeasonChamp({ ...s, overrides: {} }, c, regRecs, r) || '—')})</option>${teamOptions(s.overrides.regChamps?.[c], { blank: false, list: st.map(x => x.team) })}</select></label>
        <label class="field">Tournament format <select data-format="${esc(c)}" ${canSize ? '' : 'disabled'}>${[['single', 'Single elimination'], ['double', 'Double elimination']].map(([k, l]) => `<option value="${k}" ${(s.settings.confFormat?.[c] || 'single') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Tournament teams <select data-size="${esc(c)}" ${canSize ? '' : 'disabled'}>${[0, 2, 3, 4, 5, 6, 7, 8].filter(k => k <= n).map(k => `<option value="${k}" ${k === size ? 'selected' : ''}>${k ? `Top ${k}` : 'No tournament'}</option>`).join('')}</select></label>
      </div>${canSize ? '' : `<p class="muted">Tournament size and format are locked once the tournaments are set. You can still switch a tournament's format on the Postseason page until its first game.</p>`}</details>
    </div>`;
  };
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Standings</h1><span class="muted">Conference record first; ties go to head-to-head, then RPI (see Rankings). The line marks the conference tournament cut.</span></div>
    <div class="grid wide">${confs.map(card).join('')}</div>`;
  $$('[data-champ]').forEach(sel => (sel.onchange = () => {
    s.overrides.regChamps ||= {};
    if (sel.value) s.overrides.regChamps[sel.dataset.champ] = sel.value; else delete s.overrides.regChamps[sel.dataset.champ];
    changed({ progress: false });
  }));
  $$('[data-format]').forEach(sel => (sel.onchange = () => { s.settings.confFormat ||= {}; s.settings.confFormat[sel.dataset.format] = sel.value; changed({ progress: false }); }));
  $$('[data-size]').forEach(sel => (sel.onchange = () => { s.settings.confTourney ||= {}; s.settings.confTourney[sel.dataset.size] = Number(sel.value); changed({ progress: false }); }));
}

// ---------- Rankings ----------

function pollWeeks(s) {
  const ks = Object.keys(s.polls || {}).filter(k => k !== 'final').map(Number).sort((a, b) => a - b);
  if (s.polls?.final) ks.push('final');
  return ks;
}

export function renderRankings() {
  const s = S();
  const tabs = { poll: 'Top 15 poll', rpi: 'RPI', sos: 'Strength of schedule', power: 'Power (OVR)' };
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Rankings</h1></div>
    <div class="steps">${Object.entries(tabs).map(([k, l]) => `<a href="#/rankings" data-tab="${k}" class="${ui.rankTab === k ? 'active' : ''}">${l}</a>`).join('')}</div>
    <div id="rk"></div>`;
  $$('[data-tab]').forEach(a => (a.onclick = e => { e.preventDefault(); ui.rankTab = a.dataset.tab; ui.editPoll = null; renderRankings(); }));
  ({ poll: renderPollTab, rpi: renderRpiTab, sos: renderSosTab, power: renderPowerTab })[ui.rankTab]($('#rk'));
}

function renderPollTab(root) {
  const s = S();
  const weeks = pollWeeks(s);
  if (!weeks.length) { root.innerHTML = '<div class="empty">No polls yet.</div>'; return; }
  if (ui.pollWeek === null || !weeks.some(w => String(w) === String(ui.pollWeek))) ui.pollWeek = weeks[weeks.length - 1];
  const key = ui.pollWeek;
  const poll = s.polls[key];
  const prevKey = key === 'final' ? weeks.filter(w => w !== 'final').slice(-1)[0] : weeks.filter(w => w !== 'final' && w < key).slice(-1)[0];
  const prev = prevKey !== undefined ? pollRankMap(s.polls[prevKey]) : {};
  const label = w => (w === 'final' ? 'Final' : w === 0 ? 'Pre' : w === postWeeks(s).conf ? 'Post-tourney' : `Wk ${w}`);
  const editing = ui.editPoll && ui.editPoll.key === key;
  const rows = editing ? ui.editPoll.ranks : poll.ranks;
  // Teams ranked in the previous poll but not in this one, with that week's results.
  const inNow = new Set(rows.map(r => r.team));
  const weekRec = t => {
    if (key === 'final' || key === 0) return '';
    const gs = s.games.filter(g => g.week === key && isFinal(g) && (g.home === t || g.away === t));
    if (!gs.length) return '';
    const w = gs.filter(g => (g.homeR > g.awayR ? g.home : g.away) === t).length;
    return `${w}-${gs.length - w}`;
  };
  const dropped = prevKey === undefined ? [] : Object.entries(prev).filter(([t]) => !inNow.has(t)).sort((a, b) => a[1] - b[1]).map(([t, was]) => ({ team: t, was, week: weekRec(t) }));
  const mv = (t, i) => {
    const p = prev[t];
    if (prevKey === undefined) return '';
    if (!p) return '<span class="move up">NEW</span>';
    const d = p - (i + 1);
    return d > 0 ? `<span class="move up">▲${d}</span>` : d < 0 ? `<span class="move down">▼${-d}</span>` : '<span class="muted">—</span>';
  };
  root.innerHTML = `
    <div class="chips">${weeks.map(w => `<button class="chip ${String(w) === String(key) ? 'active' : ''}" data-pw="${w}">${label(w)}</button>`).join('')}</div>
    <div class="card">
      <div class="row" style="margin-bottom:10px"><h2 style="margin:0">${key === 'final' ? 'Final poll' : key === 0 ? 'Preseason poll' : key === postWeeks(s).conf ? 'Poll after conference tournaments' : `Week ${key} poll`}</h2>
        ${poll.edited ? '<span class="badge manual">Commissioner edited</span>' : ''}<span class="spacer"></span>
        ${editing ? '<button class="btn" id="p-cancel">Cancel</button><button class="btn primary" id="p-save">Save poll</button>' : '<button class="btn" id="p-edit">Edit poll</button><button class="btn" id="p-regen">Regenerate</button>'}</div>
      <div class="table-wrap"><table>
        <thead><tr><th class="num">#</th><th>Team</th><th class="num">Record</th>${editing ? '<th></th>' : '<th class="num">Points</th><th class="num">Prev</th><th></th>'}</tr></thead>
        <tbody>${rows.map((x, i) => `<tr><td class="num"><b>${i + 1}</b></td><td>${team(x.team, { rank: false })}${!editing && x.fp ? ` <span class="muted small">(${x.fp})</span>` : ''}</td><td class="num muted">${esc(x.record || '')}</td>
          ${editing ? `<td class="num" style="white-space:nowrap"><button class="btn sm" data-up="${i}" ${i ? '' : 'disabled'}>▲</button> <button class="btn sm" data-down="${i}" ${i < rows.length - 1 ? '' : 'disabled'}>▼</button> <button class="btn sm danger" data-rm="${i}">✕</button></td>`
          : `<td class="num">${x.pts ?? ''}</td><td class="num muted">${prevKey !== undefined ? prev[x.team] ?? 'NR' : ''}</td><td class="num">${mv(x.team, i)}</td>`}</tr>`).join('')}</tbody></table></div>
      ${editing ? `<div class="row" style="margin-top:10px"><select id="p-add">${teamOptions('', { blankLabel: 'Add a team…', list: teamNames().filter(t => !rows.some(r => r.team === t)) })}</select><span class="muted small">Added teams go to the bottom; move them up with ▲. The poll keeps 15 teams.</span></div>`
      : `${dropped.length ? `<div class="dropped"><b>Dropped out:</b> ${dropped.map(d => `<span class="drop-item">${team(d.team, { rank: false, size: 16 })} <span class="muted small">was #${d.was}${d.week ? `, ${d.week} this week` : ''}</span></span>`).join('')}</div>` : prevKey !== undefined ? '<p class="small muted" style="margin-top:10px">No teams dropped out this week.</p>' : ''}
        ${poll.others?.length ? `<p class="small muted" style="margin-top:10px"><b>Others receiving votes:</b> ${poll.others.map(o => `${esc(o.team)} ${o.pts}`).join(', ')}</p>` : ''}`}
      <p class="small muted">${poll.voters || 40} simulated voters. First-place votes in parentheses. Polls come out when a week's games are all final.</p>
    </div>`;
  $$('[data-pw]', root).forEach(b => (b.onclick = () => { ui.pollWeek = b.dataset.pw === 'final' ? 'final' : Number(b.dataset.pw); ui.editPoll = null; renderRankings(); }));
  const recs = cache.recs();
  if ($('#p-edit', root)) $('#p-edit', root).onclick = () => { ui.editPoll = { key, ranks: poll.ranks.map(x => ({ ...x })) }; renderRankings(); };
  if ($('#p-cancel', root)) $('#p-cancel', root).onclick = () => { ui.editPoll = null; renderRankings(); };
  if ($('#p-regen', root)) $('#p-regen', root).onclick = () => {
    if (!confirm('Regenerate this poll from scratch? Your edits to it will be replaced.')) return;
    s.polls[key] = key === 'final' ? generatePoll(s, 'final', { final: true }) : generatePoll(s, key);
    changed({ progress: false }); toast('Poll regenerated.');
  };
  if ($('#p-save', root)) $('#p-save', root).onclick = () => {
    const ranks = ui.editPoll.ranks.slice(0, POLL_SIZE);
    const kept = new Set(ranks.map(r => r.team));
    s.polls[key] = { ...poll, edited: true, ranks: ranks.map(r => ({ ...r, pts: r.pts ?? 0, fp: r.fp ?? 0 })), others: [...poll.others || [], ...poll.ranks.filter(r => !kept.has(r.team))].filter(o => !kept.has(o.team)) };
    ui.editPoll = null; changed({ progress: false }); toast('Poll saved.');
  };
  const list = ui.editPoll?.ranks;
  $$('[data-up]', root).forEach(b => (b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; renderRankings(); }));
  $$('[data-down]', root).forEach(b => (b.onclick = () => { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; renderRankings(); }));
  $$('[data-rm]', root).forEach(b => (b.onclick = () => { list.splice(+b.dataset.rm, 1); renderRankings(); }));
  if ($('#p-add', root)) $('#p-add', root).onchange = e => {
    const t = e.target.value; if (!t) return;
    const r = recs[t];
    list.push({ team: t, record: `${r.w}-${r.l}`, pts: 0, fp: 0 });
    if (list.length > POLL_SIZE) list.splice(POLL_SIZE - 1, 1);
    renderRankings();
  };
}

function renderRpiTab(root) {
  const s = S(), r = rpi(s), recs = cache.recs(), pr = cache.ranks();
  const teams = Object.keys(s.teams).filter(t => r[t].games).sort((a, b) => r[a].rank - r[b].rank);
  root.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th class="num">RPI</th><th>Team</th><th>Conf</th><th class="num">Record</th><th class="num">WP</th><th class="num">OWP</th><th class="num">OOWP</th><th class="num">Rating</th><th class="num">SOS</th><th class="num">Poll</th></tr></thead>
    <tbody>${teams.map(t => `<tr><td class="num"><b>${r[t].rank}</b></td><td>${team(t, { rank: false })}</td><td>${confLogo(s.teams[t].conference, 18)}</td><td class="num">${recs[t].w}-${recs[t].l}</td>
      <td class="num">${fmtPct(r[t].wp)}</td><td class="num">${fmtPct(r[t].owp)}</td><td class="num">${fmtPct(r[t].oowp)}</td><td class="num"><b>${r[t].rpi.toFixed(4).replace(/^0/, '')}</b></td><td class="num muted">${r[t].sosRank ?? ''}</td><td class="num muted">${pr[t] ?? ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">The RPI starts once games are played.</td></tr>'}</tbody></table></div>
    <p class="small muted">RPI = 25% winning percentage + 50% opponents' winning percentage (not counting games against this team) + 25% opponents' opponents' winning percentage. The selection committee weighs RPI rank 50%, poll rank 30% and strength-of-schedule rank 20%.</p></div>`;
}

function renderSosTab(root) {
  const s = S(), r = rpi(s), recs = cache.recs(), pr = cache.ranks();
  const teams = Object.keys(s.teams).filter(t => r[t].games).sort((a, b) => r[a].sosRank - r[b].sosRank);
  root.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th class="num">SOS</th><th>Team</th><th>Conf</th><th class="num">Record</th><th class="num">Opponents' record</th><th class="num">Opp. win %</th><th class="num">Opp. opp. win %</th><th class="num">Rating</th><th class="num">RPI</th><th class="num">Poll</th></tr></thead>
    <tbody>${teams.map(t => `<tr><td class="num"><b>${r[t].sosRank}</b></td><td>${team(t, { rank: false })}</td><td>${confLogo(s.teams[t].conference, 18)}</td><td class="num">${recs[t].w}-${recs[t].l}</td>
      <td class="num">${r[t].oppW}-${r[t].oppL}</td><td class="num">${fmtPct(r[t].owp)}</td><td class="num">${fmtPct(r[t].oowp)}</td><td class="num"><b>${r[t].sos.toFixed(4).replace(/^0/, '')}</b></td><td class="num muted">${r[t].rank ?? ''}</td><td class="num muted">${pr[t] ?? ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Strength of schedule starts once games are played.</td></tr>'}</tbody></table></div>
    <p class="small muted">Strength of schedule = ⅔ opponents' winning percentage (not counting games against this team) + ⅓ opponents' opponents' winning percentage. Opponents' record counts every game a team's opponents played, once per meeting. The selection committee uses SOS rank for 20% of its order, which picks the at-large teams and sets the seeds.</p></div>`;
}

function renderPowerTab(root) {
  const s = S(), recs = cache.recs(), pr = cache.ranks();
  const teams = Object.keys(s.teams).sort((a, b) => ovr(s.teams[b]) - ovr(s.teams[a]) || s.teams[b].pit - s.teams[a].pit);
  root.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th class="num">#</th><th>Team</th><th>Conf</th><th class="num">OFF</th><th class="num">PIT</th><th class="num">DEF</th><th class="num">OVR</th><th class="num">Record</th><th class="num">Poll</th></tr></thead>
    <tbody>${teams.map((t, i) => { const x = s.teams[t]; return `<tr><td class="num">${i + 1}</td><td>${team(t, { rank: false })}</td><td>${confLogo(x.conference, 18)}</td><td class="num">${x.off}</td><td class="num">${x.pit}</td><td class="num">${x.def}</td><td class="num"><b>${ovr(x)}</b></td><td class="num">${recs[t].w}-${recs[t].l}</td><td class="num muted">${pr[t] ?? ''}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="small muted">OVR = 40% OFF + 40% PIT + 20% DEF. Change ratings on the Teams page or a team's profile.</p></div>`;
}

// ---------- Postseason ----------

// A drawn bracket. Rounds are columns; every game sits halfway between the
// two games that feed it, joined by lines. Double elimination draws the
// winners bracket on top, the elimination bracket underneath, and the
// championship to the right. Cards show R/H/E; click for the line score.
const BK = { CW: 236, COLW: 264, H: 138, SLOT: 150, HEAD: 30, SEC_GAP: 34 };

function eventBracket(ev, seedFn) {
  const s = S();
  ensureLayout(ev);
  const byKey = Object.fromEntries(ev.nodes.map(n => [n.key, n]));
  const secOf = n => n.sec || 'W';
  const kids = n => [n.a, n.b].filter(r => r && r.w && byKey[r.w] && secOf(byKey[r.w]) === secOf(n)).map(r => byKey[r.w]);
  const pos = {};
  // Elimination-bracket "games" against a bye never happen; leave them out.
  const hidden = new Set(ev.nodes.filter(n => secOf(n) === 'L' && nodeTeams(ev, n).includes('BYE')).map(n => n.key));
  const sections = ['W', 'L'].filter(sec => ev.nodes.some(n => secOf(n) === sec));
  const double = sections.includes('L');
  let top = 0, maxCol = 0;
  const heads = [];
  for (const sec of sections) {
    const nodes = ev.nodes.filter(n => secOf(n) === sec);
    const fed = new Set(nodes.flatMap(n => kids(n).map(k => k.key)));
    const roots = nodes.filter(n => !fed.has(n.key));
    let slot = 0;
    const secTop = top + (double ? BK.SEC_GAP : 0) + BK.HEAD;
    const place = n => {
      if (pos[n.key]) return pos[n.key].y;
      const ks = kids(n);
      const y = ks.length ? ks.map(place).reduce((a, b) => a + b, 0) / ks.length : secTop + (slot++) * BK.SLOT;
      pos[n.key] = { x: n.col * BK.COLW, y };
      maxCol = Math.max(maxCol, n.col);
      return y;
    };
    roots.forEach(place);
    const cols = [...new Set(nodes.map(n => n.col))].sort((a, b) => a - b);
    for (const c of cols) {
      const first = nodes.find(n => n.col === c && !hidden.has(n.key));
      if (!first) continue;
      const byDay = ev.kind === 'regional' || ev.kind === 'mcws' || ev.kind === 'de';
      heads.push({ x: c * BK.COLW, y: secTop - BK.HEAD, text: byDay ? DAY_NAMES[first.day] || first.day : first.label.replace(/ \(.*\)$/, ''), day: byDay ? null : first.day });
    }
    if (double) heads.push({ x: 0, y: top, text: sec === 'W' ? 'Winners bracket' : 'Elimination bracket', section: true });
    top = secTop + slot * BK.SLOT;
  }
  // Championship column.
  const finals = ev.nodes.filter(n => secOf(n) === 'F');
  if (finals.length) {
    const x = sections.length ? (maxCol + 1) * BK.COLW : 0; // a lone best-of-three starts at the left edge
    const feeders = [finals[0].a, finals[0].b].map(r => r && pos[r.w || r.l]).filter(Boolean);
    const mid = feeders.length ? feeders.reduce((a, p) => a + p.y, 0) / feeders.length : BK.HEAD;
    const start = Math.max(BK.HEAD, mid - ((finals.length - 1) * BK.SLOT) / 2);
    finals.forEach((n, i) => { pos[n.key] = { x, y: start + i * BK.SLOT }; });
    const finalsTitle = ev.kind === 'mcws' ? 'Championship Series' : ev.kind === 'series' ? 'Best of three' : ev.bracket ? 'Bracket final' : ev.kind === 'regional' || ev.kind === 'de' ? (ev.id.startsWith('reg') ? 'Regional final' : 'Final') : 'Championship';
    heads.push({ x, y: start - BK.HEAD, text: finalsTitle, day: ev.kind === 'series' ? null : finals[0].day });
    top = Math.max(top, start + finals.length * BK.SLOT);
  }
  const width = Math.max(...Object.values(pos).map(p => p.x)) + BK.CW;
  const height = Math.max(...Object.values(pos).map(p => p.y)) + BK.H + 4;

  // Connector lines: from each feeding game into the game it feeds.
  const lines = [];
  const link = (from, to) => {
    const x1 = from.x + BK.CW, y1 = from.y + BK.H / 2, x2 = to.x, y2 = to.y + BK.H / 2, mx = x1 + (x2 - x1) / 2;
    lines.push(`<path d="M${x1},${y1} H${mx} V${y2} H${x2}" />`);
  };
  for (const n of ev.nodes) {
    if (secOf(n) === 'F') continue;
    for (const k of kids(n)) if (!hidden.has(k.key)) link(pos[k.key], pos[n.key]);
  }
  if (finals.length) for (const r of [finals[0].a, finals[0].b]) { const f = r && pos[r.w]; if (f) link(f, pos[finals[0].key]); }

  const cell = node => {
    const label = node.code || node.label;
    if (node.gameId) { const g = s.games.find(x => x.id === node.gameId); if (g) return compactCard({ ...g, label }, seedFn); }
    const [a, b] = nodeTeams(ev, node);
    if (a === 'BYE' || b === 'BYE') {
      const t = a === 'BYE' ? b : a;
      return placeholderCard(label, [t, 'BYE'], seedFn, { faded: true, note: 'First-round bye' });
    }
    const needed = nodeNeeded(ev, node);
    const decidedBy = { g7: 'G6', f3: 'F2', s3: 'S2', ifnec: 'CH' }[node.cond];
    const decided = !!(decidedBy && byKey[decidedBy]?.winner);
    const slotText = (t, ref) => t || (refLabel(ev, ref) ? { text: refLabel(ev, ref) } : null);
    return placeholderCard(label, [slotText(a, node.a), slotText(b, node.b)], seedFn, { faded: !!node.cond && !needed && !!decided, note: node.cond ? (decided && !needed ? 'Not needed' : 'If necessary') : '' });
  };
  return `<div class="bk-scroll"><div class="bk" style="width:${width}px;height:${height}px">
    <svg class="bk-lines" width="${width}" height="${height}" aria-hidden="true">${lines.join('')}</svg>
    ${heads.map(h => `<div class="bk-head ${h.section ? 'bk-sec' : ''}" style="left:${h.x}px;top:${h.y}px;${h.section ? '' : `width:${BK.CW}px`}">${esc(h.text)}${h.day ? ` <span class="muted">· ${esc(DAY_NAMES[h.day] || h.day)}</span>` : ''}</div>`).join('')}
    ${ev.nodes.map(n => pos[n.key] && !hidden.has(n.key) ? `<div class="bk-node" style="left:${pos[n.key].x}px;top:${pos[n.key].y}px;width:${BK.CW}px;height:${BK.H}px">${cell(n)}</div>` : '').join('')}
  </div></div>`;
}

export function renderPostseason() {
  const s = S(), p = s.post || {};
  const cfg = ncaaConfig(s);
  const defaultTab = { regular: 'conf', conf: 'conf', selection: 'field', regionals: 'regionals', supers: 'supers', mcws: 'mcws', complete: 'mcws' }[s.phase];
  const tabs = { conf: 'Conference tournaments', field: 'Selection', regionals: 'Regionals', ...(hasSupers(cfg) ? { supers: 'Super Regionals' } : {}), mcws: s.settings.mcwsName.replace("Men's College World Series", 'MCWS') };
  if (!ui.postTab || !tabs[ui.postTab]) ui.postTab = defaultTab;
  const left = s.games.filter(g => g.type !== 'regular' && !isFinal(g)).length + (s.phase === 'regular' ? 1 : 0);
  app.innerHTML = `
    <div class="section-head"><h1>${s.year} Postseason</h1><span class="muted">${PHASE_TEXT[s.phase]}</span><span class="spacer"></span>
      ${s.phase !== 'complete' && s.phase !== 'regular' ? '<button class="btn" id="ps-all">🎲 Sim rest of postseason</button>' : ''}</div>
    ${p.champion ? `<div class="banner" style="background:linear-gradient(120deg, ${esc(teamInfo(p.champion).color)}, #15171c)"><span class="trophy">🏆</span><div><div class="small" style="opacity:.8">${s.year} National Champion</div><div class="big">${esc(p.champion)}</div><div class="small" style="opacity:.8">Runner-up: ${esc(p.runnerUp)}</div></div></div><div style="height:16px"></div>` : ''}
    <div class="steps">${Object.entries(tabs).map(([k, l]) => `<a href="#/postseason" data-pt="${k}" class="${ui.postTab === k ? 'active' : ''}">${esc(l)}</a>`).join('')}</div>
    <div id="ps"></div>`;
  $$('[data-pt]').forEach(a => (a.onclick = e => { e.preventDefault(); ui.postTab = a.dataset.pt; renderPostseason(); }));
  if ($('#ps-all')) $('#ps-all').onclick = () => {
    if (!confirm('Simulate the rest of the postseason? The NCAA field is announced as proposed if you haven\'t announced it yet.')) return;
    simAndReport(g => g.type !== 'regular', 'in the postseason', { autoLock: true });
  };
  const root = $('#ps');
  ({ conf: renderConfTourneys, field: renderField, regionals: renderRegionals, supers: renderSupers, mcws: renderMcws })[ui.postTab](root);
  bindGameCards(root);
}

function renderConfTourneys(root) {
  const s = S(), p = s.post || {};
  if (s.phase === 'regular') {
    const left = s.games.filter(g => g.type === 'regular' && !isFinal(g)).length;
    const confs = conferences(s);
    root.innerHTML = `<div class="hint">Conference tournaments are seeded and start automatically when the regular season ends (${left} game${left === 1 ? '' : 's'} left). Tournament sizes can be changed on the Standings page until then. Projected seeds:</div>
      <div class="grid" style="margin-top:14px">${confs.map(c => {
        const n = Object.values(s.teams).filter(t => t.conference === c).length;
        const size = Math.min(n, s.settings.confTourney?.[c] ?? defaultConfTourneySize(n));
        const seeds = confTourneySeeds(s, c).slice(0, size);
        return `<div class="card"><div class="row"><a href="${confHref(c)}">${confLogo(c, 26)}</a><h3 style="margin:0">${esc(c)} Tournament</h3><span class="spacer"></span><span class="muted small">${size ? `Top ${size}, ${size >= 3 && s.settings.confFormat?.[c] === 'double' ? 'double' : 'single'} elimination` : 'No tournament: regular-season champion gets the bid'}</span></div>
          <ol class="seedlist">${seeds.map(t => `<li>${team(t)}</li>`).join('')}</ol></div>`;
      }).join('')}</div>`;
    return;
  }
  const evs = Object.values(p.confT || {});
  const anyOpen = s.games.some(g => g.type === 'conf' && !isFinal(g));
  root.innerHTML = `${anyOpen ? '<div class="row" style="margin-bottom:12px"><span class="spacer"></span><button class="btn primary" id="ct-sim">🎲 Sim conference tournaments</button></div>' : ''}
    ${evs.map(ev => {
      const started = ev.nodes.some(n => n.gameId && s.games.find(g => g.id === n.gameId && isFinal(g)));
      return `<div class="card"><div class="row" style="margin-bottom:10px"><a href="${confHref(ev.conf)}">${confLogo(ev.conf, 28)}</a><h2 style="margin:0">${esc(ev.conf)} Tournament</h2>
        ${ev.champion ? `<span class="badge gold">Champion: ${esc(ev.champion)}</span>` : ''}<span class="spacer"></span>
        ${started ? `<span class="muted small">${ev.kind === 'double' ? 'Double' : 'Single'} elimination</span>` : `${ev.size >= 3 ? `<select class="sm-select" data-cformat="${esc(ev.conf)}" aria-label="${esc(ev.conf)} tournament format">${[['single', 'Single elimination'], ['double', 'Double elimination']].map(([k, l]) => `<option value="${k}" ${ev.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}<button class="btn sm" data-reseed="${esc(ev.conf)}">Edit seeds</button>`}</div>
        <div class="small muted" style="margin-bottom:8px">Seeds: ${ev.seeds.map((t, i) => `${i + 1}. ${esc(t)}`).join(' · ')}</div>
        ${eventBracket(ev, t => ev.seeds.indexOf(t) + 1 || null)}</div>`;
    }).join('')}
    ${!evs.length ? '<div class="empty">No conference tournaments this season.</div>' : ''}`;
  if ($('#ct-sim', root)) $('#ct-sim', root).onclick = () => simAndReport(g => g.type === 'conf', 'in the conference tournaments');
  $$('[data-reseed]', root).forEach(b => (b.onclick = () => editSeeds(b.dataset.reseed)));
  $$('[data-cformat]', root).forEach(sel => (sel.onchange = () => {
    try { setConfFormat(s, sel.dataset.cformat, sel.value); } catch (e) { return toast(e.message, true); }
    changed(); toast(`${sel.dataset.cformat} Tournament is now ${sel.value} elimination.`);
  }));
}

function editSeeds(conf) {
  const s = S(), ev = s.post.confT[conf];
  const teams = Object.values(s.teams).filter(t => t.conference === conf).map(t => t.school).sort();
  modal.innerHTML = `<div class="modal-head"><h2>${esc(conf)} Tournament seeds</h2><button class="btn ghost" data-x>✕</button></div>
    <div class="modal-body stack">${ev.seeds.map((t, i) => `<label class="field">Seed ${i + 1} <select data-seed="${i}">${teamOptions(t, { blank: false, list: teams })}</select></label>`).join('')}</div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn primary" id="sd-save">Save seeds</button></div>`;
  $$('[data-x]', modal).forEach(b => (b.onclick = () => modal.close()));
  modal.onclose = () => ctx.render();
  $('#sd-save', modal).onclick = () => {
    const seeds = $$('[data-seed]', modal).map(x => x.value);
    if (new Set(seeds).size !== seeds.length) return toast('Each team can only have one seed.', true);
    try { reseedConfTourney(s, conf, seeds); } catch (e) { return toast(e.message, true); }
    modal.close(); changed(); toast('Seeds saved.');
  };
  modal.showModal();
}

function renderField(root) {
  const s = S(), p = s.post || {};
  if (!p.field) {
    const cfg = ncaaConfig(s);
    root.innerHTML = `<div class="empty">The ${fieldSize(cfg)}-team NCAA field is chosen once every conference tournament is finished. It has ${Object.keys(ctx.league.conferences).length ? 'one automatic bid per conference (the tournament champion, or the regular-season champion where there is no tournament)' : 'automatic bids'}, and the rest are at-large picks by the committee. The committee orders teams by RPI rank (50%), poll rank (30%) and strength-of-schedule rank (20%), and that order also sets the seeds.<br><br>${formatSummary(cfg)} <a href="#/settings">Change the format in Settings.</a></div>`;
    return;
  }
  const r = rpi(s), pr = cache.ranks(), recs = cache.recs();
  const editable = s.phase === 'selection';
  const field = [...p.field].sort((a, b) => a.seed - b.seed);
  const cfg = ncaaConfig(s);
  const podList = pods(field, cfg.regionals);
  const podOf = t => podList.findIndex(pd => pd.includes(t));
  const inField = new Set(field.map(f => f.team));
  root.innerHTML = `
    ${editable ? `<div class="hint">This is the committee's proposed field, ordered and seeded by RPI rank (50%), poll rank (30%) and strength-of-schedule rank (20%). Swap any team or move seeds, then announce it to start the regionals. The top ${cfg.regionals} national seeds host. Regionals are built serpentine, so seed 1's regional also gets seed ${cfg.regionals * 2}${cfg.perRegional > 2 ? `, ${cfg.regionals * 2 + 1}` : ''} and so on.<br>${formatSummary(cfg)}</div>` : ''}
    <div class="card" style="margin-top:14px"><div class="row" style="margin-bottom:10px"><h2 style="margin:0">NCAA field · ${field.length} teams</h2><span class="spacer"></span>
      ${editable ? '<button class="btn" id="f-redo">Re-run selection</button><button class="btn primary" id="f-lock">Announce field & start regionals</button>' : ''}</div>
      <div class="table-wrap"><table><thead><tr><th class="num">Seed</th><th>Team</th><th>Conf</th><th>Bid</th><th class="num">Record</th><th class="num">RPI</th><th class="num">Poll</th><th class="num">SOS</th><th>Regional</th>${editable ? '<th></th>' : ''}</tr></thead>
      <tbody>${field.map((f, i) => `<tr><td class="num"><b>${f.seed}</b></td>
        <td>${editable ? `<select data-swap="${i}">${teamOptions(f.team, { blank: false, list: teamNames().filter(t => t === f.team || !inField.has(t)) })}</select>` : team(f.team, { rank: false })}</td>
        <td>${confLogo(f.conf, 18)}</td><td>${f.bid === 'auto' ? '<span class="badge real">Auto</span>' : '<span class="badge">At-large</span>'}</td>
        <td class="num">${recs[f.team].w}-${recs[f.team].l}</td><td class="num">${r[f.team]?.rank ?? ''}</td><td class="num muted">${pr[f.team] ?? ''}</td><td class="num muted">${r[f.team]?.sosRank ?? ''}</td>
        <td class="small">${esc(podList[podOf(f.team)][0])}${podList[podOf(f.team)][0] === f.team ? ' (host)' : ''}</td>
        ${editable ? `<td class="num" style="white-space:nowrap"><button class="btn sm" data-fup="${i}" ${i ? '' : 'disabled'}>▲</button> <button class="btn sm" data-fdown="${i}" ${i < field.length - 1 ? '' : 'disabled'}>▼</button></td>` : ''}</tr>`).join('')}</tbody></table></div>
      <div class="row small" style="margin-top:10px;gap:24px">
        <div><b>Last four in:</b> ${(p.lastIn || []).map(esc).join(', ') || '—'}</div>
        <div><b>First four out:</b> ${(p.firstOut || []).map(esc).join(', ') || '—'}</div></div>
    </div>`;
  if (!editable) return;
  const setField = list => { p.field = list.map((f, i) => ({ ...f, seed: i + 1 })); changed({ progress: false }); };
  $$('[data-swap]', root).forEach(sel => (sel.onchange = () => {
    const i = +sel.dataset.swap, t = sel.value;
    const auto = new Set(Object.values(autoBids(s)));
    field[i] = { team: t, seed: i + 1, bid: auto.has(t) ? 'auto' : 'at-large', conf: s.teams[t].conference };
    setField(field);
  }));
  $$('[data-fup]', root).forEach(b => (b.onclick = () => { const i = +b.dataset.fup; [field[i - 1], field[i]] = [field[i], field[i - 1]]; setField(field); }));
  $$('[data-fdown]', root).forEach(b => (b.onclick = () => { const i = +b.dataset.fdown; [field[i + 1], field[i]] = [field[i], field[i + 1]]; setField(field); }));
  $('#f-redo', root).onclick = () => { if (confirm('Throw out your changes and re-run the committee selection?')) { proposeField(s); changed({ progress: false }); } };
  $('#f-lock', root).onclick = () => { lockField(s); ui.postTab = 'regionals'; changed(); toast('Field announced. Regionals are set.'); };
}

function renderRegionals(root) {
  const s = S(), p = s.post || {};
  if (!p.regionals) { root.innerHTML = '<div class="empty">Regionals begin once the NCAA field is announced.</div>'; return; }
  const open = s.games.some(g => g.type === 'regional' && !isFinal(g));
  const seed = t => p.field.find(f => f.team === t)?.seed;
  root.innerHTML = `${open ? '<div class="row" style="margin-bottom:12px"><span class="spacer"></span><button class="btn primary" id="rg-sim">🎲 Sim regionals</button></div>' : ''}
    ${p.regionals.map(ev => `<div class="card"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(ev.name)}</h2>${ev.champion ? `<span class="badge gold">Champion: ${esc(ev.champion)}</span>` : ''}</div>
      <div class="small muted" style="margin-bottom:8px">${ev.seeds.map((t, i) => `${i + 1}. ${esc(t)} (#${seed(t)})`).join(' · ')} · ${ev.kind === 'series' ? 'best of three' : 'double elimination'}, hosted by ${esc(ev.host)}</div>
      ${eventBracket(ev, seed)}</div>`).join('')}`;
  if ($('#rg-sim', root)) $('#rg-sim', root).onclick = () => simAndReport(g => g.type === 'regional', 'in the regionals');
}

function renderSupers(root) {
  const s = S(), p = s.post || {};
  if (!p.supers) { root.innerHTML = '<div class="empty">Super regionals start once every regional is finished. Each one is a best-of-three series between two regional champions, hosted by the higher national seed.</div>'; return; }
  const open = s.games.some(g => g.type === 'super' && !isFinal(g));
  const seed = t => p.field.find(f => f.team === t)?.seed;
  root.innerHTML = `${open ? '<div class="row" style="margin-bottom:12px"><span class="spacer"></span><button class="btn primary" id="sr-sim">🎲 Sim super regionals</button></div>' : ''}
    <div class="grid">${p.supers.map(ev => `<div class="card"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(ev.name)}</h2>${ev.champion ? `<span class="badge gold">To the MCWS: ${esc(ev.champion)}</span>` : ''}</div>
      <div class="small muted" style="margin-bottom:8px">${ev.seeds.map(t => `${esc(t)} (#${seed(t)})`).join(' vs ')} · best of three at ${esc(ev.host)}</div>
      ${eventBracket(ev, seed)}</div>`).join('')}</div>`;
  if ($('#sr-sim', root)) $('#sr-sim', root).onclick = () => simAndReport(g => g.type === 'super', 'in the super regionals');
}

function renderMcws(root) {
  const s = S(), p = s.post || {}, cfg = ncaaConfig(s);
  const name = esc(s.settings.mcwsName);
  if (!p.mcws && !p.mcwsBrackets) {
    root.innerHTML = `<div class="empty">${cfg.wsSize === 8
      ? `Eight teams reach the ${name}. They split into Bracket A and Bracket B, each a four-team double elimination with an "if necessary" bracket final. The two bracket winners play a best-of-three Championship Series.`
      : `Four teams reach the ${name}: double elimination down to two teams, then a best-of-three Championship Series.`}</div>`;
    return;
  }
  const open = s.games.some(g => g.type === 'mcws' && !isFinal(g));
  const seed = t => p.field.find(f => f.team === t)?.seed;
  const card = (ev, title, sub) => `<div class="card"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${title}</h2>${ev.champion ? `<span class="badge gold">${ev.id === 'ws-F' || ev.id === 'mcws' ? 'Champion' : 'Bracket winner'}: ${esc(ev.champion)}</span>` : ''}</div>
    <div class="small muted" style="margin-bottom:8px">${sub}</div>${eventBracket(ev, seed)}</div>`;
  const list = ev => ev.seeds.map(t => `${esc(t)} (#${seed(t)})`).join(' · ');
  root.innerHTML = `${open ? '<div class="row" style="margin-bottom:12px"><span class="spacer"></span><button class="btn primary" id="mc-sim">🎲 Sim the MCWS</button></div>' : ''}
    ${p.mcws ? card(p.mcws, name, list(p.mcws)) : ''}
    ${(p.mcwsBrackets || []).map(ev => card(ev, `${name} · ${esc(ev.name)}`, `${list(ev)} · double elimination`)).join('')}
    ${p.mcwsBrackets ? (p.mcwsFinals ? card(p.mcwsFinals, `${name} · Championship Series`, `${list(p.mcwsFinals)} · best of three`) : '<div class="card"><h2>Championship Series</h2><p class="muted">The Bracket A and Bracket B winners meet in a best-of-three series.</p></div>') : ''}`;
  if ($('#mc-sim', root)) $('#mc-sim', root).onclick = () => simAndReport(g => g.type === 'mcws', 'in the MCWS');
}
