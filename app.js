const VIEW_COUNT_KEY = 'compliment_view_count';
const RANDOM_BODY_BACKGROUND_KEY = '--bg-body-pastel';
const ACTIVE_BODY_BACKGROUND_KEY = '--bg-body-current';

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
  document.getElementById('new-compliment-btn').addEventListener('click', pickRandom);
  document.getElementById('share-btn').addEventListener('click', handleShare);
  attachSpacebarShortcut();
}

function pickRandom() {
  const next = Math.floor(Math.random() * COMPLIMENTS.length);
  currentIndex = next;
  document.getElementById('compliment').textContent = COMPLIMENTS[currentIndex];
  incrementViewCount();
  updateViewCountDisplay();
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
    document.getElementById('compliment').textContent =
      "This link doesn't seem right — try generating a new compliment.";
    hideInteractiveControls();
    return;
  }

  document.getElementById('compliment').textContent = COMPLIMENTS[index];
  incrementViewCount();
  updateViewCountDisplay();

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
    pickRandom();
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

if (typeof module !== 'undefined') {
  module.exports = {
    applyRandomBackgroundColor,
    attachSpacebarShortcut,
    generateRandomPastelColor,
    shouldHandleSpacebarShortcut,
    pickRandom,
    renderInteractiveView,
    COMPLIMENTS
  };
}
