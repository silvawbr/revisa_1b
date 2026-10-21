import test from 'node:test';
import assert from 'node:assert/strict';
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

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  click() {
    this.listeners.get('click')?.({ preventDefault() {} });
  }

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

  get innerHTML() {
    return this.markup;
  }

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
  const attribute = selector === '[data-action]' ? 'data-action' : selector === '[data-av2-answer]' ? 'data-av2-answer' : null;
  if (!attribute) return [];
  return [...markup.matchAll(/<(?:button|a)\b[^>]*>/g)].flatMap(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
    return attributes[attribute] ? [new FakeElement(attributes)] : [];
  });
}

function clickAction(document, action) {
  const button = document.querySelectorAll('[data-action]').find((element) => element.dataset.action === action);
  assert.ok(button, `botão da ação ${action} está visível`);
  assert.ok(button.listeners.has('click'), `ação ${action} recebeu um evento`);
  button.click();
}

function currentCorrectAnswer(markup) {
  const prompt = markup.match(/id="av2-question-prompt">([^<]+)</)?.[1] ?? '';
  const options = [...markup.matchAll(/data-av2-answer="([^"]+)"/g)].map((match) => match[1]);
  assert.ok([2, 4].includes(options.length), 'a questão apresenta alternativas');
  if (prompt.startsWith('Quanto vale')) {
    const description = markup.match(/class="money-illustration[^\"]*" role="img" aria-label="([^\"]+)"/)?.[1];
    const correct = MONEY_DENOMINATIONS.find((money) => money.description === description);
    assert.ok(correct, 'a ilustração da pergunta identifica a denominação');
    assert.ok(options.includes(correct.id));
    return correct.id;
  }
  const greater = prompt.includes('vale mais') || prompt.includes('maior');
  const values = options.map((id) => MONEY_DENOMINATIONS.find((money) => money.id === id));
  return values.reduce((best, money) => (greater
    ? money.valueCents > best.valueCents
    : money.valueCents < best.valueCents) ? money : best).id;
}

test('a criança entra na AV2, termina dez questões, inicia outra rodada e retorna à revisão antiga', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storageValues = new Map([[CHILD_NAME_STORAGE_KEY, 'Ana']]);
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
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?av2-ui-${Date.now()}`);
    assert.match(app.innerHTML, /Revisão de Matemática/);
    assert.match(app.innerHTML, /AV2 Matemática/);

    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /AV2 Matemática<br><span>Escolha uma atividade/);
    clickAction(document, 'home');
    assert.match(app.innerHTML, /data-action="start"/);

    clickAction(document, 'av2-entry');
    clickAction(document, 'start-av2');
    assert.match(app.innerHTML, /Questão 1 de 10/);
    assert.match(app.innerHTML, /data-speech-button="question"/);

    for (let questionIndex = 0; questionIndex < 10; questionIndex += 1) {
      assert.doesNotMatch(app.innerHTML, /R\$\s*\d|\b\d+,\d{2}\b|\b0\.\d{2}\b/);
      const correctAnswer = currentCorrectAnswer(app.innerHTML);
      if (questionIndex === 0) {
        const wrongAnswer = document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer !== correctAnswer);
        assert.ok(wrongAnswer, 'há uma alternativa incorreta para testar a nova tentativa');
        wrongAnswer.click();
        assert.match(app.innerHTML, /Tente novamente!/);
      }
      const answer = document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer === correctAnswer);
      assert.ok(answer, `resposta da questão ${questionIndex + 1} está selecionável`);
      answer.click();
      assert.match(app.innerHTML, /Muito bem, Ana!/);
      assert.match(app.innerHTML, /data-action="next-av2"/);
      clickAction(document, 'next-av2');
    }

    assert.match(app.innerHTML, /Você concluiu as 10 questões sobre dinheiro/);
    assert.match(app.innerHTML, /Outra rodada AV2/);
    assert.match(app.innerHTML, /Voltar às atividades AV2/);
    assert.equal(JSON.parse(storage.getItem(AV2_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');

    clickAction(document, 'restart');
    assert.match(app.innerHTML, /Questão 1 de 10/);
    clickAction(document, 'home');
    clickAction(document, 'start');
    assert.match(app.innerHTML, /Atividade 1/);
    assert.match(app.innerHTML, /Progresso: atividade 1 de 6/);
    assert.doesNotMatch(app.innerHTML, /data-av2-answer=/);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});
