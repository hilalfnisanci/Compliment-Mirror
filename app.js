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

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('c')) {
    renderSharedView(params);
  } else {
    renderInteractiveView();
  }
});

function renderInteractiveView() {
  pickRandom();
  document.getElementById('new-compliment-btn').addEventListener('click', pickRandom);
  document.getElementById('share-btn').addEventListener('click', handleShare);
}

function pickRandom() {
  const next = Math.floor(Math.random() * COMPLIMENTS.length);
  currentIndex = next;
  document.getElementById('compliment').textContent = COMPLIMENTS[currentIndex];
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
  ['new-compliment-btn', 'recipient-name', 'share-btn', 'share-feedback']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}
