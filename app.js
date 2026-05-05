const VIEW_COUNT_KEY = 'compliment_view_count';
const VISITOR_COUNT_KEY = 'visitor_count';
const RANDOM_BODY_BACKGROUND_KEY = '--bg-body-pastel';
const ACTIVE_BODY_BACKGROUND_KEY = '--bg-body-current';
const COMPLIMENT_HISTORY_KEY = 'compliment_history';
const COMPLIMENT_HISTORY_LIMIT = 5;

// Do not reorder or delete entries — this breaks existing shared links.
const COMPLIMENTS = [
  "You make the people around you feel seen.",
  "Your curiosity is genuinely contagious.",
  "You handle hard things with real grace.",
  "The world is a little warmer because you're in it.",
  "You notice things most people miss.",
  "Your kindness lands — people remember it.",
  "You bring calm into rooms that need it.",
  "The way you listen is a gift.",
  "You have a talent for making hard things feel possible.",
  "You show up, and that matters more than you know.",
  "Your honesty is rare and genuinely appreciated.",
  "You have excellent instincts.",
  "You make ordinary moments feel worth paying attention to.",
  "You are more capable than you give yourself credit for.",
  "Your perspective adds something no one else can.",
  "You are someone people feel safe around.",
  "You ask the right questions.",
  "The effort you put in doesn't go unnoticed.",
  "You carry yourself with a quiet confidence that's inspiring.",
  "You are exactly the kind of person this world needs more of.",
  "Your creativity is one of your best features.",
  "You have a way of making complicated things feel simple.",
  "People feel better after talking to you.",
  "You are thoughtful in a way that is genuinely rare.",
  "You deserve every good thing coming your way."
];

let currentIndex = null;
let shortcutHandler = null;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    applyRandomBackgroundColor();
    attachThemeToggle();
    incrementVisitorCount();
    updateVisitorCountDisplay();
    const params = new URLSearchParams(window.location.search);
    if (params.has('c')) {
      renderSharedView(params);
    } else {
      renderInteractiveView();
    }
  });
}

function generateRandomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.floor(Math.random() * 16);
  const lightness = 84 + Math.floor(Math.random() * 10);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function applyRandomBackgroundColor(doc = document) {
  if (!doc || !doc.documentElement || !doc.documentElement.style || !doc.body || !doc.body.style) {
    return null;
  }

  const color = generateRandomPastelColor();
  doc.documentElement.style.setProperty(RANDOM_BODY_BACKGROUND_KEY, color);
  syncBackgroundColor(doc);
  doc.body.style.backgroundColor = color;
  return color;
}

function syncBackgroundColor(doc = document) {
  if (!doc || !doc.documentElement || !doc.documentElement.style) {
    return;
  }

  if (doc.body && doc.body.style) {
    doc.body.style.backgroundColor = '';
  }

  const theme = doc.documentElement.getAttribute('data-theme');
  const activeColor = theme === 'dark'
    ? 'var(--bg-body)'
    : `var(${RANDOM_BODY_BACKGROUND_KEY}, var(--bg-body))`;

  doc.documentElement.style.setProperty(ACTIVE_BODY_BACKGROUND_KEY, activeColor);
}

function attachThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const initial = document.documentElement.getAttribute('data-theme');
  btn.setAttribute('aria-label', initial === 'dark' ? 'Toggle light mode' : 'Toggle dark mode');

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    syncBackgroundColor();
    btn.setAttribute('aria-label', next === 'dark' ? 'Toggle light mode' : 'Toggle dark mode');
  });
}

function renderInteractiveView() {
  pickRandom();
  document.getElementById('new-compliment-btn').addEventListener('click', () => pickRandom(true));
  document.getElementById('share-btn').addEventListener('click', handleShare);
  attachSpacebarShortcut();
}

function setComplimentText(text) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('compliment');
  if (!el) return;

  const win = typeof window !== 'undefined' ? window : null;
  const raf = win && typeof win.requestAnimationFrame === 'function'
    ? win.requestAnimationFrame.bind(win)
    : null;
  const reduceMotion = !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!raf || reduceMotion || !el.style) {
    el.textContent = text;
    if (el.style) el.style.opacity = '';
    return;
  }

  el.style.opacity = '0';
  raf(() => {
    el.textContent = text;
    raf(() => {
      el.style.opacity = '1';
    });
  });
}

function pickRandom(celebrate = false) {
  const previousIndex = currentIndex;
  const next = Math.floor(Math.random() * COMPLIMENTS.length);
  currentIndex = next;
  const text = COMPLIMENTS[currentIndex];
  setComplimentText(text);
  incrementViewCount();
  updateViewCountDisplay();
  recordComplimentInHistory(text);
  renderComplimentHistory();
  if (celebrate && next !== previousIndex) {
    triggerConfetti();
  }
}

function getSessionStorage() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch (e) {
    return null;
  }
  return null;
}

function getComplimentHistory() {
  const store = getSessionStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(COMPLIMENT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch (e) {
    return [];
  }
}

function recordComplimentInHistory(text) {
  const store = getSessionStorage();
  if (!store || typeof text !== 'string') return;
  const history = getComplimentHistory();
  history.unshift(text);
  if (history.length > COMPLIMENT_HISTORY_LIMIT) {
    history.length = COMPLIMENT_HISTORY_LIMIT;
  }
  try {
    store.setItem(COMPLIMENT_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // ignore quota / serialization failures
  }
}

function renderComplimentHistory() {
  if (typeof document === 'undefined') return;
  const list = document.getElementById('compliment-history-list');
  const section = document.getElementById('compliment-history');
  if (!list) return;
  const history = getComplimentHistory();

  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  for (const text of history) {
    const item = document.createElement('li');
    item.className = 'compliment-history-item';
    item.textContent = text;
    list.appendChild(item);
  }

  if (section) {
    if (history.length === 0) {
      section.setAttribute('hidden', '');
    } else {
      section.removeAttribute('hidden');
    }
  }
}

function incrementViewCount() {
  const count = (parseInt(localStorage.getItem(VIEW_COUNT_KEY) || '0', 10)) + 1;
  localStorage.setItem(VIEW_COUNT_KEY, count);
}

function updateViewCountDisplay() {
  const count = parseInt(localStorage.getItem(VIEW_COUNT_KEY) || '0', 10);
  const el = document.getElementById('view-count');
  if (el) {
    el.textContent = `This compliment has brightened ${count} day${count === 1 ? '' : 's'}`;
  }
}

function incrementVisitorCount() {
  const count = (parseInt(localStorage.getItem(VISITOR_COUNT_KEY) || '0', 10)) + 1;
  localStorage.setItem(VISITOR_COUNT_KEY, count);
}

function updateVisitorCountDisplay() {
  const count = parseInt(localStorage.getItem(VISITOR_COUNT_KEY) || '0', 10);
  const el = document.getElementById('visitor-counter');
  if (el) {
    el.textContent = `You've visited ${count} time${count === 1 ? '' : 's'}`;
  }
}

function handleShare() {
  const name = document.getElementById('recipient-name').value.trim();
  const params = new URLSearchParams({ c: currentIndex });
  if (name) params.set('to', name);

  // location.origin returns "null" for file:// (opaque origins); split href instead
  const base = location.href.split('?')[0];
  const url = `${base}?${params}`;

  navigator.clipboard.writeText(url).then(() => {
    showFeedback('Link copied to clipboard!');
  }).catch(() => {
    showFeedback(`Share this link: ${url}`);
  });
}

function showFeedback(message) {
  const el = document.getElementById('share-feedback');
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

function renderSharedView(params) {
  const index = parseInt(params.get('c'), 10);
  const name = params.get('to') || null;

  if (isNaN(index) || index < 0 || index >= COMPLIMENTS.length) {
    setComplimentText("This link doesn't seem right — try generating a new compliment.");
    hideInteractiveControls();
    return;
  }

  const sharedText = COMPLIMENTS[index];
  setComplimentText(sharedText);
  incrementViewCount();
  updateViewCountDisplay();
  recordComplimentInHistory(sharedText);
  renderComplimentHistory();

  if (name) {
    const header = document.createElement('p');
    header.className = 'shared-header';
    header.textContent = `This compliment was made for ${name}`;
    document.querySelector('.compliment-box').prepend(header);
  }

  hideInteractiveControls();
  document.body.classList.add('shared-view');
}

function hideInteractiveControls() {
  ['new-compliment-btn', 'spacebar-hint', 'recipient-name', 'share-btn', 'share-feedback']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

function attachSpacebarShortcut() {
  if (shortcutHandler) {
    document.removeEventListener('keydown', shortcutHandler);
  }

  shortcutHandler = (event) => {
    if (!shouldHandleSpacebarShortcut(event)) {
      return;
    }

    event.preventDefault();
    pickRandom(true);
  };

  document.addEventListener('keydown', shortcutHandler);
}

function shouldHandleSpacebarShortcut(event) {
  // Keep one DOM-aware guard path so focused controls and editable regions behave consistently.
  if (!event || (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space')) {
    return false;
  }

  const target = event.target;
  if (!target || typeof target !== 'object') {
    return true;
  }

  const tagName = target.tagName ? target.tagName.toUpperCase() : '';
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName)) {
    return false;
  }

  if (target.isContentEditable) {
    return false;
  }

  return true;
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c780fa', '#ff9f68'];

function triggerConfetti() {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;

  const win = typeof window !== 'undefined' ? window : null;
  if (win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = (win && win.devicePixelRatio) || 1;
  const width = (win && win.innerWidth) || canvas.clientWidth || 800;
  const height = (win && win.innerHeight) || canvas.clientHeight || 600;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particleCount = 80;
  const originX = width / 2;
  const originY = height / 2;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 5;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 5 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 1
    });
  }

  const gravity = 0.18;
  const drag = 0.985;
  const fadeStart = 40;
  let frame = 0;

  const raf = (win && win.requestAnimationFrame) || ((cb) => setTimeout(() => cb(Date.now()), 16));

  function step() {
    frame++;
    ctx.clearRect(0, 0, width, height);
    let alive = false;
    for (const p of particles) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      if (frame > fadeStart) p.life -= 0.02;
      if (p.life <= 0 || p.y > height + 50) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive && frame < 200) {
      raf(step);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }

  raf(step);
}

if (typeof module !== 'undefined') {
  module.exports = {
    applyRandomBackgroundColor,
    attachSpacebarShortcut,
    generateRandomPastelColor,
    incrementVisitorCount,
    updateVisitorCountDisplay,
    shouldHandleSpacebarShortcut,
    pickRandom,
    setComplimentText,
    renderInteractiveView,
    triggerConfetti,
    getComplimentHistory,
    recordComplimentInHistory,
    renderComplimentHistory,
    COMPLIMENTS
  };
}
