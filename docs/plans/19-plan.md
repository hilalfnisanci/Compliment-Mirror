# Plan: Add Shareable Compliment Cards (#19)

## Problem Statement

Compliment Mirror has a styled landing page with a compliment card placeholder, but no JavaScript implementation and no way to share a compliment with another person. This plan covers everything needed to make the compliment flow fully interactive and shareable, using only frontend code (no backend required).

## Proposed Approach

Implement the entire feature in a single JavaScript file (`app.js`) with minimal updates to `index.html` and `styles.css`. The share mechanism encodes the compliment index and optional recipient name as URL query parameters (`?to=Alice&c=3`). When a visitor opens a shared link, the page detects those parameters and renders a read-only "shared" view instead of the normal interactive view.

No build tool, framework, or server is needed. The existing file structure stays the same: `index.html`, `styles.css`, and the new `app.js`.

## Technical Design

### URL Scheme

```
# Normal view (no params)
https://example.com/

# Shared view
https://example.com/?to=Alice&c=3
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `c` | integer (0-based index) | Which compliment from the array to display |
| `to` | string (URL-encoded) | Optional recipient name |

Using an index keeps URLs short and clean. The compliment array must be treated as append-only once deployed — existing indices must not change or shared links will break.

### New File: `app.js`

```js
// Data
const COMPLIMENTS = [ /* 25 entries */ ];

// State
let currentIndex = null;

// On load
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('c')) {
    renderSharedView(params);
  } else {
    renderInteractiveView();
  }
});

// Interactive view
function renderInteractiveView() { ... }
function pickRandom() { ... }          // sets currentIndex, updates #compliment
function handleShare() { ... }         // reads name input, builds URL, copies to clipboard

// Shared view
function renderSharedView(params) { ... }  // reads c + to, shows static card
```

Full function signatures are detailed in the Implementation Steps below.

### `index.html` Changes

Add three new elements inside `.container`, after the existing button:

1. `<input type="text" id="recipient-name" placeholder="Add a name (optional)">` — recipient personalisation field
2. `<button class="btn" id="share-btn">Share this compliment</button>` — triggers link generation
3. `<p class="share-feedback" id="share-feedback" aria-live="polite"></p>` — shows "Link copied!" confirmation

In the `<head>`, add `<script src="app.js" defer></script>`.

The existing `#compliment` element and `#new-compliment-btn` button remain unchanged in the markup; JavaScript controls their visibility for the shared view.

### `styles.css` Changes

Add styles for:

- `#recipient-name` input — matches existing button aesthetics (same width, border, border-radius)
- `#share-btn` — uses a secondary style (outlined, not filled) to visually distinguish from "New Compliment"
- `.share-feedback` — small, muted confirmation text
- `.shared-view` body class (added by JS) — hides interactive controls, centres the card with extra whitespace for a clean read-only presentation
- `.shared-header` — "This compliment was made for [name]" label shown only in shared view

## Implementation Steps

Follow this order. Each step is independently testable before moving to the next.

### Step 1 — Create `app.js` with compliment data and basic display

Create `/app.js` with:

```js
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
```

### Step 2 — Implement interactive view

Add to `app.js`:

```js
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
```

At this point the "New Compliment" button must work — open `index.html` directly in a browser and verify.

### Step 3 — Update `index.html`

Inside `.container`, after `<button class="btn" id="new-compliment-btn">`:

```html
<input
  type="text"
  id="recipient-name"
  placeholder="Add a name (optional)"
  maxlength="60"
  autocomplete="off"
/>
<button class="btn btn-secondary" id="share-btn">Share this compliment</button>
<p class="share-feedback" id="share-feedback" aria-live="polite"></p>
```

In `<head>`:
```html
<script src="app.js" defer></script>
```

### Step 4 — Implement share link generation

Add to `app.js`:

```js
function handleShare() {
  const name = document.getElementById('recipient-name').value.trim();
  const params = new URLSearchParams({ c: currentIndex });
  if (name) params.set('to', name);

  const url = `${location.origin}${location.pathname}?${params}`;

  navigator.clipboard.writeText(url).then(() => {
    showFeedback('Link copied to clipboard!');
  }).catch(() => {
    // Fallback for environments where clipboard API is unavailable
    showFeedback(`Share this link: ${url}`);
  });
}

function showFeedback(message) {
  const el = document.getElementById('share-feedback');
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, 4000);
}
```

Manual test: click "Share this compliment" and verify a URL like `?c=7` is copied to clipboard.

### Step 5 — Implement shared view rendering

Add to `app.js`:

```js
function renderSharedView(params) {
  const index = parseInt(params.get('c'), 10);
  const name = params.get('to') || null;

  // Guard against invalid index
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
```

### Step 6 — Add CSS for new elements

Append to `styles.css`:

```css
/* Recipient name input */
#recipient-name {
  width: 100%;
  padding: 10px 14px;
  margin-top: 12px;
  font-family: Georgia, serif;
  font-size: 1rem;
  color: #2c2c2c;
  background: #fff;
  border: 1px solid #e0ddd8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}

#recipient-name:focus {
  border-color: #aaa;
}

/* Secondary / outlined button */
.btn-secondary {
  background: transparent;
  color: #2c2c2c;
  border: 1px solid #2c2c2c;
  margin-top: 10px;
}

.btn-secondary:hover {
  background: #f0ede8;
}

/* Share feedback message */
.share-feedback {
  font-size: 0.875rem;
  color: #555;
  margin-top: 8px;
  min-height: 1.4em;
}

/* Shared-view overrides */
.shared-view .container {
  padding: 60px 24px;
}

.shared-header {
  font-size: 0.875rem;
  color: #777;
  margin-bottom: 12px;
  font-style: normal;
}
```

Also update the existing `.btn` rule to add `margin-top: 16px` so the spacing remains consistent with the new elements.

## Testing Strategy

### Manual test checklist

| Scenario | Steps | Expected result |
|----------|-------|-----------------|
| Basic display | Open `index.html` directly | Compliment appears on load |
| Regenerate | Click "New Compliment" | Different compliment appears |
| With name | Enter "Alice", click "Share" | URL includes `to=Alice&c=N` |
| Without name | Leave name empty, click "Share" | URL includes only `c=N` |
| Open shared link | Open `?to=Alice&c=3` | Correct compliment shown, "made for Alice" header visible, interactive controls hidden |
| Open shared link (no name) | Open `?c=5` | Correct compliment shown, no "made for" header |
| Invalid index | Open `?c=9999` | Graceful error message shown |
| Missing `c` | Open `?to=Alice` (no `c`) | Falls through to interactive view |
| Clipboard unavailable | Block clipboard API in DevTools | Fallback: link displayed in feedback text |
| Long name | Enter 60-char name, share | URL encodes properly, renders correctly |

### No automated test framework is in scope

The project has no test runner. All testing is manual, done by opening `index.html` directly in a browser (file:// protocol) and via a local HTTP server (e.g. `python3 -m http.server`) to verify clipboard API access.

## Risks and Open Questions

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Shared links break if compliment array order changes | Low (array is append-only) | Document in code: "Do not reorder or delete entries — this breaks existing shared links." |
| Clipboard API not available on `file://` protocol | Medium | Fallback implemented in Step 4: display link as text |
| Recipient name containing special characters | Low | `URLSearchParams` handles encoding automatically |
| Compliment text too long for mobile card | Low | `.compliment-box` already has `min-height`; text will wrap naturally |

**Open question:** Should the page title change in shared view (e.g. "A compliment for Alice")? This is a nice touch but not required by the issue. Left for the implementing engineer to decide.

## Success Criteria

- [ ] Opening `index.html` with no URL params shows an interactive view: a compliment on load, a working "New Compliment" button, a name input, and a share button.
- [ ] Clicking "Share this compliment" copies a URL containing the compliment index (and optional name) to the clipboard.
- [ ] Opening a shared URL renders only the compliment card (and optional recipient header); all interactive controls are hidden.
- [ ] An invalid or out-of-range `c` parameter shows a graceful error message instead of crashing.
- [ ] All new elements are styled consistently with the existing design system (Georgia font, `#2c2c2c` palette, 8px border-radius).
- [ ] No external dependencies, build tools, or backend are introduced.
