import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AV2_SHOPPING_PROGRESS_STORAGE_KEY,
  createShoppingQuestion,
  createShoppingRound,
} from '../src/av2/shopping.js';
import { MONEY_DENOMINATIONS } from '../src/av2/money.js';
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

function sequenceRandom(sequence) {
  const values = [...sequence];
  return () => values.shift() ?? 0.23;
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
    const appModule = await import(`../app.js?shopping-ui-${Date.now()}`);

    const missing = createShoppingQuestion('missing', {
      random: sequenceRandom([0.999, 0.1, 0.55]), level: 1, childName: 'Marina',
    });
    assert.equal(missing.values.product.name, 'livro');
    assert.equal(missing.values.price, 1500);
    assert.equal(missing.values.available, 200);
    assert.equal(missing.answer, 1300);
    assert.match(missing.prompt, /^Marina quer comprar o livro\. Quanto dinheiro falta\?$/);
    assert.doesNotMatch(missing.prompt, /15 reais|2 reais|13 reais/);
    const missingVisuals = appModule.renderShoppingVisuals(missing);
    assert.equal((missingVisuals.match(/class="shopping-product-price"/g) ?? []).length, 1);
    assert.equal((missingVisuals.match(/class="shopping-money-card-amount"/g) ?? []).length, 1);
    assert.match(missingVisuals, />15 reais<\/strong>/);
    assert.match(missingVisuals, />2 reais<\/strong>/);
    assert.match(missingVisuals, /Marina tem/);
    assert.doesNotMatch(missingVisuals, />13 reais</);
    assert.doesNotMatch(missingVisuals, /shopping-amount-chip/);

    const change = createShoppingQuestion('change', {
      random: sequenceRandom([0.99, 0.88, 0.55]), level: 1, childName: 'Marina',
    });
    assert.equal(change.values.product.price, 800);
    assert.equal(change.values.payment.value, 1000);
    assert.equal(change.answer, 200);
    const changeVisuals = appModule.renderShoppingVisuals(change);
    assert.equal((changeVisuals.match(/class="shopping-product-price"/g) ?? []).length, 1);
    assert.equal((changeVisuals.match(/class="shopping-money-card-amount"/g) ?? []).length, 1);
    assert.match(changeVisuals, />8 reais<\/strong>/);
    assert.match(changeVisuals, />10 reais<\/strong>/);
    assert.match(changeVisuals, /Marina pagou/);
    assert.doesNotMatch(changeVisuals, />2 reais</);
    assert.doesNotMatch(changeVisuals, /shopping-amount-chip/);

    const productComparison = createShoppingQuestion('compare', {
      random: seededRandom(112), level: 1, variant: 0,
    });
    const comparisonOptions = appModule.renderShoppingOptions(productComparison);
    assert.doesNotMatch(comparisonOptions, /class="shopping-product-price"|reais|centavos/);
    assert.match(comparisonOptions, /aria-label="[^"]+"/);

    for (const id of ['coin-50-centavos', 'note-2-reais']) {
      const money = MONEY_DENOMINATIONS.find((denomination) => denomination.id === id);
      const illustration = appModule.renderMoneyIllustration({
        ...money,
        kind: money.kind,
        value: money.valueCents,
      });
      assert.doesNotMatch(illustration, /money-kind|>MOEDA<|>CÉDULA</);
      assert.match(illustration, /role="img" aria-label="[^"]+"/);
      assert.match(illustration, /class="money-object-image"/);
      assert.match(illustration, new RegExp(money.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

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
      assert.match(app.innerHTML, /data-speech-button="explanation"/);
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
