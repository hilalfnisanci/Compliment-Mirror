# Plan: Personal Compliment Collection (#49)

## Summary

Add a personal compliment collection to Compliment Mirror: users can contribute custom compliments, rate any compliment (1–5 stars), browse and manage their collection, and export/import as JSON. The random picker gains a weighted selection algorithm that favors higher-rated compliments. All data lives in localStorage; the existing shared-link flow is fully preserved.

---

## Scope and Assumptions

**In scope:**
- Custom compliment creation (per-session localStorage)
- 1–5 star rating for any shown compliment (built-in or personal)
- Weighted random selection proportional to rating
- "My Collection" panel listing personal compliments (view + delete)
- Export to JSON file, import/merge from JSON file
- Graceful degradation if localStorage is unavailable

**Out of scope:**
- Sharing personal compliments via URL (indices map to built-ins only; personal compliments cannot be encoded into the `?c=` parameter without backend storage)
- Editing existing personal compliment text after creation
- Limiting/paginating the personal collection

**Assumptions:**
- `COMPLIMENTS` array remains append-only (indices must not change)
- Personal compliment IDs are string timestamps (`String(Date.now())`) — sufficient for local uniqueness
- Export format is versioned (version: 1) for forward-compatibility
- Import on conflict: existing user ratings take priority over imported ratings

---

## Affected Areas

| File | Nature of change |
|------|-----------------|
| `app.js` | Major: new constants, data functions, modified `pickRandom`, new UI attachment functions |
| `index.html` | Add star rating widget, "Add Your Own" form, "My Collection" panel, hidden file input |
| `styles.css` | New rules for stars, add-compliment form, collection panel |
| `test/app.test.js` | New tests for all new functions; update `createDocument` mock and `createLocalStorage` to include new elements |

---

## Technical Design

### Storage Keys

```js
const PERSONAL_COMPLIMENTS_KEY = 'personal_compliments'; // JSON array
const COMPLIMENT_RATINGS_KEY   = 'compliment_ratings';   // JSON object
```

### Personal Compliment Schema

```js
// Stored in localStorage under PERSONAL_COMPLIMENTS_KEY
// Array of:
{ id: string, text: string, createdAt: number }
// Example: { id: "1716825600000", text: "You light up the room.", createdAt: 1716825600000 }
```

### Ratings Schema

```js
// Stored in localStorage under COMPLIMENT_RATINGS_KEY
// Keys:
//   "builtin_N"    — for COMPLIMENTS[N] (0-based)
//   "personal_ID"  — for a personal compliment with that id
// Values: integer 1..5
{ "builtin_3": 5, "builtin_7": 4, "personal_1716825600000": 3 }
```

### Export/Import Schema

```js
{
  version: 1,
  exportedAt: "2026-05-15T15:00:00.000Z",   // ISO string
  personalCompliments: [ { id, text, createdAt }, ... ],
  ratings: { "builtin_3": 5, ... }
}
```

### State Variables

The existing `currentIndex` (integer, for built-in share links) is retained. A new tracking variable `currentComplimentKey` records what is currently shown:

```js
let currentIndex = null;          // integer ≥ 0 for built-ins, null for personal
let currentComplimentKey = null;  // "builtin_N" or "personal_ID"
```

### Weighted Selection Algorithm

Rating → weight mapping:

| Rating | Weight |
|--------|--------|
| unrated | 1 |
| 1 ★ | 0.5 |
| 2 ★ | 0.75 |
| 3 ★ | 1 |
| 4 ★ | 2 |
| 5 ★ | 3 |

Constant declaration:
```js
const RATING_WEIGHTS = { 1: 0.5, 2: 0.75, 3: 1, 4: 2, 5: 3 };
const DEFAULT_WEIGHT = 1;
```

Algorithm (replaces the do-while retry loop in `pickRandom`):

```js
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
  return candidates[candidates.length - 1]; // safety fallback
}
```

**Backward-compatibility note**: When no personal compliments exist and nothing is rated, all weights are 1 (= `DEFAULT_WEIGHT`). The weighted scan with uniform weights is statistically equivalent to the old `Math.floor(Math.random() * N)` approach. Existing tests that fix `Math.random` and inspect the resulting compliment will still pass (verified by tracing the algorithm against the test sequences — see Risks section).

---

## Implementation Steps

### Step 1 — Add localStorage wrapper and storage constants

In `app.js`, above the existing constants, add:

```js
const PERSONAL_COMPLIMENTS_KEY = 'personal_compliments';
const COMPLIMENT_RATINGS_KEY   = 'compliment_ratings';
const RATING_WEIGHTS = { 1: 0.5, 2: 0.75, 3: 1, 4: 2, 5: 3 };
const DEFAULT_WEIGHT = 1;
```

Add a localStorage safety wrapper (mirroring the existing `getSessionStorage()`):

```js
function getLocalStorageStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { return null; }
  return null;
}
```

> Note: Do not rename the existing direct `localStorage` calls for the view/visitor counters — that would risk regressions. Only the new personal-data functions use the wrapper.

### Step 2 — Add data access functions

Append to `app.js`:

```js
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
```

### Step 3 — Add `buildComplimentPool()` and `pickWeighted()`

Append to `app.js`:

```js
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
```

### Step 4 — Update `pickRandom()` to use weighted selection

Add new state variable immediately after the existing `let currentIndex = null;`:

```js
let currentComplimentKey = null;
```

Replace the body of `pickRandom()`:

```js
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
```

### Step 5 — Update `handleShare()` to handle personal compliments

In the existing `handleShare()` function, add a guard at the top:

```js
function handleShare() {
  if (currentIndex === null) {
    showFeedback("Personal compliments can't be shared via link — try copying the text directly.");
    return;
  }
  // ... rest of existing logic unchanged
}
```

### Step 6 — Add star rating functions

Append to `app.js`:

```js
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
```

### Step 7 — Add personal compliment management functions

Append to `app.js`:

```js
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
  // Also clear its rating
  const ratings = getRatings();
  delete ratings[`personal_${id}`];
  saveRatings(ratings);
  renderCollectionPanel();
}
```

### Step 8 — Add collection panel functions

Append to `app.js`:

```js
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
```

### Step 9 — Add export / import functions

Append to `app.js`:

```js
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
  // Personal compliments: skip duplicates (matched by id)
  const existing = getPersonalCompliments();
  const existingIds = new Set(existing.map(p => p.id));
  const incoming = data.personalCompliments.filter(p => !existingIds.has(p.id));
  savePersonalCompliments([...existing, ...incoming]);

  // Ratings: existing user ratings take priority
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
```

### Step 10 — Wire up new UI in `renderInteractiveView()`

Update the existing `renderInteractiveView()` to attach all new handlers:

```js
function renderInteractiveView() {
  pickRandom();
  document.getElementById('new-compliment-btn').addEventListener('click', () => pickRandom(true));
  document.getElementById('share-btn').addEventListener('click', handleShare);
  attachSpacebarShortcut();

  // New:
  attachStarRating();
  attachAddComplimentForm();
  attachCollectionToggle();
  attachExportImport();
}
```

Add supporting attachment helpers:

```js
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
```

### Step 11 — Update `hideInteractiveControls()` to hide new elements in shared view

Update the IDs list:

```js
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
```

### Step 12 — Update `module.exports`

Add new exported functions to the block at the bottom of `app.js`:

```js
module.exports = {
  // existing exports...
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
  // new:
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
```

### Step 13 — Update `index.html`

Add the following new elements inside `.container`, after `<p class="share-feedback" ...>` and before `<p class="visitor-counter" ...>`:

```html
<!-- Star rating -->
<div class="star-rating" id="star-rating" hidden aria-label="Rate this compliment">
  <button class="star" type="button" data-value="1" aria-label="Rate 1 star" aria-pressed="false">★</button>
  <button class="star" type="button" data-value="2" aria-label="Rate 2 stars" aria-pressed="false">★</button>
  <button class="star" type="button" data-value="3" aria-label="Rate 3 stars" aria-pressed="false">★</button>
  <button class="star" type="button" data-value="4" aria-label="Rate 4 stars" aria-pressed="false">★</button>
  <button class="star" type="button" data-value="5" aria-label="Rate 5 stars" aria-pressed="false">★</button>
</div>

<!-- Add your own -->
<button class="btn btn-secondary" id="add-compliment-toggle" type="button">Add Your Own</button>
<div class="add-compliment-form" id="add-compliment-form" hidden>
  <textarea
    id="add-compliment-text"
    placeholder="Write your own compliment..."
    maxlength="200"
    rows="2"
    aria-label="New personal compliment text"
  ></textarea>
  <button class="btn btn-secondary" id="add-compliment-submit" type="button">Add to My Collection</button>
</div>

<!-- My Collection -->
<button class="btn btn-secondary" id="collection-toggle" type="button">My Collection</button>
<section class="collection-panel" id="collection-panel" hidden aria-label="My compliment collection">
  <h2 class="collection-panel-title">My Collection</h2>
  <div id="collection-list"></div>
  <div class="collection-actions">
    <button class="btn btn-secondary" id="export-btn" type="button">Export</button>
    <button class="btn btn-secondary" id="import-btn" type="button">Import</button>
    <input type="file" id="import-input" accept=".json" hidden aria-hidden="true">
  </div>
</section>
```

### Step 14 — Update `styles.css`

Append the following new rules to `styles.css`:

```css
/* Star rating */
.star-rating {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
}

.star {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--border-color);
  cursor: pointer;
  padding: 0.1rem 0.15rem;
  line-height: 1;
  transition: color 0.15s ease, transform 0.15s ease;
}

.star:hover,
.star.star-active {
  color: #f5a623;
}

.star:hover {
  transform: scale(1.2);
}

/* Add-your-own form */
.add-compliment-form {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#add-compliment-text {
  width: 100%;
  padding: 10px 14px;
  font-family: Georgia, serif;
  font-size: 1rem;
  color: var(--color-input);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  resize: vertical;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

#add-compliment-text:focus {
  border-color: var(--border-focus);
}

/* Collection panel */
.collection-panel {
  margin-top: 1rem;
  text-align: left;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1rem;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.collection-panel-title {
  font-size: 0.875rem;
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-subtle);
  margin-bottom: 0.75rem;
  transition: color 0.3s ease;
}

.collection-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
  transition: border-color 0.3s ease;
}

.collection-item:last-child {
  border-bottom: none;
}

.collection-item-text {
  flex: 1;
  font-style: italic;
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0;
  transition: color 0.3s ease;
}

.collection-item-stars {
  color: #f5a623;
  font-size: 0.875rem;
  white-space: nowrap;
}

.collection-item-delete {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  color: var(--color-subtle);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.collection-item-delete:hover {
  background: var(--bg-secondary-hover);
  color: var(--color-text);
}

.collection-empty {
  font-style: italic;
  color: var(--color-subtle);
  font-size: 0.875rem;
  text-align: center;
  padding: 0.5rem 0;
  transition: color 0.3s ease;
}

.collection-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}
```

### Step 15 — Update `test/app.test.js`

**Update `createDocument()`** to add the new element IDs:

```js
function createDocument() {
  const elements = {
    // ... existing elements ...
    'star-rating': createElement('div'),
    'add-compliment-toggle': createElement('button'),
    'add-compliment-form': createElement('div'),
    'add-compliment-text': createElement('textarea'),
    'add-compliment-submit': createElement('button'),
    'collection-toggle': createElement('button'),
    'collection-panel': createElement('section'),
    'collection-list': createElement('div'),
    'export-btn': createElement('button'),
    'import-btn': createElement('button'),
    'import-input': createElement('input'),
  };
  // ... rest unchanged
}
```

The `textarea` element in the mock needs `value` (already provided by `createElement`). The `querySelectorAll('.star')` call in `renderStarRating` must also work — add `querySelectorAll` to `createElement` or add stars as children of the `star-rating` mock element.

**Add the following new tests:**

```
test('getPersonalCompliments returns empty array when nothing stored')
test('getPersonalCompliments returns empty array when localStorage unavailable')
test('addPersonalCompliment persists a new entry with id, text, createdAt')
test('addPersonalCompliment ignores blank strings')
test('getRatings returns empty object when nothing stored')
test('rateCurrentCompliment saves rating for the current compliment key')
test('buildComplimentPool returns all built-ins with weight 1 when nothing rated')
test('buildComplimentPool assigns higher weight to 5-star compliment')
test('buildComplimentPool includes personal compliments')
test('pickWeighted never returns excluded key when alternatives exist')
test('pickWeighted returns excluded key when it is the only option')
test('deletePersonalCompliment removes entry and its rating')
test('validateImport accepts a well-formed export object')
test('validateImport rejects wrong version, missing fields, non-integer ratings')
test('mergeCollection adds new personal compliments without duplicating by id')
test('mergeCollection gives priority to existing ratings on key conflict')
test('renderCollectionPanel shows empty state when no personal compliments')
test('renderCollectionPanel renders one item per personal compliment with delete button')
```

---

## Validation Strategy

### Automated tests (run via `node test/app.test.js`)
- All new functions listed above
- Ensure all **existing** tests still pass (the weighted selection with uniform weights is equivalent to uniform random, so no changes to existing tests should be required)

### Manual test checklist

| Scenario | Steps | Expected |
|----------|-------|----------|
| Star rating appears | Load app, wait for compliment | Star rating widget visible below share section |
| Rate a compliment | Click 3rd star | 3 stars highlighted, rating persisted in localStorage |
| Rating persists across reload | Rate, reload page, click New Compliment until same compliment reappears | Same rating shown |
| High-rated compliment appears more | Rate one compliment 5★, click Next ~20 times | 5★ compliment appears significantly more often |
| Add personal compliment | Click "Add Your Own", type, submit | Form collapses, "added" feedback shown |
| Personal compliment appears | Click Next | Personal compliment visible in main card |
| Rate personal compliment | Rate a personal compliment | Rating persists |
| Share disabled for personal | Navigate to personal compliment, click Share | Feedback message: "Personal compliments can't be shared via link" |
| Share works for built-in | Navigate to built-in compliment, click Share | URL contains `?c=N` as before |
| My Collection shows personal | Open My Collection | Personal compliments listed |
| Delete from collection | Click Remove on an item | Item removed, panel re-renders |
| Export | Click Export | JSON file downloaded with version, compliments, ratings |
| Import | Click Import, select valid JSON | Merged; feedback shows count |
| Import duplicate | Import same file again | No duplicate personal compliments added |
| Import invalid JSON | Select non-JSON file | "invalid JSON" feedback |
| Import wrong structure | Select JSON with version: 2 | "Invalid collection file format" feedback |
| Graceful degradation | Simulate `localStorage = null` in JS console | All features silently no-op; app doesn't crash |
| Shared view unchanged | Open `?c=3&to=Alice` | No stars, no collection UI; existing behavior intact |
| Dark/light themes | Toggle theme, check all new elements | All new elements respect CSS variables |
| Mobile layout | Resize to < 768px | Collection panel stacks; no overflow |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing `pickRandom` tests break | Medium | Traced algorithm manually — uniform weights produce equivalent selections. No test changes expected, but verify by running suite after Step 4. |
| `querySelectorAll('.star')` not available in the test mock's `createElement` | High | Add `querySelectorAll` method to the mock `div` returned for `star-rating`, returning its `.children` filtered by class. Or declare stars as child `button` elements and traverse `children`. |
| localStorage quota exceeded by large collections | Low | No practical limit for the expected use case. Mention in code comment. |
| Blob/URL APIs unavailable in some environments | Low | `exportCollection` is only attached in `renderInteractiveView` (browser context). `FileReader` check in `importCollection` already guards this. |
| Shared links for personal compliments | None | By design: only built-in compliments can be shared. Clear user feedback when attempted. |
| `currentComplimentKey` is `null` on first `rateCurrentCompliment` call | Low | Guard: `if (!currentComplimentKey) return;` already in `rateCurrentCompliment`. |
| Import overwriting ratings the user wants to keep | Low | Merge strategy: existing ratings win on conflict (design decision, noted in plan). |

---

## Success Criteria

- [ ] `node test/app.test.js` passes with all existing and new tests green
- [ ] "Add Your Own" button opens a form; submitting persists a new personal compliment in localStorage
- [ ] Star rating (1–5) renders below the compliment and reflects saved rating on next display of same compliment
- [ ] Weighted random selection is demonstrably biased toward 5-star compliments when tested manually
- [ ] "My Collection" panel lists personal compliments with ratings and a working Remove button
- [ ] Export downloads a valid `my-compliments.json` containing both personal compliments and ratings
- [ ] Import merges a valid JSON file, deduplicates by id, and shows accurate count feedback
- [ ] Invalid import files produce a readable feedback message and do not modify stored data
- [ ] Shared view (`?c=N`) remains visually identical to current behavior; none of the new UI elements appear
- [ ] All new elements use existing CSS custom properties; dark and light themes render correctly
- [ ] No new external dependencies or build steps introduced
