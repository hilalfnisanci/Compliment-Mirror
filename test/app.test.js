const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(tagName, options = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = options.id || '';
    this.className = options.className || '';
    this.textContent = options.textContent || '';
    this.value = options.value || '';
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.isContentEditable = Boolean(options.isContentEditable);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach((listener) => listener(event));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  prepend(child) {
    this.children.unshift(child);
  }
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

function createRuntime() {
  const elements = new Map();
  const documentListeners = new Map();

  const document = {
    activeElement: null,
    body: {
      classList: {
        add() {}
      }
    },
    documentElement: new FakeElement('html'),
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    querySelector(selector) {
      if (selector === '.compliment-box') {
        return elements.get('compliment-box') || null;
      }

      return null;
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) {
        documentListeners.set(type, []);
      }

      documentListeners.get(type).push(listener);
    }
  };

  [
    new FakeElement('button', { id: 'theme-toggle' }),
    new FakeElement('p', { id: 'compliment' }),
    new FakeElement('p', { id: 'view-count' }),
    new FakeElement('button', { id: 'new-compliment-btn' }),
    new FakeElement('p', { id: 'new-compliment-hint' }),
    new FakeElement('input', { id: 'recipient-name' }),
    new FakeElement('button', { id: 'share-btn' }),
    new FakeElement('p', { id: 'share-feedback' }),
    new FakeElement('div', { id: 'compliment-box', className: 'compliment-box' })
  ].forEach((element) => {
    elements.set(element.id, element);
  });

  const windowListeners = new Map();
  const window = {
    location: {
      search: '',
      href: 'http://example.com/index.html'
    },
    matchMedia() {
      return { matches: false };
    },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, []);
      }

      windowListeners.get(type).push(listener);
    }
  };

  const context = {
    URLSearchParams,
    console,
    document,
    location: window.location,
    localStorage: createLocalStorage(),
    Math,
    navigator: {
      clipboard: {
        writeText() {
          return Promise.resolve();
        }
      }
    },
    setTimeout,
    window
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  vm.runInContext(source, context);

  const domReadyListeners = windowListeners.get('DOMContentLoaded') || [];
  domReadyListeners.forEach((listener) => listener());

  return { context, document, elements, documentListeners };
}

function dispatchKeydown(runtime, eventOverrides = {}) {
  let prevented = false;
  const event = {
    type: 'keydown',
    code: 'Space',
    key: ' ',
    preventDefault() {
      prevented = true;
    },
    ...eventOverrides
  };

  const listeners = runtime.documentListeners.get('keydown') || [];
  listeners.forEach((listener) => listener(event));

  return prevented;
}

test('spacebar shortcut randomizes compliments when no field is focused', () => {
  const runtime = createRuntime();
  const compliment = runtime.elements.get('compliment');

  runtime.context.Math.random = () => 0;
  runtime.elements.get('new-compliment-btn').dispatchEvent({ type: 'click' });
  assert.equal(compliment.textContent, 'You make the people around you feel seen.');

  runtime.context.Math.random = () => 0.96;
  const prevented = dispatchKeydown(runtime);

  assert.equal(prevented, true);
  assert.equal(compliment.textContent, 'You deserve every good thing coming your way.');
});

test('spacebar shortcut does not run while typing in an input', () => {
  const runtime = createRuntime();
  const compliment = runtime.elements.get('compliment');
  const input = runtime.elements.get('recipient-name');

  runtime.context.Math.random = () => 0;
  runtime.elements.get('new-compliment-btn').dispatchEvent({ type: 'click' });
  assert.equal(compliment.textContent, 'You make the people around you feel seen.');

  runtime.document.activeElement = input;
  runtime.context.Math.random = () => 0.96;
  const prevented = dispatchKeydown(runtime);

  assert.equal(prevented, false);
  assert.equal(compliment.textContent, 'You make the people around you feel seen.');
});

test('spacebar shortcut does not run while typing in a textarea', () => {
  const runtime = createRuntime();
  const compliment = runtime.elements.get('compliment');
  const textarea = new FakeElement('textarea', { id: 'notes' });

  runtime.context.Math.random = () => 0;
  runtime.elements.get('new-compliment-btn').dispatchEvent({ type: 'click' });
  assert.equal(compliment.textContent, 'You make the people around you feel seen.');

  runtime.document.activeElement = textarea;
  runtime.context.Math.random = () => 0.96;
  const prevented = dispatchKeydown(runtime);

  assert.equal(prevented, false);
  assert.equal(compliment.textContent, 'You make the people around you feel seen.');
});
