const VIEW_COUNT_KEY = 'compliment_view_count';
const VISITOR_COUNT_KEY = 'visitor_count';
const RANDOM_BODY_BACKGROUND_KEY = '--bg-body-pastel';
const ACTIVE_BODY_BACKGROUND_KEY = '--bg-body-current';
const COMPLIMENT_HISTORY_KEY = 'compliment_history';
const COMPLIMENT_HISTORY_LIMIT = 5;
const PERSONAL_COMPLIMENTS_KEY = 'personal_compliments';
const COMPLIMENT_RATINGS_KEY   = 'compliment_ratings';
const RATING_WEIGHTS = { 1: 0.5, 2: 0.75, 3: 1, 4: 2, 5: 3 };
const DEFAULT_WEIGHT = 1;

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
let currentComplimentKey = null;
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
  attachStarRating();
  attachAddComplimentForm();
  attachCollectionToggle();
  attachExportImport();
}

const COMPLIMENT_FADE_MS = 350;

function setComplimentText(text) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('compliment');
  if (!el) return;

  const win = typeof window !== 'undefined' ? window : null;
  const reduceMotion = !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canTransition = !!(
    win &&
    typeof win.setTimeout === 'function' &&
    el.style &&
    typeof el.addEventListener === 'function'
  );

  if (reduceMotion || !canTransition) {
    el.textContent = text;
    if (el.style) el.style.opacity = '';
    return;
  }

  // Defer the swap until the fade-out transition has actually completed,
  // not on the next animation frame. transitionend fires when opacity hits 0;
  // the setTimeout is a safety net in case transitionend never fires
  // (e.g. element detached, transition cancelled).
  let swapped = false;
  const swap = () => {
    if (swapped) return;
    swapped = true;
    if (typeof el.removeEventListener === 'function') {
      el.removeEventListener('transitionend', onEnd);
    }
    el.textContent = text;
    el.style.opacity = '1';
  };
  const onEnd = (event) => {
    if (event && event.propertyName && event.propertyName !== 'opacity') return;
    swap();
  };

  el.addEventListener('transitionend', onEnd);
  el.style.opacity = '0';

  win.setTimeout(swap, COMPLIMENT_FADE_MS + 50);
}

function pickRandom(celebrate = false) {
  const pool = buildComplimentPool();
  if (pool.length === 0) return;

  const chosen = pickWeighted(pool, currentComplimentKey);
  const previousKey = currentComplimentKey;
  currentComplimentKey = chosen.key;

  // Keep currentIndex in sync for built-in share links
  currentIndex = (chosen.sourceIndex !== undefined) ? chosen.sourceIndex : null;

  setComplimentText(chosen.text);
  renderStarRating(getRatings()[chosen.key] || 0);
  incrementViewCount();
  updateViewCountDisplay();
  recordComplimentInHistory(chosen.text);
  renderComplimentHistory();

  if (celebrate && chosen.key !== previousKey) {
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

function getLocalStorageStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { return null; }
  return null;
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
}

function getComplimentHistory() {
  const store = getSessionStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(COMPLIMENT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => {
      if (typeof item === 'string') return { text: item, timestamp: Date.now() };
      if (item && typeof item.text === 'string' && typeof item.timestamp === 'number') return item;
      return null;
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function recordComplimentInHistory(text) {
  const store = getSessionStorage();
  if (!store || typeof text !== 'string') return;
  const history = getComplimentHistory();
  history.unshift({ text, timestamp: Date.now() });
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

  for (const entry of history) {
    const item = document.createElement('li');
    item.className = 'compliment-history-item';

    const textEl = document.createElement('span');
    textEl.className = 'compliment-history-text';
    textEl.textContent = entry.text;

    const timeEl = document.createElement('span');
    timeEl.className = 'compliment-history-time';
    timeEl.textContent = formatRelativeTime(entry.timestamp);

    item.appendChild(textEl);
    item.appendChild(timeEl);
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
  if (currentIndex === null) {
    showFeedback("Personal compliments can't be shared via link — try copying the text directly.");
    return;
  }
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
  [
    'new-compliment-btn', 'spacebar-hint', 'recipient-name', 'share-btn',
    'share-feedback', 'star-rating', 'add-compliment-toggle',
    'add-compliment-form', 'collection-toggle', 'collection-panel'
  ].forEach(id => {
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

// --- Personal compliment data access ---

function getPersonalCompliments() {
  const store = getLocalStorageStore();
  if (!store) return [];
  try {
    const raw = store.getItem(PERSONAL_COMPLIMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      p => p && typeof p.id === 'string' && typeof p.text === 'string'
    );
  } catch (e) { return []; }
}

function savePersonalCompliments(arr) {
  const store = getLocalStorageStore();
  if (!store) return;
  try { store.setItem(PERSONAL_COMPLIMENTS_KEY, JSON.stringify(arr)); } catch (e) {}
}

function getRatings() {
  const store = getLocalStorageStore();
  if (!store) return {};
  try {
    const raw = store.getItem(COMPLIMENT_RATINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (e) { return {}; }
}

function saveRatings(obj) {
  const store = getLocalStorageStore();
  if (!store) return;
  try { store.setItem(COMPLIMENT_RATINGS_KEY, JSON.stringify(obj)); } catch (e) {}
}

// --- Weighted pool selection ---

function buildComplimentPool() {
  const personal = getPersonalCompliments();
  const ratings = getRatings();
  const pool = [];

  COMPLIMENTS.forEach((text, idx) => {
    const key = `builtin_${idx}`;
    const weight = RATING_WEIGHTS[ratings[key]] ?? DEFAULT_WEIGHT;
    pool.push({ text, key, sourceIndex: idx, weight });
  });

  personal.forEach(item => {
    const key = `personal_${item.id}`;
    const weight = RATING_WEIGHTS[ratings[key]] ?? DEFAULT_WEIGHT;
    pool.push({ text: item.text, key, id: item.id, weight });
  });

  return pool;
}

function pickWeighted(pool, excludeKey) {
  let candidates = pool.filter(c => c.key !== excludeKey);
  if (candidates.length === 0) candidates = pool;
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// --- Star rating ---

function renderStarRating(currentRating) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('star-rating');
  if (!container) return;
  container.removeAttribute('hidden');
  const stars = container.querySelectorAll('.star');
  stars.forEach((star, i) => {
    const filled = i < currentRating;
    star.classList.toggle('star-active', filled);
    star.setAttribute('aria-pressed', filled ? 'true' : 'false');
  });
}

function attachStarRating() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('star-rating');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    const value = parseInt(star.dataset.value, 10);
    if (!isNaN(value) && currentComplimentKey) {
      rateCurrentCompliment(value);
    }
  });
}

function rateCurrentCompliment(stars) {
  if (!currentComplimentKey) return;
  const ratings = getRatings();
  ratings[currentComplimentKey] = stars;
  saveRatings(ratings);
  renderStarRating(stars);
}

// --- Personal compliment management ---

function addPersonalCompliment(text) {
  if (!text || typeof text !== 'string') return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const personal = getPersonalCompliments();
  const id = String(Date.now());
  personal.push({ id, text: trimmed, createdAt: Date.now() });
  savePersonalCompliments(personal);
}

function deletePersonalCompliment(id) {
  const personal = getPersonalCompliments().filter(p => p.id !== id);
  savePersonalCompliments(personal);
  const ratings = getRatings();
  delete ratings[`personal_${id}`];
  saveRatings(ratings);
  renderCollectionPanel();
}

// --- Collection panel ---

function renderCollectionPanel() {
  if (typeof document === 'undefined') return;
  const list = document.getElementById('collection-list');
  if (!list) return;

  while (list.firstChild) list.removeChild(list.firstChild);

  const personal = getPersonalCompliments();

  if (personal.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'collection-empty';
    empty.textContent = "No personal compliments yet. Use 'Add Your Own' to get started.";
    list.appendChild(empty);
    return;
  }

  const ratings = getRatings();
  personal.forEach(item => {
    const key = `personal_${item.id}`;
    const rating = ratings[key] || 0;

    const entry = document.createElement('div');
    entry.className = 'collection-item';

    const textEl = document.createElement('p');
    textEl.className = 'collection-item-text';
    textEl.textContent = item.text;

    const starsEl = document.createElement('span');
    starsEl.className = 'collection-item-stars';
    starsEl.textContent = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'Not rated';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'collection-item-delete';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Remove';
    deleteBtn.addEventListener('click', () => deletePersonalCompliment(item.id));

    entry.appendChild(textEl);
    entry.appendChild(starsEl);
    entry.appendChild(deleteBtn);
    list.appendChild(entry);
  });
}

function toggleCollectionPanel() {
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('collection-panel');
  if (!panel) return;
  if (panel.hasAttribute('hidden')) {
    renderCollectionPanel();
    panel.removeAttribute('hidden');
  } else {
    panel.setAttribute('hidden', '');
  }
}

// --- Export / import ---

function exportCollection() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    personalCompliments: getPersonalCompliments(),
    ratings: getRatings()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-compliments.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data.version !== 1) return false;
  if (!Array.isArray(data.personalCompliments)) return false;
  if (!data.ratings || typeof data.ratings !== 'object' || Array.isArray(data.ratings)) return false;
  for (const p of data.personalCompliments) {
    if (!p || typeof p.id !== 'string' || typeof p.text !== 'string') return false;
  }
  for (const [, val] of Object.entries(data.ratings)) {
    if (typeof val !== 'number' || val < 1 || val > 5 || !Number.isInteger(val)) return false;
  }
  return true;
}

function mergeCollection(data) {
  const existing = getPersonalCompliments();
  const existingIds = new Set(existing.map(p => p.id));
  const incoming = data.personalCompliments.filter(p => !existingIds.has(p.id));
  savePersonalCompliments([...existing, ...incoming]);

  // Existing user ratings take priority over imported ratings on key conflict
  const existingRatings = getRatings();
  const merged = Object.assign({}, data.ratings, existingRatings);
  saveRatings(merged);
}

function importCollection(file) {
  if (typeof FileReader === 'undefined') {
    showFeedback('File import is not supported in this browser.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showFeedback('Could not read the file — invalid JSON.');
      return;
    }
    if (!validateImport(data)) {
      showFeedback('Invalid collection file format.');
      return;
    }
    mergeCollection(data);
    renderCollectionPanel();
    const count = data.personalCompliments.length;
    showFeedback(`Imported ${count} personal compliment${count === 1 ? '' : 's'}.`);
  };
  reader.onerror = () => { showFeedback('Failed to read the file.'); };
  reader.readAsText(file);
}

// --- UI attachment helpers ---

function attachAddComplimentForm() {
  if (typeof document === 'undefined') return;
  const toggle = document.getElementById('add-compliment-toggle');
  const form = document.getElementById('add-compliment-form');
  const submit = document.getElementById('add-compliment-submit');
  const textarea = document.getElementById('add-compliment-text');
  if (!toggle || !form || !submit || !textarea) return;

  toggle.addEventListener('click', () => {
    if (form.hasAttribute('hidden')) {
      form.removeAttribute('hidden');
      textarea.focus();
    } else {
      form.setAttribute('hidden', '');
    }
  });

  submit.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;
    addPersonalCompliment(text);
    textarea.value = '';
    form.setAttribute('hidden', '');
    showFeedback('Compliment added to your collection!');
  });
}

function attachCollectionToggle() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('collection-toggle');
  if (btn) btn.addEventListener('click', toggleCollectionPanel);
}

function attachExportImport() {
  if (typeof document === 'undefined') return;
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importInput = document.getElementById('import-input');
  if (exportBtn) exportBtn.addEventListener('click', exportCollection);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importCollection(file);
      e.target.value = '';
    });
  }
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
    formatRelativeTime,
    getComplimentHistory,
    recordComplimentInHistory,
    renderComplimentHistory,
    COMPLIMENTS,
    buildComplimentPool,
    pickWeighted,
    getPersonalCompliments,
    savePersonalCompliments,
    getRatings,
    saveRatings,
    addPersonalCompliment,
    deletePersonalCompliment,
    rateCurrentCompliment,
    renderCollectionPanel,
    validateImport,
    mergeCollection,
  };
}
