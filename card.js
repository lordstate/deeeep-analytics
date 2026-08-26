// ===== Player cards — collectible-card generator (client-side Canvas, no server) =====
//
// Everything here reads from data already computed in data.js (SITE_DATA). Nothing is
// hand-authored per player: rarity, stats and badges are all derived automatically,
// so a new player showing up in data.js instantly gets a card with zero extra work.

// ----- Rarity tiers -----
// Order matters: checked top to bottom, first match wins.
const CARD_TIERS = {
  legendary: { key: 'legendary', label: 'Legendary', color: '#FFD166', color2: '#FFE9B0', glow: 'rgba(255,209,102,0.65)' },
  epic:      { key: 'epic',      label: 'Epic',      color: '#B983FF', color2: '#35E3C4', glow: 'rgba(185,131,255,0.55)' },
  rare:      { key: 'rare',      label: 'Rare',      color: '#35E3C4', color2: '#35E3C4', glow: 'rgba(53,227,196,0.45)' },
  common:    { key: 'common',    label: 'Common',    color: '#7C93A3', color2: '#7C93A3', glow: 'rgba(0,0,0,0)' },
};

function getPlayerTier(player) {
  const badges = player.badges || [];
  if (badges.some(b => b.startsWith('Champion'))) return CARD_TIERS.legendary;
  if (player.rank <= 10 || badges.includes('3-Edition Veteran')) return CARD_TIERS.epic;
  if (player.rank <= 50 || badges.length > 0) return CARD_TIERS.rare;
  return CARD_TIERS.common;
}

// Icon glyph shown for each badge type in the compact "many badges" layout.
const BADGE_ICONS = {
  'Perfect Record': '\u{1F3AF}',
  'Giant Killer': '\u2694\uFE0F',
  'Most Improved': '\u{1F4C8}',
  '3-Edition Veteran': '\u{1F6E1}\uFE0F',
};
function badgeIcon(name) {
  if (name.startsWith('Champion')) return '\u{1F3C6}';
  return BADGE_ICONS[name] || '\u2726';
}

function currentEditionLabel() {
  const ongoing = SITE_DATA.tournaments.find(t => t.status === 'Ongoing');
  if (ongoing) return ongoing.year;
  return SITE_DATA.tournaments.reduce((max, t) => Math.max(max, parseInt(t.year) || 0), 0);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function slugifyFileName(str) {
  return (str || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ----- small canvas helpers -----
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '\u2026').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '\u2026';
}

function loadImage(src, crossOrigin = 'anonymous') {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // never rejects — a missing image is just "no image"
    img.src = src;
  });
}

// ----- main draw routine -----
// includeRemoteImages: set to false to skip flag/avatar <img> draws entirely — used as a
// fallback pass if the export step turns out to fail because a remote image tainted the canvas.
async function drawPlayerCard(player, tier, { includeRemoteImages = true } = {}) {
  const W = 800, H = 1200, DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  await document.fonts.load('700 46px "Space Grotesk"').catch(() => {});
  await document.fonts.load('600 32px "Space Grotesk"').catch(() => {});
  await document.fonts.load('600 100px "JetBrains Mono"').catch(() => {});
  await document.fonts.load('600 20px "JetBrains Mono"').catch(() => {});
  await document.fonts.ready;

  const abyss = cssVar('--abyss') || '#060B14';
  const deep = cssVar('--deep') || '#0C1826';
  const deep2 = cssVar('--deep-2') || '#101F30';
  const surface = cssVar('--surface') || '#16283C';
  const text = cssVar('--text') || '#E8F1F5';
  const textMuted = cssVar('--text-muted') || '#7C93A3';
  const textFaint = cssVar('--text-faint') || '#4A5D6C';
  const border = cssVar('--border') || '#1C3247';
  const bioTeal = cssVar('--bio-teal') || '#35E3C4';

  // ---- background: abyssal gradient ----
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, deep2);
  bg.addColorStop(1, abyss);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- bioluminescent particle field (static snapshot of the site's ambient effect) ----
  const rng = () => Math.random();
  for (let i = 0; i < 46; i++) {
    const px = rng() * W, py = rng() * H, r = 1 + rng() * 1.8;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = bioTeal;
    ctx.globalAlpha = 0.12 + rng() * 0.28;
    ctx.shadowColor = bioTeal;
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ---- outer card border (rarity) ----
  const M = 26;
  const borderWidth = { legendary: 6, epic: 5, rare: 4, common: 2.5 }[tier.key];
  roundRectPath(ctx, M, M, W - 2 * M, H - 2 * M, 26);
  if (tier.glow !== 'rgba(0,0,0,0)') {
    ctx.save();
    ctx.shadowColor = tier.glow;
    ctx.shadowBlur = tier.key === 'legendary' ? 34 : tier.key === 'epic' ? 26 : 16;
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  const CX = M + 22; // content left
  const CW = W - 2 * (M + 22); // content width
  const CENTER = W / 2;

  // ---- header: tier chip + rank ----
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 16px "JetBrains Mono"';
  const chipLabel = tier.label.toUpperCase();
  const chipW = ctx.measureText(chipLabel).width + 34;
  roundRectPath(ctx, CX, 62, chipW, 30, 15);
  ctx.fillStyle = tier.key === 'common' ? 'rgba(124,147,163,0.12)' : `${tier.color}22`;
  ctx.fill();
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = tier.color;
  ctx.textAlign = 'left';
  ctx.fillText(chipLabel, CX + 17, 82);

  ctx.font = '600 15px "JetBrains Mono"';
  ctx.fillStyle = textFaint;
  ctx.textAlign = 'right';
  ctx.fillText(`#${player.rank} ALL-TIME`, CX + CW, 82);

  // ---- header: pseudo + flag ----
  ctx.font = '700 44px "Space Grotesk"';
  ctx.textAlign = 'left';
  ctx.fillStyle = text;
  const flagW = player.country ? 40 : 0;
  const maxNameWidth = CW - flagW - (flagW ? 14 : 0);
  const displayName = truncateToWidth(ctx, player.pseudo, maxNameWidth);
  ctx.fillText(displayName, CX, 152);

  if (includeRemoteImages && player.country) {
    const flagImg = await loadImage(flagImageUrl(player.country, 96));
    if (flagImg) {
      const nameW = ctx.measureText(displayName).width;
      const fw = 40, fh = 30;
      const fx = CX + nameW + 14, fy = 152 - fh + 6;
      ctx.save();
      roundRectPath(ctx, fx, fy, fw, fh, 4);
      ctx.clip();
      ctx.drawImage(flagImg, fx, fy, fw, fh);
      ctx.restore();
    }
  }

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CX, 182);
  ctx.lineTo(CX + CW, 182);
  ctx.stroke();

  // ---- portrait ----
  const portraitR = 128;
  const portraitCY = 182 + 30 + portraitR;
  ctx.save();
  ctx.shadowColor = tier.glow;
  ctx.shadowBlur = tier.key === 'common' ? 0 : 30;
  ctx.beginPath();
  ctx.arc(CENTER, portraitCY, portraitR + 5, 0, Math.PI * 2);
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  let avatarImg = null;
  if (includeRemoteImages && player.avatar) {
    avatarImg = await loadImage(player.avatar);
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, portraitCY, portraitR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, CENTER - portraitR, portraitCY - portraitR, portraitR * 2, portraitR * 2);
  } else {
    const pg = ctx.createLinearGradient(CENTER - portraitR, portraitCY - portraitR, CENTER + portraitR, portraitCY + portraitR);
    pg.addColorStop(0, deep);
    pg.addColorStop(1, surface);
    ctx.fillStyle = pg;
    ctx.fillRect(CENTER - portraitR, portraitCY - portraitR, portraitR * 2, portraitR * 2);
    ctx.font = '600 78px "JetBrains Mono"';
    ctx.fillStyle = bioTeal;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(player.pseudo), CENTER, portraitCY + 4);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // ---- big stat: Elo ----
  let cursorY = portraitCY + portraitR + 56;
  ctx.textAlign = 'center';
  ctx.font = '600 16px "JetBrains Mono"';
  ctx.fillStyle = textFaint;
  ctx.fillText('CURRENT ELO', CENTER, cursorY);
  cursorY += 82;
  const eloColor = (tier.key === 'legendary' || tier.key === 'epic') ? tier.color : bioTeal;
  ctx.font = '600 92px "JetBrains Mono"';
  ctx.fillStyle = eloColor;
  ctx.shadowColor = tier.key === 'common' ? 'transparent' : eloColor;
  ctx.shadowBlur = tier.key === 'common' ? 0 : 18;
  ctx.fillText(String(player.currentElo), CENTER, cursorY);
  ctx.shadowBlur = 0;

  // ---- secondary stat grid ----
  cursorY += 46;
  const stats = [
    { label: 'WINRATE', value: `${player.winrate}%` },
    { label: 'RECORD', value: `${player.wins}W\u2013${player.losses}L` },
    { label: 'BEST STREAK', value: String(player.bestWinStreak) },
    { label: 'TOURNAMENTS', value: String(player.tournamentsPlayed) },
  ];
  const gap = 16, boxW = (CW - gap) / 2, boxH = 100;
  stats.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const bx = CX + col * (boxW + gap), by = cursorY + row * (boxH + gap);
    roundRectPath(ctx, bx, by, boxW, boxH, 10);
    ctx.fillStyle = deep;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '600 13px "JetBrains Mono"';
    ctx.fillStyle = textFaint;
    ctx.fillText(s.label, bx + 18, by + 32);
    ctx.font = '700 30px "Space Grotesk"';
    ctx.fillStyle = text;
    ctx.fillText(s.value, bx + 18, by + 70);
  });
  cursorY += 2 * boxH + gap + 44;

  // ---- badge band ----
  const badges = player.badges || [];
  if (badges.length === 1) {
    const label = badges[0];
    ctx.font = '600 15px "JetBrains Mono"';
    const w = ctx.measureText(label).width + 60;
    const bx = CENTER - w / 2, by = cursorY - 24, bh = 38;
    roundRectPath(ctx, bx, by, w, bh, 19);
    ctx.fillStyle = 'rgba(53,227,196,0.08)';
    ctx.fill();
    ctx.strokeStyle = bioTeal;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = bioTeal;
    ctx.fillText(`${badgeIcon(label)}  ${label}`, CENTER, cursorY + 2);
  } else if (badges.length > 1) {
    const iconSize = 40, iconGap = 20;
    const totalW = badges.length * iconSize + (badges.length - 1) * iconGap;
    let bx = CENTER - totalW / 2 + iconSize / 2;
    badges.forEach((label) => {
      ctx.beginPath();
      ctx.arc(bx, cursorY, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(53,227,196,0.08)';
      ctx.fill();
      ctx.strokeStyle = bioTeal;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '20px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bioTeal;
      ctx.fillText(badgeIcon(label), bx, cursorY + 1);
      ctx.textBaseline = 'alphabetic';
      bx += iconSize + iconGap;
    });
  }

  // ---- footer identifier ----
  const footerY = H - M - 34;
  ctx.textAlign = 'center';
  ctx.font = '600 13px "JetBrains Mono"';
  ctx.fillStyle = textMuted;
  ctx.fillText(`DEEEEP.IO ANALYTICS \u2014 EDITION ${currentEditionLabel()}`, CENTER, footerY);

  return canvas;
}

async function buildPlayerCardCanvas(player) {
  const tier = getPlayerTier(player);
  return { canvas: await drawPlayerCard(player, tier, { includeRemoteImages: true }), tier };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')), 'image/png');
  });
}

function triggerPngDownload(blob, pseudo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyFileName(pseudo)}-card-${currentEditionLabel()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Exports a canvas as a PNG blob, falling back to a version without remote images
// (flag/avatar) if the browser refuses the export because a cross-origin image
// tainted the canvas.
async function exportCardPng(player, tier, canvas) {
  try {
    return await canvasToBlob(canvas);
  } catch (e) {
    const safeCanvas = await drawPlayerCard(player, tier, { includeRemoteImages: false });
    return await canvasToBlob(safeCanvas);
  }
}

// ----- profile-page hook: builds the tier chip + "Download card" button + preview modal -----
function initPlayerCardButton(container, player) {
  const tier = getPlayerTier(player);
  container.innerHTML = `
    <span class="card-tier-chip" style="color:${tier.color}; border-color:${tier.color};">${tier.label} card</span>
    <button class="card-download-btn" id="card-download-btn">Download card</button>
  `;
  const btn = container.querySelector('#card-download-btn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Generating…';
    try {
      const { canvas } = await buildPlayerCardCanvas(player);
      openCardModal(canvas, player, tier);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

function openCardModal(canvas, player, tier) {
  const overlay = document.createElement('div');
  overlay.className = 'card-modal-overlay';
  overlay.innerHTML = `
    <div class="card-modal">
      <button class="card-modal-close" aria-label="Close">\u00D7</button>
      <div class="card-modal-preview"></div>
      <button class="card-modal-download">\u2B07 Download PNG</button>
    </div>
  `;
  overlay.querySelector('.card-modal-preview').appendChild(canvas);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.card-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const downloadBtn = overlay.querySelector('.card-modal-download');
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Preparing…';
    try {
      const blob = await exportCardPng(player, tier, canvas);
      triggerPngDownload(blob, player.pseudo);
      downloadBtn.textContent = '\u2713 Downloaded';
    } catch (e) {
      downloadBtn.textContent = 'Download failed';
    } finally {
      setTimeout(() => { downloadBtn.disabled = false; downloadBtn.textContent = '\u2B07 Download PNG'; }, 1800);
    }
  });
}
