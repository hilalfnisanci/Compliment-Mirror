const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    textContent: '',
    value: '',
    style: {},
    isContentEditable: false,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  };
}

function createDocument() {
  const elements = {
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
    listeners: {},
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    removeEventListener(type, handler) {
      if (this.listeners[type] === handler) {
        delete this.listeners[type];
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
  document.listeners.keydown({
    key: ' ',
    preventDefault() {}
  });

  assert.equal(
    document.getElementById('compliment').textContent,
    app.COMPLIMENTS[Math.floor(0.4 * app.COMPLIMENTS.length)]
  );
  assert.equal(localStorage.getItem('compliment_view_count'), '2');

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

  document.activeElement = document.getElementById('recipient-name');
  document.listeners.keydown({
    key: ' ',
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

test('spacebar prevents default scrolling behavior when it fires', () => {
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

  let prevented = false;
  document.listeners.keydown({
    key: ' ',
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);

  Math.random = originalRandom;
  delete global.document;
  delete global.localStorage;
  delete global.navigator;
  delete global.location;
});
