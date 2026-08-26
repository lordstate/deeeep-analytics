// ===== Card Game — unified quiz =====
// One random question at a time, drawn from four formats: match winner, match score,
// higher Elo, or player nationality. Correct answer earns a collectible card (card.js).
// Everything (streak, collection) persists in this browser via localStorage.

const CG_PLAYED_KEY = 'deeeep_cg_played_matches_v1';
const CG_COLLECTION_KEY = 'deeeep_card_collection_v1';
const CG_BEST_STREAK_KEY = 'deeeep_cg_best_streak_v1';

let cgStreak = 0;

function cgLoadPlayed() {
  try { return new Set(JSON.parse(localStorage.getItem(CG_PLAYED_KEY) || '[]')); }
  catch (e) { return new Set(); }
}
function cgSavePlayed(set) {
  try { localStorage.setItem(CG_PLAYED_KEY, JSON.stringify([...set])); } catch (e) {}
}
function cgLoadCollection() {
  try { return JSON.parse(localStorage.getItem(CG_COLLECTION_KEY) || '[]'); }
  catch (e) { return []; }
}
function cgSaveCollection(list) {
  try { localStorage.setItem(CG_COLLECTION_KEY, JSON.stringify(list)); } catch (e) {}
}
function cgLoadBestStreak() {
  const v = parseInt(localStorage.getItem(CG_BEST_STREAK_KEY) || '0');
  return isNaN(v) ? 0 : v;
}
function cgSaveBestStreak(v) {
  try { localStorage.setItem(CG_BEST_STREAK_KEY, String(v)); } catch (e) {}
}

// Flatten every completed match across every tournament into one pool, tagged with a stable key.
function cgAllMatches() {
  const out = [];
  SITE_DATA.tournaments.forEach(t => {
    const rounds = SITE_DATA.matchesByTournament[t.slug] || [];
    rounds.forEach(r => {
      r.matches.forEach(m => {
        out.push({
          key: `${t.slug}__${r.round}__${m.id}`,
          tournamentName: t.name, tournamentSlug: t.slug, round: r.round,
          j1: m.j1, j2: m.j2, s1: m.s1, s2: m.s2, winner: m.winner,
        });
      });
    });
  });
  return out;
}
function cgPickMatch(played) {
  const pool = cgAllMatches().filter(m => !played.has(m.key));
  const source = pool.length ? pool : cgAllMatches();
  return source[Math.floor(Math.random() * source.length)];
}
function cgActualScore(m) {
  const winnerScore = m.winner === m.j1 ? m.s1 : m.s2;
  const loserScore = m.winner === m.j1 ? m.s2 : m.s1;
  return `${winnerScore}-${loserScore}`;
}

function initCardGame() {
  renderCollection();
  nextQuestion();
}

function availableTypes() {
  const types = ['winner', 'score', 'elo'];
  if (SITE_DATA.players.some(p => p.country)) types.push('country');
  return types;
}

function nextQuestion() {
  const played = cgLoadPlayed();
  const types = availableTypes();
  const type = types[Math.floor(Math.random() * types.length)];
  if (type === 'winner') renderWinnerQuestion(played);
  else if (type === 'score') renderScoreQuestion(played);
  else if (type === 'elo') renderEloQuestion();
  else renderCountryQuestion();
}

function renderStreakHeader() {
  return `<div class="guess-meta">Streak: <b style="color:var(--bio-teal);">${cgStreak}</b> &nbsp;·&nbsp; Best: ${cgLoadBestStreak()}</div>`;
}

function renderShell(bodyHTML) {
  document.getElementById('game-area').innerHTML = `<div class="guess-card">${renderStreakHeader()}${bodyHTML}<div id="guess-result"></div></div>`;
}

function markOption(q, correctVal) {
  const group = document.querySelector(`.guess-opts[data-q="${q}"]`);
  if (!group) return;
  group.querySelectorAll('.guess-opt').forEach(b => {
    if (b.dataset.val === correctVal) b.classList.add('correct');
    else if (b.classList.contains('selected')) b.classList.add('incorrect');
  });
}

// ----- Question: who won this match? -----
function renderWinnerQuestion(played) {
  const match = cgPickMatch(played);
  const p1 = playerBySlug(match.j1), p2 = playerBySlug(match.j2);
  renderShell(`
    <div class="guess-sub">${match.tournamentName} · ${match.round}</div>
    <div class="guess-q-label" style="text-align:center; margin:18px 0 14px;">Who won this match?</div>
    <div class="guess-vs">
      <div class="guess-player">${p1 ? avatarHTML(p1) : ''}<div class="guess-pname">${match.j1}</div></div>
      <div class="guess-vs-label">VS</div>
      <div class="guess-player">${p2 ? avatarHTML(p2) : ''}<div class="guess-pname">${match.j2}</div></div>
    </div>
    <div class="guess-opts" data-q="winner">
      <button class="guess-opt" data-val="${match.j1}">${match.j1}</button>
      <button class="guess-opt" data-val="${match.j2}">${match.j2}</button>
    </div>
  `);
  wireOptions('winner', (val) => {
    const correct = val === match.winner;
    markOption('winner', match.winner);
    const played = cgLoadPlayed(); played.add(match.key); cgSavePlayed(played);
    resolveOutcome(correct, playerBySlug(match.winner));
  });
}

// ----- Question: what was the score? -----
function renderScoreQuestion(played) {
  const match = cgPickMatch(played);
  const p1 = playerBySlug(match.j1), p2 = playerBySlug(match.j2);
  renderShell(`
    <div class="guess-sub">${match.tournamentName} · ${match.round}</div>
    <div class="guess-q-label" style="text-align:center; margin:18px 0 14px;">What was the final score?</div>
    <div class="guess-vs">
      <div class="guess-player">${p1 ? avatarHTML(p1) : ''}<div class="guess-pname">${match.j1}</div></div>
      <div class="guess-vs-label">VS</div>
      <div class="guess-player">${p2 ? avatarHTML(p2) : ''}<div class="guess-pname">${match.j2}</div></div>
    </div>
    <div class="guess-opts" data-q="score">
      <button class="guess-opt" data-val="3-0">3-0</button>
      <button class="guess-opt" data-val="3-1">3-1</button>
      <button class="guess-opt" data-val="3-2">3-2</button>
    </div>
  `);
  wireOptions('score', (val) => {
    const actual = cgActualScore(match);
    const correct = val === actual;
    markOption('score', actual);
    const played = cgLoadPlayed(); played.add(match.key); cgSavePlayed(played);
    resolveOutcome(correct, playerBySlug(match.winner));
  });
}

// ----- Question: who has the higher Elo? -----
function renderEloQuestion() {
  const pool = SITE_DATA.players;
  const a = pool[Math.floor(Math.random() * pool.length)];
  let b = pool[Math.floor(Math.random() * pool.length)];
  while (b.pseudo === a.pseudo) b = pool[Math.floor(Math.random() * pool.length)];

  renderShell(`
    <div class="guess-q-label" style="text-align:center; margin:18px 0 14px;">Who has the higher Elo rating?</div>
    <div class="guess-opts" data-q="elo">
      <button class="guess-opt" data-val="${a.pseudo}">${a.pseudo} ${a.country ? countryFlag(a.country) : ''}</button>
      <button class="guess-opt" data-val="${b.pseudo}">${b.pseudo} ${b.country ? countryFlag(b.country) : ''}</button>
    </div>
  `);
  wireOptions('elo', (val) => {
    const tie = a.currentElo === b.currentElo;
    const actualHigher = a.currentElo >= b.currentElo ? a.pseudo : b.pseudo;
    const correct = tie ? true : val === actualHigher;

    const group = document.querySelector('.guess-opts[data-q="elo"]');
    group.querySelectorAll('.guess-opt').forEach(btn => {
      const p = btn.dataset.val === a.pseudo ? a : b;
      btn.innerHTML += ` <span class="hilo-elo-inline">${p.currentElo}</span>`;
      if (tie || btn.dataset.val === actualHigher) btn.classList.add('correct');
      else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
    });

    const rewardPlayer = tie ? (Math.random() < 0.5 ? a : b) : (actualHigher === a.pseudo ? a : b);
    resolveOutcome(correct, rewardPlayer);
  });
}

// ----- Question: which country is this player from? -----
function renderCountryQuestion() {
  const withCountry = SITE_DATA.players.filter(p => p.country);
  const player = withCountry[Math.floor(Math.random() * withCountry.length)];
  const allCodes = Object.keys(SITE_DATA.countryInfo).filter(c => c !== player.country);
  const distractors = [];
  while (distractors.length < 3 && distractors.length < allCodes.length) {
    const c = allCodes[Math.floor(Math.random() * allCodes.length)];
    if (!distractors.includes(c)) distractors.push(c);
  }
  const options = [player.country, ...distractors].sort(() => Math.random() - 0.5);

  renderShell(`
    <div class="guess-q-label" style="text-align:center; margin:18px 0 14px;">Which country is <b>${player.pseudo}</b> from?</div>
    <div class="guess-vs" style="margin-bottom:20px;">
      <div class="guess-player">${avatarHTML(player)}<div class="guess-pname">${player.pseudo}</div></div>
    </div>
    <div class="guess-opts" data-q="country">
      ${options.map(c => `<button class="guess-opt" data-val="${c}">${countryFlag(c)} ${SITE_DATA.countryInfo[c].name}</button>`).join('')}
    </div>
  `);
  wireOptions('country', (val) => {
    const correct = val === player.country;
    markOption('country', player.country);
    resolveOutcome(correct, player);
  });
}

function wireOptions(q, onPick) {
  const group = document.querySelector(`.guess-opts[data-q="${q}"]`);
  let answered = false;
  group.querySelectorAll('.guess-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      group.querySelectorAll('.guess-opt').forEach(b => { b.classList.remove('selected'); b.disabled = true; });
      btn.classList.add('selected');
      onPick(btn.dataset.val);
    });
  });
}

function resolveOutcome(correct, rewardCandidate) {
  if (correct) {
    cgStreak++;
    if (cgStreak > cgLoadBestStreak()) cgSaveBestStreak(cgStreak);
  } else {
    cgStreak = 0;
  }

  const reward = correct ? resolveReward(rewardCandidate) : null;
  showResult(correct, reward);
}

function resolveReward(player) {
  if (!player) return null;
  const bonusChance = Math.min(0.10 + cgStreak * 0.03, 0.5);
  if (Math.random() < bonusChance) {
    const champions = SITE_DATA.players.filter(p => (p.badges || []).some(b => b.startsWith('Champion')));
    if (champions.length) return { player: champions[Math.floor(Math.random() * champions.length)], bonus: true };
  }
  return { player, bonus: false };
}

async function showResult(correct, reward) {
  const resultEl = document.getElementById('guess-result');

  if (!correct || !reward) {
    resultEl.innerHTML = `
      <div class="guess-outcome">
        <p style="color:${correct ? '#6FE6A0' : 'var(--danger)'};">${correct ? 'Correct!' : 'Not quite.'}</p>
        <p class="muted">${correct ? 'No card this round.' : 'Streak reset — give the next one a shot.'}</p>
        <button class="btn-primary" id="cg-next">Next question →</button>
      </div>
    `;
    document.getElementById('cg-next').addEventListener('click', nextQuestion);
    return;
  }

  const tier = getPlayerTier(reward.player);
  resultEl.innerHTML = `
    <div class="guess-outcome">
      <p style="color:#6FE6A0;">Correct!</p>
      <p>${reward.bonus ? '\u2728 Bonus pull! ' : ''}You earned a <span style="color:${tier.color}; font-weight:600;">${tier.label}</span> card: <b>${reward.player.pseudo}</b></p>
      <div class="guess-card-preview" id="cg-card-preview"></div>
      <button class="btn-primary" id="cg-next">Next question →</button>
    </div>
  `;

  const { canvas, tier: builtTier } = await buildPlayerCardCanvas(reward.player);
  const previewImg = document.createElement('img');
  previewImg.src = canvas.toDataURL('image/png');
  previewImg.className = 'card-canvas-small';
  previewImg.alt = reward.player.pseudo + ' card';
  previewImg.style.cursor = 'pointer';
  document.getElementById('cg-card-preview').appendChild(previewImg);
  previewImg.addEventListener('click', () => openCardModal(canvas, reward.player, builtTier));
  document.getElementById('cg-next').addEventListener('click', nextQuestion);

  const collection = cgLoadCollection();
  collection.unshift({ pseudo: reward.player.pseudo, tier: tier.key, wonAt: Date.now() });
  cgSaveCollection(collection);
  renderCollection();
}

function renderCollection() {
  const collection = cgLoadCollection();
  document.getElementById('collection-count').textContent = collection.length + ' card' + (collection.length === 1 ? '' : 's');
  const grid = document.getElementById('collection-grid');
  if (collection.length === 0) {
    grid.innerHTML = '<p class="muted">No cards yet — answer a question above to start your collection.</p>';
    return;
  }
  grid.innerHTML = collection.map((c, idx) => {
    const tier = CARD_TIERS[c.tier] || CARD_TIERS.common;
    return `<button class="collection-chip" style="border-color:${tier.color};" data-idx="${idx}">
      <span class="collection-chip-tier" style="color:${tier.color};">${tier.label}</span>
      <span class="collection-chip-name">${c.pseudo}</span>
    </button>`;
  }).join('');

  grid.querySelectorAll('.collection-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const idx = parseInt(chip.dataset.idx);
      const entry = collection[idx];
      const player = playerBySlug(entry.pseudo);
      if (!player) return;
      chip.disabled = true;
      const { canvas, tier } = await buildPlayerCardCanvas(player);
      openCardModal(canvas, player, tier);
      chip.disabled = false;
    });
  });
}
