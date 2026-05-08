const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(tagName) {
  const el = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    value: '',
    style: {},
    attributes: {},
    children: [],
    firstChild: null,
    isContentEditable: false,
    listeners: {},
    addEventListener(type, handler) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      if (!this.listeners[type]) return;
      this.listeners[type] = this.listeners[type].filter(h => h !== handler);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    appendChild(child) {
      this.children.push(child);
      this.firstChild = this.children[0];
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter(c => c !== child);
      this.firstChild = this.children[0] || null;
      return child;
    }
  };
  return el;
}

function createListElement() {
  const el = createElement('ul');
  el.children = [];
  el.firstChild = null;
  el.appendChild = function (child) {
    this.children.push(child);
    this.firstChild = this.children[0];
    return child;
  };
  el.removeChild = function (child) {
    this.children = this.children.filter(c => c !== child);
    this.firstChild = this.children[0] || null;
    return child;
  };
  el.removeAttribute = function (name) {
    delete this.attributes[name];
  };
  return el;
}

function createDocument() {
  const elements = {
    'theme-toggle': createElement('button'),
    'new-compliment-btn': createElement('button'),
    'share-btn': createElement('button'),
    compliment: createElement('p'),
    'share-feedback': createElement('p'),
    'recipient-name': createElement('input'),
    'view-count': createElement('p'),
    'spacebar-hint': createElement('p'),
    'visitor-counter': createElement('p'),
    'compliment-history': createElement('section'),
    'compliment-history-list': createListElement()
  };

  return {
    activeElement: null,
    body: {
      style: {},
      classList: { add() {} }
    },
    listeners: {},
    documentElement: {
      attributes: {},
      style: {
        properties: {},
        setProperty(name, value) {
          this.properties[name] = value;
        },
        getPropertyValue(name) {
          return this.properties[name] || '';
        }
      },
      getAttribute() {
        return this.attributes['data-theme'] || null;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      }
    },
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tagName) {
      return createElement(tagName);
    },
    addEventListener(type, handler) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      if (!this.listeners[type]) {
        return;
      }

      this.listeners[type] = this.listeners[type].filter(listener => listener !== handler);
    },
    dispatchEvent(type, event) {
      for (const listener of this.listeners[type] || []) {
        listener(event);
      }
    }
  };
}

function createSessionStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function loadAppAndDispatchDomReady({ search = '', initialTheme = null } = {}) {
  const document = createDocument();
  const localStorage = createLocalStorage();
  const sessionStorage = createSessionStorage();
  global.sessionStorage = sessionStorage;

  if (initialTheme !== null) {
    document.documentElement.setAttribute('data-theme', initialTheme);
  }

  global.document = document;
  global.localStorage = localStorage;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    location: { search },
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') {
        this.domReady = handler;
      }
    }
  };

  const app = loadApp();
  global.window.domReady();

  return { app, document, localStorage, sessionStorage };
}

function cleanupGlobals() {
  delete global.document;
  delete global.localStorage;
  delete global.sessionStorage;
  delete global.navigator;
  delete global.location;
  delete global.window;
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };
}

function loadApp() {
  delete require.cache[require.resolve('../app.js')];
  return require('../app.js');
}

test('visitor counter increments once per page load and renders message', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  const { document, localStorage } = loadAppAndDispatchDomReady();

  assert.equal(localStorage.getItem('visitor_count'), '1');
  assert.equal(
    document.getElementById('visitor-counter').textContent,
    "You've visited 1 time"
  );

  Math.random = originalRandom;
  cleanupGlobals();
});

test('visitor counter pluralizes correctly on subsequent visits', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  let result = loadAppAndDispatchDomReady();
  const store = result.localStorage;
  cleanupGlobals();

  // Simulate a second page load with the same persisted store.
  const document = createDocument();
  global.document = document;
  global.localStorage = store;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    location: { search: '' },
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') {
        this.domReady = handler;
      }
    }
  };

  loadApp();
  global.window.domReady();

  assert.equal(store.getItem('visitor_count'), '2');
  assert.equal(
    document.getElementById('visitor-counter').textContent,
    "You've visited 2 times"
  );

  Math.random = originalRandom;
  cleanupGlobals();
});

test('spacebar generates a new compliment in interactive mode', () => {
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const originalRandom = Math.random;
  Math.random = () => 0;

  const app = loadApp();
  app.renderInteractiveView();

  Math.random = () => 0.4;
  let prevented = false;
  document.dispatchEvent('keydown', {
    key: ' ',
    code: 'Space',
    target: createElement('div'),
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(
    document.getElementById('compliment').textContent,
    app.COMPLIMENTS[Math.floor(0.4 * app.COMPLIMENTS.length)]
  );
  assert.equal(localStorage.getItem('compliment_view_count'), '2');
  assert.equal(prevented, true);

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
});

test('spacebar is ignored while an input is focused', () => {
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const originalRandom = Math.random;
  Math.random = () => 0;

  const app = loadApp();
  app.renderInteractiveView();

  document.dispatchEvent('keydown', {
    key: ' ',
    code: 'Space',
    target: document.getElementById('recipient-name'),
    preventDefault() {
      throw new Error('preventDefault should not be called when focused on input');
    }
  });

  assert.equal(
    document.getElementById('compliment').textContent,
    app.COMPLIMENTS[0]
  );
  assert.equal(localStorage.getItem('compliment_view_count'), '1');

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
});

test('spacebar is ignored while a button is focused', () => {
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const originalRandom = Math.random;
  Math.random = () => 0;

  const app = loadApp();
  app.renderInteractiveView();

  document.dispatchEvent('keydown', {
    key: ' ',
    code: 'Space',
    target: document.getElementById('share-btn'),
    preventDefault() {
      throw new Error('preventDefault should not be called when focused on button');
    }
  });

  assert.equal(
    document.getElementById('compliment').textContent,
    app.COMPLIMENTS[0]
  );
  assert.equal(localStorage.getItem('compliment_view_count'), '1');

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
});

test('shared view does not attach the document-level shortcut', () => {
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    location: { search: '?c=1' },
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') {
        this.domReady = handler;
      }
    }
  };

  document.querySelector = () => ({ prepend() {} });
  document.createElement = () => createElement('p');

  loadApp();
  global.window.domReady();

  assert.deepEqual(document.listeners.keydown || [], []);
  assert.equal(localStorage.getItem('compliment_view_count'), '1');

  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
  delete global.window;
});

test('generateRandomPastelColor returns a predictable pastel hsl value', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75];
  Math.random = () => values[calls++];

  const app = loadApp();

  assert.equal(app.generateRandomPastelColor(), 'hsl(180 69% 91%)');

  Math.random = originalRandom;
});

test('DOMContentLoaded applies a random background color', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { app, document } = loadAppAndDispatchDomReady();

  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-pastel'),
    'hsl(180 69% 91%)'
  );
  assert.equal(document.body.style.backgroundColor, 'hsl(180 69% 91%)');
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body-pastel, var(--bg-body))'
  );
  assert.equal(document.getElementById('compliment').textContent, app.COMPLIMENTS[0]);

  Math.random = originalRandom;
  cleanupGlobals();
});

test('DOMContentLoaded keeps the random pastel visible with no saved preference in light mode', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { document } = loadAppAndDispatchDomReady();

  assert.equal(document.documentElement.getAttribute('data-theme'), null);
  assert.equal(document.body.style.backgroundColor, 'hsl(180 69% 91%)');

  Math.random = originalRandom;
  cleanupGlobals();
});

test('DOMContentLoaded keeps the random pastel visible with a saved light theme', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { document } = loadAppAndDispatchDomReady({ initialTheme: 'light' });

  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(document.body.style.backgroundColor, 'hsl(180 69% 91%)');

  Math.random = originalRandom;
  cleanupGlobals();
});

test('DOMContentLoaded keeps the random pastel visible with a saved dark theme', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { document } = loadAppAndDispatchDomReady({ initialTheme: 'dark' });

  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(document.body.style.backgroundColor, 'hsl(180 69% 91%)');

  Math.random = originalRandom;
  cleanupGlobals();
});

test('DOMContentLoaded keeps the random pastel visible with a dark system preference and no saved theme', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { document } = loadAppAndDispatchDomReady({ initialTheme: 'dark' });

  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(document.body.style.backgroundColor, 'hsl(180 69% 91%)');

  Math.random = originalRandom;
  cleanupGlobals();
});

test('triggerConfetti is a no-op when no canvas element exists', () => {
  const document = createDocument();
  global.document = document;

  const app = loadApp();

  assert.doesNotThrow(() => app.triggerConfetti());

  delete global.document;
});

test('triggerConfetti draws particles on the canvas when present', () => {
  const document = createDocument();
  let clearCalls = 0;
  let fillRectCalls = 0;
  const ctx = {
    setTransform() {},
    clearRect() { clearCalls++; },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillRect() { fillRectCalls++; },
    set globalAlpha(_v) {},
    set fillStyle(_v) {}
  };
  const canvas = createElement('canvas');
  canvas.getContext = () => ctx;
  canvas.clientWidth = 800;
  canvas.clientHeight = 600;
  const originalGetElementById = document.getElementById.bind(document);
  document.getElementById = (id) => {
    if (id === 'confetti-canvas') return canvas;
    return originalGetElementById(id);
  };

  let rafCalls = 0;
  let pendingStep = null;
  global.document = document;
  global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (cb) => { rafCalls++; pendingStep = cb; },
    addEventListener: () => {}
  };

  const app = loadApp();
  app.triggerConfetti();

  assert.ok(rafCalls >= 1, 'expected animation frame to be requested');
  if (pendingStep) pendingStep(0);
  assert.ok(clearCalls >= 1);
  assert.ok(fillRectCalls > 0, 'expected particles to be drawn');

  delete global.document;
  delete global.window;
});

test('triggerConfetti respects prefers-reduced-motion', () => {
  const document = createDocument();
  let getContextCalls = 0;
  const canvas = createElement('canvas');
  canvas.getContext = () => { getContextCalls++; return {}; };
  const originalGetElementById = document.getElementById.bind(document);
  document.getElementById = (id) => {
    if (id === 'confetti-canvas') return canvas;
    return originalGetElementById(id);
  };

  global.document = document;
  global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    matchMedia: (q) => ({ matches: q.includes('reduce') }),
    requestAnimationFrame: () => {},
    addEventListener: () => {}
  };

  const app = loadApp();
  app.triggerConfetti();

  assert.equal(getContextCalls, 0);

  delete global.document;
  delete global.window;
});

test('theme toggle restores theme-controlled backgrounds after the initial pastel load', () => {
  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const { document, localStorage } = loadAppAndDispatchDomReady();

  const toggle = document.getElementById('theme-toggle');
  toggle.listeners.click[0]();

  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.equal(document.body.style.backgroundColor, '');
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body)'
  );

  toggle.listeners.click[0]();

  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(localStorage.getItem('theme'), 'light');
  assert.equal(document.body.style.backgroundColor, '');
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body-pastel, var(--bg-body))'
  );

  Math.random = originalRandom;
  cleanupGlobals();
});

test('pickRandom does not trigger confetti when the same compliment is picked again', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  const document = createDocument();
  let getContextCalls = 0;
  const ctx = {
    setTransform() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, fillRect() {},
    set globalAlpha(_v) {}, set fillStyle(_v) {}
  };
  const canvas = createElement('canvas');
  canvas.getContext = () => { getContextCalls++; return ctx; };
  canvas.clientWidth = 800;
  canvas.clientHeight = 600;
  const originalGetElementById = document.getElementById.bind(document);
  document.getElementById = (id) => {
    if (id === 'confetti-canvas') return canvas;
    return originalGetElementById(id);
  };

  global.document = document;
  global.localStorage = createLocalStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    location: { search: '' },
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => {},
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') this.domReady = handler;
    }
  };

  loadApp();
  global.window.domReady();

  document.getElementById('new-compliment-btn').listeners.click[0]();

  assert.equal(getContextCalls, 0, 'confetti must not fire when the new pick repeats the current compliment');

  Math.random = originalRandom;
  cleanupGlobals();
});

test('compliment history records picks in sessionStorage with newest first', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const app = loadApp();

  app.recordComplimentInHistory(app.COMPLIMENTS[0]);
  app.recordComplimentInHistory(app.COMPLIMENTS[1]);
  app.recordComplimentInHistory(app.COMPLIMENTS[2]);
  app.renderComplimentHistory();

  const stored = JSON.parse(global.sessionStorage.getItem('compliment_history'));
  assert.equal(stored.length, 3);
  assert.equal(stored[0].text, app.COMPLIMENTS[2]);
  assert.equal(stored[1].text, app.COMPLIMENTS[1]);
  assert.equal(stored[2].text, app.COMPLIMENTS[0]);
  assert.ok(typeof stored[0].timestamp === 'number');

  const list = document.getElementById('compliment-history-list');
  assert.equal(list.children.length, 3);
  // Each li has a text span (children[0]) and a time span (children[1])
  assert.equal(list.children[0].children[0].textContent, app.COMPLIMENTS[2]);
  assert.equal(list.children[2].children[0].textContent, app.COMPLIMENTS[0]);

  const section = document.getElementById('compliment-history');
  assert.equal('hidden' in section.attributes, false);

  cleanupGlobals();
});

test('compliment history caps at 5 entries (newest first)', () => {
  global.document = createDocument();
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const app = loadApp();

  for (let n = 1; n <= 7; n++) {
    app.recordComplimentInHistory(`item-${n}`);
  }

  const stored = JSON.parse(global.sessionStorage.getItem('compliment_history'));
  assert.equal(stored.length, 5);
  assert.equal(stored[0].text, 'item-7');
  assert.equal(stored[1].text, 'item-6');
  assert.equal(stored[2].text, 'item-5');
  assert.equal(stored[3].text, 'item-4');
  assert.equal(stored[4].text, 'item-3');

  cleanupGlobals();
});

test('compliment history preserves consecutive duplicates in newest-first order', () => {
  global.document = createDocument();
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const app = loadApp();

  app.recordComplimentInHistory('hello');
  app.recordComplimentInHistory('hello');
  app.recordComplimentInHistory('world');

  const stored = JSON.parse(global.sessionStorage.getItem('compliment_history'));
  assert.equal(stored[0].text, 'world');
  assert.equal(stored[1].text, 'hello');
  assert.equal(stored[2].text, 'hello');

  cleanupGlobals();
});

test('setComplimentText defers the swap until after the fade-out transition completes', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const timeouts = [];
  global.window = {
    matchMedia: () => ({ matches: false }),
    setTimeout: (cb, delay) => { timeouts.push({ cb, delay }); return timeouts.length; },
    addEventListener: () => {}
  };

  const app = loadApp();
  const el = document.getElementById('compliment');
  el.textContent = 'old text';

  app.setComplimentText('new text');

  // Fade-out begins immediately, but the text MUST still be the old value —
  // swapping before opacity reaches 0 would cause a visible flash.
  assert.equal(el.style.opacity, '0');
  assert.equal(el.textContent, 'old text');

  // A transitionend listener must be registered so the swap can be
  // triggered by the actual end of the opacity transition.
  assert.ok(el.listeners.transitionend && el.listeners.transitionend.length > 0,
    'expected a transitionend listener to be registered on the compliment element');

  // The fallback timeout must match the CSS fade duration (350ms ± a small
  // safety margin) — never zero or a single animation frame.
  assert.ok(timeouts.length > 0, 'expected a fallback setTimeout to be scheduled');
  assert.ok(timeouts[0].delay >= 300 && timeouts[0].delay <= 500,
    `fallback delay ${timeouts[0].delay}ms must be within 300–500ms (CSS fade is 350ms)`);

  // Simulating the end of the opacity fade-out must atomically swap the text
  // and trigger the fade-in by restoring opacity to 1.
  el.listeners.transitionend[0]({ propertyName: 'opacity', target: el });
  assert.equal(el.textContent, 'new text');
  assert.equal(el.style.opacity, '1');

  // Fallback timer firing later must be a no-op (idempotent swap).
  timeouts[0].cb();
  assert.equal(el.textContent, 'new text');
  assert.equal(el.style.opacity, '1');

  cleanupGlobals();
  delete global.window;
});

test('setComplimentText falls back to a timer when transitionend never fires', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const timeouts = [];
  global.window = {
    matchMedia: () => ({ matches: false }),
    setTimeout: (cb) => { timeouts.push(cb); return timeouts.length; },
    addEventListener: () => {}
  };

  const app = loadApp();
  const el = document.getElementById('compliment');
  el.textContent = 'old text';

  app.setComplimentText('new text');

  // Even before the fallback fires, the text must not have changed yet.
  assert.equal(el.textContent, 'old text');
  assert.equal(el.style.opacity, '0');

  // Firing the fallback timer (transitionend never arrived) completes the swap.
  assert.equal(timeouts.length, 1);
  timeouts[0]();
  assert.equal(el.textContent, 'new text');
  assert.equal(el.style.opacity, '1');

  cleanupGlobals();
  delete global.window;
});

test('setComplimentText updates synchronously when prefers-reduced-motion is set', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    matchMedia: (q) => ({ matches: q.includes('reduce') }),
    setTimeout: () => { throw new Error('timers must not be used when reduced motion is requested'); },
    addEventListener: () => {}
  };

  const app = loadApp();
  const el = document.getElementById('compliment');
  el.textContent = 'old';
  app.setComplimentText('hello');

  // Synchronous swap, no fade scheduling, no transitionend listener.
  assert.equal(el.textContent, 'hello');
  assert.ok(!el.listeners.transitionend || el.listeners.transitionend.length === 0,
    'no transitionend listener should be registered under reduced motion');

  cleanupGlobals();
  delete global.window;
});

test('compliment history is silently ignored when sessionStorage is unavailable', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };
  global.window = {
    location: { search: '' },
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') this.domReady = handler;
    }
  };

  const originalRandom = Math.random;
  Math.random = () => 0;

  loadApp();
  assert.doesNotThrow(() => global.window.domReady());

  Math.random = originalRandom;
  cleanupGlobals();
});

test('formatRelativeTime returns "Just now" for timestamps within the last minute', () => {
  const app = loadApp();
  const now = Date.now();
  assert.equal(app.formatRelativeTime(now), 'Just now');
  assert.equal(app.formatRelativeTime(now - 30000), 'Just now');
  assert.equal(app.formatRelativeTime(now - 59000), 'Just now');
});

test('formatRelativeTime returns singular and plural minutes ago', () => {
  const app = loadApp();
  const now = Date.now();
  assert.equal(app.formatRelativeTime(now - 60000), '1 minute ago');
  assert.equal(app.formatRelativeTime(now - 120000), '2 minutes ago');
  assert.equal(app.formatRelativeTime(now - 3599000), '59 minutes ago');
});

test('formatRelativeTime returns singular and plural hours ago', () => {
  const app = loadApp();
  const now = Date.now();
  assert.equal(app.formatRelativeTime(now - 3600000), '1 hour ago');
  assert.equal(app.formatRelativeTime(now - 7200000), '2 hours ago');
});

test('compliment history renders timestamps alongside text', () => {
  const document = createDocument();
  global.document = document;
  global.localStorage = createLocalStorage();
  global.sessionStorage = createSessionStorage();
  global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  global.location = { href: 'https://example.com/' };

  const app = loadApp();
  app.recordComplimentInHistory('hello world');
  app.renderComplimentHistory();

  const list = document.getElementById('compliment-history-list');
  assert.equal(list.children.length, 1);

  const li = list.children[0];
  assert.equal(li.children[0].textContent, 'hello world');
  assert.equal(li.children[0].className, 'compliment-history-text');
  assert.equal(li.children[1].className, 'compliment-history-time');
  // Timestamp text should be non-empty (e.g. "Just now")
  assert.ok(li.children[1].textContent.length > 0);

  cleanupGlobals();
});
