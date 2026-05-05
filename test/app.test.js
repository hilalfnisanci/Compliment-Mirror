const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    textContent: '',
    value: '',
    style: {},
    attributes: {},
    isContentEditable: false,
    listeners: {},
    addEventListener(type, handler) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(handler);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
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
    'spacebar-hint': createElement('p')
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
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
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

  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  const app = loadApp();
  global.window.domReady();

  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-pastel'),
    'hsl(180 69% 91%)'
  );
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body-pastel, var(--bg-body))'
  );
  assert.equal(document.getElementById('compliment').textContent, app.COMPLIMENTS[0]);

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
  delete global.window;
});

test('theme toggle preserves the pastel color for light mode and restores theme background for dark mode', () => {
  const document = createDocument();
  const localStorage = createLocalStorage();

  global.document = document;
  global.localStorage = localStorage;
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

  const originalRandom = Math.random;
  let calls = 0;
  const values = [0.5, 0.25, 0.75, 0];
  Math.random = () => values[calls++];

  loadApp();
  global.window.domReady();

  const toggle = document.getElementById('theme-toggle');
  toggle.listeners.click[0]();

  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body)'
  );

  toggle.listeners.click[0]();

  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(localStorage.getItem('theme'), 'light');
  assert.equal(
    document.documentElement.style.getPropertyValue('--bg-body-current'),
    'var(--bg-body-pastel, var(--bg-body))'
  );

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
  delete global.window;
});
