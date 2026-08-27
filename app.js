// ===== Shared utilities =====

function initBioField(container, count = 22) {
  const el = document.createElement('div');
  el.className = 'bio-field';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 12) + 's';
    s.style.animationDuration = (14 + Math.random() * 10) + 's';
    el.appendChild(s);
  }
  container.prepend(el);
}

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

function avatarHTML(player) {
  if (player.avatar) {
    return `<span class="avatar"><img src="${player.avatar}" alt=""></span>`;
  }
  return `<span class="avatar">${initials(player.pseudo)}</span>`;
}

// Flag rendering — uses flagcdn.com PNG images instead of unicode emoji flags,
// since flag emoji support is inconsistent across OS/browsers (esp. Windows).
const FLAGCDN_CODES = { ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls' };
function flagImageUrl(code, width = 48) {
  if (!code) return '';
  const cdnCode = (FLAGCDN_CODES[code] || code).toLowerCase();
  return `https://flagcdn.com/${width}x${Math.round(width * 0.75)}/${cdnCode}.png`;
}
function countryFlag(code) {
  if (!code) return '';
  const name = (SITE_DATA.countryInfo && SITE_DATA.countryInfo[code]) ? SITE_DATA.countryInfo[code].name : code;
  return `<img class="flag-icon" src="${flagImageUrl(code, 24)}" srcset="${flagImageUrl(code, 48)} 2x" alt="${name}" title="${name}" width="20" height="15">`;
}
function countryName(code) {
  return (SITE_DATA.countryInfo && SITE_DATA.countryInfo[code]) ? SITE_DATA.countryInfo[code].name : '';
}

// Country leaderboard, computed live from SITE_DATA.players (rather than trusting the
// precomputed SITE_DATA.countryStats blob, which can drift out of sync with the player
// list — e.g. new players added with a country that never gets a countryStats entry).
// This guarantees every player who has a country set is actually reflected in the
// map/leaderboards, and stays correct automatically as data.js is updated.
function computeCountryStats() {
  const byCode = {};
  SITE_DATA.players.forEach(p => {
    if (!p.country) return;
    if (!byCode[p.country]) {
      const info = SITE_DATA.countryInfo && SITE_DATA.countryInfo[p.country];
      byCode[p.country] = {
        code: p.country,
        name: (info && info.name) || p.countryName || p.country,
        playerCount: 0,
        eloSum: 0,
        topPlayer: p.pseudo,
        topPlayerElo: -Infinity,
        tournamentWins: 0,
      };
    }
    const c = byCode[p.country];
    c.playerCount++;
    c.eloSum += p.currentElo;
    if (p.currentElo > c.topPlayerElo) {
      c.topPlayerElo = p.currentElo;
      c.topPlayer = p.pseudo;
    }
    if (p.badges) {
      c.tournamentWins += p.badges.filter(b => b.startsWith('Champion')).length;
    }
  });
  return Object.values(byCode).map(c => ({
    code: c.code,
    name: c.name,
    playerCount: c.playerCount,
    avgElo: Math.round((c.eloSum / c.playerCount) * 10) / 10,
    topPlayer: c.topPlayer,
    topPlayerElo: c.topPlayerElo,
    tournamentWins: c.tournamentWins,
  }));
}

function playerBySlug(pseudo) {
  return SITE_DATA.players.find(p => p.pseudo === pseudo);
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function renderNav(active) {
  document.querySelectorAll('nav.top-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === active);
  });
}

// ===== Global search (header) =====
function initGlobalSearch() {
  const wrap = document.createElement('div');
  wrap.className = 'search-wrap';
  wrap.innerHTML = `<input type="text" id="global-search" placeholder="Search players or tournaments…" autocomplete="off">
    <div class="search-results" id="global-search-results"></div>`;
  const nav = document.querySelector('nav.top-nav');
  nav.parentElement.insertBefore(wrap, nav.nextSibling);

  const input = document.getElementById('global-search');
  const results = document.getElementById('global-search-results');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) { results.classList.remove('open'); results.innerHTML = ''; return; }
    const playerMatches = SITE_DATA.players.filter(p => p.pseudo.toLowerCase().includes(q)).slice(0, 6);
    const tMatches = SITE_DATA.tournaments.filter(t => t.name.toLowerCase().includes(q) || t.year.includes(q));
    let html = '';
    tMatches.forEach(t => {
      html += `<a href="tournament.html?slug=${t.slug}">${t.name}<span class="tag">tournament</span></a>`;
    });
    playerMatches.forEach(p => {
      html += `<a href="player.html?pseudo=${encodeURIComponent(p.pseudo)}">${p.pseudo}<span class="tag">#${p.rank} · ${p.currentElo} elo</span></a>`;
    });
    results.innerHTML = html || '<a style="color:var(--text-faint)">No results</a>';
    results.classList.add('open');
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) results.classList.remove('open');
  });
}

// ===== Badges =====
function badgeHTML(badges) {
  if (!badges || badges.length === 0) return '';
  return `<div class="badge-row">` + badges.map(b => {
    const isGold = b.startsWith('Champion');
    return `<span class="badge ${isGold ? 'gold' : ''}">${isGold ? '\u{1F3C6}' : '\u2726'} ${b}</span>`;
  }).join('') + `</div>`;
}

// ===== Mini bracket path (per tournament, W/L pills) =====
function renderPlayerPaths(container, pseudo) {
  const rows = SITE_DATA.tournaments.map(t => {
    const rounds = SITE_DATA.matchesByTournament[t.slug] || [];
    const played = [];
    rounds.forEach(r => {
      r.matches.forEach(m => {
        if (m.j1 === pseudo || m.j2 === pseudo) {
          played.push({ round: r.round, won: m.winner === pseudo });
        }
      });
    });
    if (played.length === 0) return '';
    const dots = played.map(p => `<span class="path-dot ${p.won ? 'win' : 'loss'}" title="${p.round}">${p.won ? 'W' : 'L'}</span>`).join('');
    return `<div class="path-row"><span class="path-tname">${t.year}</span><div class="path-dots">${dots}</div></div>`;
  }).join('');
  container.innerHTML = rows || '<p class="muted">No tournament path yet.</p>';
}

// ===== Rank change arrow =====
function rankChangeArrow(delta) {
  if (delta === null || delta === undefined || delta === 0) return '<span style="color:var(--text-faint); font-size:14px;">–</span>';
  if (delta > 0) return `<span style="color:#6FE6A0; font-size:14px;">\u25B2 ${delta}</span>`;
  return `<span style="color:var(--danger); font-size:14px;">\u25BC ${Math.abs(delta)}</span>`;
}

// ===== Elo win-probability + expected change simulator =====
function simulateElo(eloA, eloB, K = 32, lossDampener = 0.9) {
  const expA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const expB = 1 - expA;
  return {
    winProbA: Math.round(expA * 100),
    winProbB: Math.round(expB * 100),
    aGainOnWin: Math.round(K * (1 - expA)),
    aLossOnLoss: Math.round(K * expA * lossDampener),
    bGainOnWin: Math.round(K * (1 - expB)),
    bLossOnLoss: Math.round(K * expB * lossDampener),
  };
}
function renderBarChart(container, data, opts = {}) {
  const W = 640, H = 200, PAD_L = 40, PAD_R = 10, PAD_T = 10, PAD_B = 34;
  const max = Math.max(...data.map(d => d.value)) * 1.15 || 1;
  const bw = (W - PAD_L - PAD_R) / data.length;
  const y = (v) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const bars = data.map((d, i) => {
    const x = PAD_L + i * bw + bw * 0.15;
    const w = bw * 0.7;
    const yy = y(d.value);
    return `<rect x="${x}" y="${yy}" width="${w}" height="${H - PAD_B - yy}" fill="${d.color || '#35E3C4'}" rx="3"/>
      <text x="${x + w/2}" y="${H - PAD_B + 16}" text-anchor="middle" class="chart-axis">${d.label}</text>
      <text x="${x + w/2}" y="${yy - 6}" text-anchor="middle" class="chart-axis" fill="var(--text)">${d.value}</text>`;
  }).join('');
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="elo-chart" preserveAspectRatio="none">${bars}</svg>`;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Collects a player's full match history across all tournaments, in chronological order
function getPlayerHistory(pseudo) {
  let log = [];
  SITE_DATA.tournaments.forEach(t => {
    const rounds = SITE_DATA.matchesByTournament[t.slug] || [];
    rounds.forEach(r => {
      r.matches.forEach(m => {
        if (m.j1 === pseudo || m.j2 === pseudo) {
          const isP1 = m.j1 === pseudo;
          const opponent = isP1 ? m.j2 : m.j1;
          const score = isP1 ? `${m.s1}-${m.s2}` : `${m.s2}-${m.s1}`;
          const eloBefore = isP1 ? m.e1a : m.e2a;
          const eloAfter = isP1 ? m.e1p : m.e2p;
          const won = m.winner === pseudo;
          log.push({ tournament: t.name, tournamentSlug: t.slug, round: r.round, date: m.date, opponent, score, eloBefore, eloAfter, won });
        }
      });
    });
  });
  return log;
}

// Renders a lightweight inline SVG line chart (no external deps)
function renderEloChart(container, history) {
  if (history.length === 0) {
    container.innerHTML = '<p class="muted">No matches played yet.</p>';
    return;
  }
  const points = [{ date: history[0].date, elo: history[0].eloBefore, label: 'Start' }]
    .concat(history.map(h => ({ date: h.date, elo: h.eloAfter, label: h.opponent })));

  const W = 720, H = 220, PAD_L = 44, PAD_R = 16, PAD_T = 16, PAD_B = 30;
  const elos = points.map(p => p.elo);
  const minE = Math.min(...elos) - 20, maxE = Math.max(...elos) + 20;
  const x = (i) => PAD_L + (i / (points.length - 1 || 1)) * (W - PAD_L - PAD_R);
  const y = (e) => PAD_T + (1 - (e - minE) / (maxE - minE || 1)) * (H - PAD_T - PAD_B);

  const linePts = points.map((p, i) => `${x(i)},${y(p.elo)}`).join(' ');
  const areaPts = `${x(0)},${H - PAD_B} ${linePts} ${x(points.length - 1)},${H - PAD_B}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const e = minE + t * (maxE - minE);
    const yy = y(e);
    return `<line x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}" class="chart-grid"/>
             <text x="${PAD_L - 8}" y="${yy + 4}" class="chart-axis" text-anchor="end">${Math.round(e)}</text>`;
  }).join('');

  const dots = points.map((p, i) => {
    const isFirst = i === 0, isLast = i === points.length - 1;
    return `<circle cx="${x(i)}" cy="${y(p.elo)}" r="${isLast ? 5 : 3}" class="chart-dot ${isFirst ? 'start' : ''} ${isLast ? 'end' : ''}">
      <title>${p.label}: ${p.elo}</title>
    </circle>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="elo-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#35E3C4" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#35E3C4" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <polygon points="${areaPts}" fill="url(#areaFill)"/>
      <polyline points="${linePts}" class="chart-line"/>
      ${dots}
    </svg>
  `;
}

// ===== Bracket tree (real Challonge geometry: uses each match's original bracketY,
// with parent-links found by nearest-Y matching — correctly handles byes/uneven brackets) =====
function renderBracketTree(container, rounds) {
  const CARD_W = 220, CARD_H = 54, COL_GAP = 56;

  const allY = rounds.flatMap(r => r.matches.map(m => m.bracketY));
  const minY = Math.min(...allY);
  const yPositions = rounds.map(r => r.matches.map(m => (m.bracketY - minY) + CARD_H / 2));
  const maxY = Math.max(...yPositions.flat()) + CARD_H / 2 + 20;
  const totalW = rounds.length * (CARD_W + COL_GAP);

  const titlesHTML = rounds.map(r => `<div class="bracket-col-title-fixed" style="width:${CARD_W}px; margin-right:${COL_GAP}px;">${r.round}</div>`).join('');

  let cardsHTML = '';
  let connectorsSVG = '';
  rounds.forEach((r, ri) => {
    const x = ri * (CARD_W + COL_GAP);
    r.matches.forEach((m, i) => {
      const y = yPositions[ri][i];
      const top = y - CARD_H / 2;
      cardsHTML += `
        <div class="bracket-match-abs ${m.isUpset ? 'is-upset-b' : ''}" data-players="${m.j1}|${m.j2}"
             style="left:${x}px; top:${top}px; width:${CARD_W}px; height:${CARD_H}px;">
          <div class="brow ${m.winner === m.j1 ? 'win' : 'dim'}"><a href="player.html?pseudo=${encodeURIComponent(m.j1)}">${m.j1}</a><span>${m.s1}</span></div>
          <div class="brow ${m.winner === m.j2 ? 'win' : 'dim'}"><a href="player.html?pseudo=${encodeURIComponent(m.j2)}">${m.j2}</a><span>${m.s2}</span></div>
        </div>`;

      // find nearest match in the NEXT round by y (its true parent, robust to byes)
      if (ri < rounds.length - 1 && rounds[ri + 1].matches.length > 0) {
        let bestIdx = 0, bestDist = Infinity;
        yPositions[ri + 1].forEach((py, pi) => {
          const d = Math.abs(py - y);
          if (d < bestDist) { bestDist = d; bestIdx = pi; }
        });
        const parentY = yPositions[ri + 1][bestIdx];
        const startX = x + CARD_W, startY = y;
        const midX = startX + COL_GAP / 2;
        const endX = x + CARD_W + COL_GAP;
        connectorsSVG += `<path class="bracket-connector" d="M ${startX} ${startY} H ${midX} V ${parentY} H ${endX}"/>`;
      }
    });
  });

  container.innerHTML = `
    <div class="bracket-scroll">
      <div class="bracket-col-titles">${titlesHTML}</div>
      <div class="bracket-svg-wrap" style="width:${totalW}px; height:${maxY}px;">
        <svg width="${totalW}" height="${maxY}" style="position:absolute; top:0; left:0;">${connectorsSVG}</svg>
        ${cardsHTML}
      </div>
    </div>
  `;
}
