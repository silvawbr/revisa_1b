import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AV2_SHOPPING_PROGRESS_STORAGE_KEY,
  createShoppingRound,
} from '../src/av2/shopping.js';
import { AV2_PROGRESS_STORAGE_KEY } from '../src/av2/progress.js';
import { CHILD_NAME_STORAGE_KEY } from '../src/child-profile.js';

class FakeElement {
  constructor(attributes) {
    this.dataset = {};
    this.listeners = new Map();
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        this.dataset[key] = value;
      }
    }
  }

  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
  focus() {}
}

class FakeApp {
  constructor() {
    this.markup = '';
    this.elements = new Map();
  }

  set innerHTML(value) {
    this.markup = value;
    this.elements.clear();
  }

  get innerHTML() { return this.markup; }
  insertAdjacentHTML(_position, value) {
    this.markup += value;
    this.elements.clear();
  }
  querySelectorAll(selector) {
    if (!this.elements.has(selector)) this.elements.set(selector, parseElements(this.markup, selector));
    return this.elements.get(selector);
  }
}

function parseElements(markup, selector) {
  const selectorMatch = selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
  if (!selectorMatch) return [];
  const [, dataName, expected] = selectorMatch;
  if (dataName === 'speech-button') return [];
  const attribute = `data-${dataName}`;
  return [...markup.matchAll(/<(?:button|a)\b[^>]*>/g)].flatMap(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
    return attributes[attribute] !== undefined && (expected === undefined || attributes[attribute] === expected)
      ? [new FakeElement(attributes)]
      : [];
  });
}

function clickAction(document, action) {
  const button = document.querySelectorAll('[data-action]').find((element) => element.dataset.action === action);
  assert.ok(button, `ação ${action} está visível`);
  assert.ok(button.listeners.has('click'), `ação ${action} recebeu um evento`);
  button.click();
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function currentQuestionId(markup) {
  return markup.match(/data-question-id="([^"]+)"/)?.[1];
}

test('a criança completa as doze questões de compras, recebe prêmio e volta à seleção AV2', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousRandom = Math.random;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const seed = 97;
  const expectedRound = createShoppingRound({ random: seededRandom(seed), roundNumber: 1, childName: 'Ana' });
  const storageValues = new Map([
    [CHILD_NAME_STORAGE_KEY, 'Ana'],
    [AV2_PROGRESS_STORAGE_KEY, JSON.stringify({ version: 1, roundsCompleted: 3 })],
    ['revisao-matematica.progress.v1', JSON.stringify({ roundsCompleted: 7 })],
  ]);
  const storage = {
    getItem(key) { return storageValues.get(key) ?? null; },
    setItem(key, value) { storageValues.set(key, String(value)); },
    removeItem(key) { storageValues.delete(key); },
  };
  const app = new FakeApp();
  const document = {
    title: '',
    querySelector(selector) { return selector === '#app' ? app : null; },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };

  globalThis.document = document;
  globalThis.window = { addEventListener() {} };
  Math.random = seededRandom(seed);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?shopping-ui-${Date.now()}`);
    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /Compras e troco/);
    assert.match(app.innerHTML, /Dinheiro/);
    clickAction(document, 'start-shopping');
    assert.match(app.innerHTML, /Questão 1 de 12/);
    assert.match(app.innerHTML, /data-speech-button="question"/);

    const completedQuestionIds = new Set();
    for (let questionIndex = 0; questionIndex < expectedRound.length; questionIndex += 1) {
      const question = expectedRound[questionIndex];
      assert.match(app.innerHTML, new RegExp(`Questão ${questionIndex + 1} de 12`));
      completedQuestionIds.add(currentQuestionId(app.innerHTML));
      assert.doesNotMatch(app.innerHTML, /R\$\s*\d|\b\d+[,.]\d{2}\b/);
      if (questionIndex === 0) {
        const wrong = document.querySelectorAll('[data-shopping-answer]')
          .find((element) => element.dataset.shoppingAnswer !== String(question.answer));
        assert.ok(wrong, 'há uma alternativa incorreta');
        wrong.click();
        assert.match(app.innerHTML, /vamos pensar juntos|Para descobrir|Compare os preços|Troco é/);
      }
      const answer = document.querySelectorAll('[data-shopping-answer]')
        .find((element) => element.dataset.shoppingAnswer === String(question.answer));
      assert.ok(answer, `resposta da questão ${questionIndex + 1} está disponível`);
      answer.click();
      assert.match(app.innerHTML, /Muito bem, Ana! Você acertou!/);
      assert.match(app.innerHTML, /data-action="next-shopping"/);
      clickAction(document, 'next-shopping');
    }

    assert.match(app.innerHTML, /Você concluiu as 12 questões de compras e troco/);
    assert.match(app.innerHTML, /12 estrelas conquistadas/);
    assert.equal(JSON.parse(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    assert.equal(JSON.parse(storage.getItem(AV2_PROGRESS_STORAGE_KEY)).roundsCompleted, 3);
    assert.equal(JSON.parse(storage.getItem('revisao-matematica.progress.v1')).roundsCompleted, 7);
    assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');

    clickAction(document, 'restart');
    assert.match(app.innerHTML, /Questão 1 de 12/);
    assert.equal(completedQuestionIds.has(currentQuestionId(app.innerHTML)), false);
    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /AV2 Matemática/);
    clickAction(document, 'start-av2');
    assert.match(app.innerHTML, /Questão 1 de 10/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    Math.random = previousRandom;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});
