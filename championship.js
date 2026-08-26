// ===== Championship Beta =====
// Client-side commissioner tool: registrations, random 4-opponent matchmaking (max 1/week),
// results entry, Championship Points, and cumulative regional season standings.
// Everything persists in this browser via localStorage — no accounts, no backend.

const CHAMP_KEY = 'deeeep_championship_v1';
const REGIONS = ['EU', 'NA', 'AS', 'OCE', 'SA'];
const QUALIFY_SLOTS = { EU: 6, NA: 4, AS: 2, OCE: 2, SA: 2 };
const POINTS_TABLE = { '4-0': 100, '3-1': 70, '2-2': 40, '1-3': 20, '0-4': 10 };
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function champLoad() {
  try { return JSON.parse(localStorage.getItem(CHAMP_KEY) || '{}'); }
  catch (e) { return {}; }
}
function champSave(data) {
  try { localStorage.setItem(CHAMP_KEY, JSON.stringify(data)); } catch (e) {}
}
function champMonthKey(year, region, month) {
  return `${year}__${region}__${month}`;
}
function champGetMonth(data, year, region, month) {
  const key = champMonthKey(year, region, month);
  if (!data.months) data.months = {};
  if (!data.months[key]) data.months[key] = { registrations: [], weeks: null, makeup: [], results: {} };
  return data.months[key];
}

function initChampionship() {
  const monthSel = document.getElementById('cc-month');
  monthSel.innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');

  const yearInput = document.getElementById('cc-year');
  const regionSel = document.getElementById('cc-region');

  function current() {
    return { year: yearInput.value, region: regionSel.value, month: parseInt(monthSel.value) };
  }

  function refresh() {
    const { year, region, month } = current();
    const data = champLoad();
    const m = champGetMonth(data, year, region, month);
    document.getElementById('cc-registrations').value = m.registrations.join('\n');
    document.getElementById('cc-reg-count').textContent = m.registrations.length + ' registered';
    renderMatchmaking(m);
    renderResultsForm(m, () => { champSave(data); refresh(); });
    renderStandings();
    renderQualifiers();
  }

  [yearInput, regionSel, monthSel].forEach(el => el.addEventListener('change', refresh));

  document.getElementById('cc-save-reg').addEventListener('click', () => {
    const { year, region, month } = current();
    const data = champLoad();
    const m = champGetMonth(data, year, region, month);
    const names = document.getElementById('cc-registrations').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    m.registrations = [...new Set(names)];
    m.weeks = null; // registrations changed -> matchmaking must be regenerated
    m.results = {};
    champSave(data);
    refresh();
  });

  document.getElementById('cc-generate').addEventListener('click', () => {
    const { year, region, month } = current();
    const data = champLoad();
    const m = champGetMonth(data, year, region, month);
    if (m.registrations.length < 5) {
      alert('Need at least 5 registered players to generate matchmaking.');
      return;
    }
    const result = generateMatchmaking(m.registrations);
    m.weeks = result.weeks;
    m.makeup = result.makeup;
    m.results = {};
    champSave(data);
    refresh();
  });

  document.getElementById('standings-region').addEventListener('change', renderStandings);

  refresh();
}

// ----- Matchmaking generator: 4 distinct opponents per player, max 1 match/week -----
function generateMatchmaking(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const opponentsOf = {};
  const byeCount = {};
  shuffled.forEach(p => { opponentsOf[p] = new Set(); byeCount[p] = 0; });

  const weeks = [];
  for (let w = 0; w < 4; w++) {
    let pool = [...shuffled];
    let byePlayer = null;
    if (pool.length % 2 === 1) {
      const fresh = pool.filter(p => byeCount[p] === 0);
      const candidates = fresh.length ? fresh : pool;
      byePlayer = candidates[Math.floor(Math.random() * candidates.length)];
      byeCount[byePlayer]++;
      pool = pool.filter(p => p !== byePlayer);
    }

    let pairs = [];
    let ok = false;
    for (let attempt = 0; attempt < 300 && !ok; attempt++) {
      pairs = [];
      let avail = [...pool].sort(() => Math.random() - 0.5);
      let failed = false;
      while (avail.length > 0) {
        const a = avail.shift();
        const idx = avail.findIndex(b => !opponentsOf[a].has(b));
        if (idx === -1) { failed = true; break; }
        const b = avail.splice(idx, 1)[0];
        pairs.push([a, b]);
      }
      if (!failed) ok = true;
    }
    if (!ok) {
      // fallback: pair off remaining players even if it means a repeat opponent (rare edge case)
      let avail = [...pool].sort(() => Math.random() - 0.5);
      pairs = [];
      while (avail.length > 1) pairs.push([avail.shift(), avail.shift()]);
    }
    pairs.forEach(([a, b]) => { opponentsOf[a].add(b); opponentsOf[b].add(a); });
    weeks.push({ pairs, bye: byePlayer });
  }

  // makeup matches for anyone who ended up short of 4 opponents (possible with odd player counts)
  const makeup = [];
  let short = shuffled.filter(p => opponentsOf[p].size < 4);
  short = short.sort(() => Math.random() - 0.5);
  while (short.length > 1) {
    const a = short.shift();
    if (opponentsOf[a].size >= 4) continue;
    const idx = short.findIndex(b => !opponentsOf[a].has(b) && opponentsOf[b].size < 4);
    if (idx === -1) continue;
    const b = short.splice(idx, 1)[0];
    opponentsOf[a].add(b); opponentsOf[b].add(a);
    makeup.push([a, b]);
  }

  return { weeks, makeup };
}

function renderMatchmaking(m) {
  const el = document.getElementById('cc-matchmaking');
  if (!m.weeks) {
    el.innerHTML = '<p class="muted">No matchmaking generated for this month yet.</p>';
    return;
  }
  let html = '';
  m.weeks.forEach((w, i) => {
    html += `<div class="champ-week">
      <div class="champ-week-title">Week ${i + 1}${w.bye ? ` <span class="muted" style="font-weight:400;">— bye: ${w.bye}</span>` : ''}</div>
      <div class="champ-pairs">${w.pairs.map(([a,b]) => `<div class="champ-pair"><span>${a}</span><span class="guess-vs-label">vs</span><span>${b}</span></div>`).join('')}</div>
    </div>`;
  });
  if (m.makeup && m.makeup.length) {
    html += `<div class="champ-week">
      <div class="champ-week-title">Makeup matches <span class="muted" style="font-weight:400;">— to reach 4 games for everyone (odd player count)</span></div>
      <div class="champ-pairs">${m.makeup.map(([a,b]) => `<div class="champ-pair"><span>${a}</span><span class="guess-vs-label">vs</span><span>${b}</span></div>`).join('')}</div>
    </div>`;
  }
  el.innerHTML = html;
}

function allMatchesOf(m) {
  if (!m.weeks) return [];
  const out = [];
  m.weeks.forEach((w, wi) => w.pairs.forEach(([a, b]) => out.push({ a, b, label: `Week ${wi + 1}` })));
  (m.makeup || []).forEach(([a, b]) => out.push({ a, b, label: 'Makeup' }));
  return out;
}

function renderResultsForm(m, onChange) {
  const el = document.getElementById('cc-results-form');
  const matches = allMatchesOf(m);
  if (matches.length === 0) {
    el.innerHTML = '<p class="muted">Generate matchmaking first.</p>';
    return;
  }
  el.innerHTML = matches.map((match, idx) => {
    const key = `${match.a}__${match.b}__${idx}`;
    const saved = m.results[key];
    return `
      <div class="champ-result-row">
        <span class="champ-result-label">${match.label}</span>
        <button class="guess-opt champ-result-btn ${saved === match.a ? 'selected' : ''}" data-key="${key}" data-winner="${match.a}">${match.a}</button>
        <span class="guess-vs-label">vs</span>
        <button class="guess-opt champ-result-btn ${saved === match.b ? 'selected' : ''}" data-key="${key}" data-winner="${match.b}">${match.b}</button>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.champ-result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      m.results[btn.dataset.key] = btn.dataset.winner;
      onChange();
    });
  });
}

// ----- Standings -----
function computeRegionStandings(data, year, region) {
  const points = {}; // pseudo -> {points, months}
  Object.keys(data.months || {}).forEach(key => {
    const [y, r, mo] = key.split('__');
    if (y !== String(year) || r !== region) return;
    const m = data.months[key];
    if (!m.weeks) return;
    const matches = allMatchesOf(m);
    const record = {}; // pseudo -> {w,l}
    m.registrations.forEach(p => { record[p] = { w: 0, l: 0 }; });
    matches.forEach((match, idx) => {
      const key2 = `${match.a}__${match.b}__${idx}`;
      const winner = m.results[key2];
      if (!winner) return;
      const loser = winner === match.a ? match.b : match.a;
      if (record[winner]) record[winner].w++;
      if (record[loser]) record[loser].l++;
    });
    Object.entries(record).forEach(([p, rec]) => {
      const total = rec.w + rec.l;
      if (total === 0) return; // month not played by this player
      const scoreKey = `${rec.w}-${rec.l}`;
      const pts = POINTS_TABLE[scoreKey] || 0;
      if (!points[p]) points[p] = { points: 0, months: 0 };
      points[p].points += pts;
      points[p].months += 1;
    });
  });
  return Object.entries(points)
    .map(([pseudo, v]) => ({ pseudo, points: v.points, months: v.months }))
    .sort((a, b) => b.points - a.points);
}

function renderStandings() {
  const region = document.getElementById('standings-region').value;
  const year = document.getElementById('cc-year').value;
  const data = champLoad();
  const standings = computeRegionStandings(data, year, region);
  const qualifySlots = QUALIFY_SLOTS[region];
  const tbody = document.getElementById('standings-rows');
  if (standings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">No results recorded yet for ${region} ${year}.</td></tr>`;
    return;
  }
  tbody.innerHTML = standings.map((s, i) => `
    <tr style="${i === qualifySlots ? 'border-top:2px solid var(--bio-amber);' : ''}">
      <td class="rank ${i < qualifySlots ? 'top1' : ''}">${i + 1}</td>
      <td><a href="player.html?pseudo=${encodeURIComponent(s.pseudo)}">${s.pseudo}</a></td>
      <td class="muted">${s.months}</td>
      <td class="elo-val">${s.points}</td>
    </tr>
  `).join('');
}

function renderQualifiers() {
  const year = document.getElementById('cc-year').value;
  const data = champLoad();
  const tbody = document.getElementById('qualifiers-rows');
  let rows = [];
  REGIONS.forEach(region => {
    const standings = computeRegionStandings(data, year, region).slice(0, QUALIFY_SLOTS[region]);
    standings.forEach(s => rows.push({ region, ...s }));
  });
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="muted">No qualifiers yet — results need to be recorded first.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="muted">${r.region}</td>
      <td><a href="player.html?pseudo=${encodeURIComponent(r.pseudo)}">${r.pseudo}</a></td>
      <td class="elo-val">${r.points}</td>
    </tr>
  `).join('');
}
