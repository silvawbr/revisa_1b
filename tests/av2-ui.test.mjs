import { createAv2SubtractionRound } from '../src/av2/subtraction.js';
import { createAv2SequencesRound, AV2_SEQUENCES_PROGRESS_STORAGE_KEY, numberToWordsPtBr } from '../src/av2/sequences.js';
import { AV2_SUBTRACTION_PROGRESS_STORAGE_KEY } from '../src/av2/progress.js';
import { AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY } from '../src/av2/progress.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MONEY_DENOMINATIONS } from '../src/av2/money.js';
import { createAv2AdditionRound } from '../src/av2/addition.js';
import {
  AV2_ADDITION_PROGRESS_STORAGE_KEY,
  AV2_PROGRESS_STORAGE_KEY,
  AV2_SHOPPING_PROGRESS_STORAGE_KEY,
} from '../src/av2/progress.js';
import { CHILD_NAME_STORAGE_KEY } from '../src/child-profile.js';
import { createAv2MoneyCompositionRound, findMoneyCompositionSolutions, formatMoneyCompositionTotal } from '../src/av2/money-composition.js';
import { createAv2SimuladoFullCoverageRound, AV2_SIMULADO_PROGRESS_STORAGE_KEY } from '../src/av2/simulado.js';

const SHOPPING_PRODUCT_LABELS = [
  'Caderno', 'Livro', 'Lápis', 'Cola', 'Tesoura', 'Borracha', 'Régua', 'Giz de cera',
  'Boneca', 'Carrinho', 'Bola', 'Urso', 'Jogo', 'Brinquedo',
];

class FakeElement {
  constructor(attributes) {
    this.attributes = attributes;
    this.dataset = {};
    this.listeners = new Map();
    this.value = attributes.value ?? '';
    this.checked = Object.hasOwn(attributes, 'checked');
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

  dispatchEvent(event) {
    this.listeners.get(event.type)?.(event);
    return true;
  }

  focus() {
    this.listeners.get('focus')?.({});
  }

  setAttribute() {}

  removeAttribute() {}

  querySelector() {
    return { textContent: '' };
  }
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
    if (!this.elements.has(selector)) this.elements.set(selector, selector.includes(',') ? [...new Set(selector.split(',').flatMap(part=>parseElements(this.markup,part.trim())))] : parseElements(this.markup, selector));
    return this.elements.get(selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function parseElements(markup, selector) {
  const selectorMatch = selector.match(/^\[(data-[\w-]+)(?:="([^"]*)")?\]$/);
  if (!selectorMatch) return [];
  const [, attribute, expectedValue] = selectorMatch;
  if (!['data-action', 'data-av2-answer', 'data-av2-add-field', 'data-av2-add-digit', 'data-av2-add-clear', 'data-sequence-answer', 'data-table-gap', 'data-add-money', 'data-remove-money-item', 'data-match-group', 'data-match-product', 'data-simulado-term-role', 'data-simulado-word-answer', 'data-simulado-numeric-answer', 'data-av2-association-answer', 'data-simulado-subject', 'data-simulado-count'].includes(attribute)) return [];
  return [...markup.matchAll(/<(?:button|input|a|select)\b[^>]*>/g)].flatMap(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map((match) => [match[1], match[2] ?? '']));
    if (tag.startsWith('<select')) {
      const start = markup.indexOf(tag) + tag.length;
      const selected = markup.slice(start).match(/<option\s+value="([^"]+)"\s+selected>/);
      if (selected) attributes.value = selected[1];
    }
    return attributes[attribute] !== undefined && (expectedValue === undefined || attributes[attribute] === expectedValue)
      ? [new FakeElement(attributes)] : [];
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
  if (prompt.startsWith('Quanto valem estas moedas')) return '1';
  if (prompt.startsWith('Qual cédula tem o mesmo valor')) {
    const groupMarkup = markup.split('<div class="av2-answer-options')[0];
    const totalCents = MONEY_DENOMINATIONS.reduce((sum, money) => {
      const count = [...groupMarkup.matchAll(new RegExp(`<span>${money.label}</span>`, 'g'))].length;
      return sum + count * money.valueCents;
    }, 0);
    const matchingNote = MONEY_DENOMINATIONS.find(({ kind, valueCents }) => kind === 'note' && valueCents === totalCents);
    assert.ok(matchingNote, 'o grupo tem uma cédula equivalente');
    assert.ok(options.includes(matchingNote.id), 'a cédula equivalente aparece nas alternativas');
    return matchingNote.id;
  }
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

function currentShoppingAnswer(markup) {
  const prompt = markup.match(/id="av2-question-prompt">([^<]+)</)?.[1] ?? '';
  const type = markup.match(/data-av2-question-type="([^"]+)"/)?.[1];
  assert.ok(type?.startsWith('shopping-'), 'a questão aberta pertence ao bloco de compras');
  if (type === 'shopping-available-total') {
    const values = [...markup.matchAll(/<span>(\d+) reais<\/span>/g)].map(([, value]) => Number(value));
    return String(values.reduce((sum, value) => sum + value, 0));
  }
  if (type === 'shopping-affordability') {
    const available = Number(prompt.match(/Você tem (\d+) reais/)?.[1]);
    const affordable = [];
    for (const [, attributes, content] of markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const id = attributes.match(/data-av2-answer="([^"]+)"/)?.[1];
      const price = Number(content.match(/class="av2-product-price">(\d+) (?:real|reais)<\/span>/)?.[1]);
      if (id && Number.isFinite(price) && price <= available) affordable.push(id);
    }
    return affordable;
  }
  const products = [...markup.matchAll(/<((?:article|button)\b[^>]*\bclass="[^"]*av2-product-card[^"]*"[^>]*)>([\s\S]*?)<\/(?:article|button)>/g)]
    .map(([, attributes, content]) => ({
      id: attributes.match(/data-av2-product-id="([^"]+)"/)?.[1],
      name: content.match(/<strong>([^<]+)<\/strong>/)?.[1]?.toLocaleLowerCase('pt-BR'),
      price: Number(content.match(/class="av2-product-price">(\d+) (?:real|reais)<\/span>/)?.[1]),
    }));
  if (type === 'shopping-change') {
    const available = Number(markup.match(/data-av2-paid-amount="(\d+)"/)?.[1]);
    assert.equal(products.length, 1, 'só o produto comprado aparece no exercício de troco');
    const product = products[0];
    assert.ok(prompt.includes(product.name), 'o produto comprado aparece no enunciado');
    return String(available - product.price);
  }
  const selected = products.filter(({ name }) => prompt.toLocaleLowerCase('pt-BR').includes(name));
  assert.ok(selected.length >= 2, 'os produtos pedidos aparecem no enunciado e nos cartões');
  return String(selected.reduce((sum, { price }) => sum + price, 0));
}

function answerCurrentShoppingQuestion(document, app) {
  const answer = currentShoppingAnswer(app.innerHTML);
  if (Array.isArray(answer)) {
    for (const id of answer) {
      const button = document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer === id);
      assert.ok(button, `produto ${id} está disponível para selecionar`);
      button.click();
    }
    clickAction(document, 'submit-av2');
    return;
  }
  const option = document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer === answer);
  assert.ok(option, `resposta ${answer} está entre as alternativas`);
  option.click();
}

function fillAdditionAnswer(document, value) {
  const digits = String(value).padStart(3, '0');
  const fields = document.querySelectorAll('[data-av2-add-field]')
    .filter((field) => !field.dataset.av2AddField.startsWith('carry') && !field.dataset.av2AddField.startsWith('borrow'));
  assert.ok(fields.length === 2 || fields.length === 3, 'a conta tem campos de resposta C/D/U');
  for (const field of fields) {
    const digitIndex = field.dataset.av2AddField === 'hundreds' ? 0
      : field.dataset.av2AddField === 'tens' ? 1 : 2;
    field.value = digits[digitIndex];
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function fillAdditionCarry(document, fieldName, value, { useKeypad = false } = {}) {
  const field = document.querySelectorAll('[data-av2-add-field]')
    .find((input) => input.dataset.av2AddField === fieldName);
  assert.ok(field, `a casa da reserva ${fieldName} pode ser selecionada`);
  field.focus();
  if (useKeypad) {
    const key = document.querySelectorAll('[data-av2-add-digit]')
      .find((button) => button.dataset.av2AddDigit === String(value));
    assert.ok(key, `o teclado tem a tecla ${value}`);
    key.click();
  } else {
    field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.equal(field.value, String(value), `a casa ${fieldName} recebe ${value}`);
}

function answerCurrentAdditionQuestion(document, question) {
  if (question.type === 'terms') {
    const answer = document.querySelectorAll('[data-av2-answer]')
      .find((button) => button.dataset.av2Answer === String(question.correctAnswer));
    assert.ok(answer, `alternativa ${question.correctAnswer} aparece na conta de termos`);
    answer.click();
    return;
  }
  fillAdditionAnswer(document, question.data.result);
  clickAction(document, 'submit-av2');
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
    querySelector(selector) { return selector === '#app' ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };

  globalThis.document = document;
  globalThis.window = { addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?av2-ui-${Date.now()}`);
    assert.match(app.innerHTML, /Revisão de Matemática/);
    assert.match(app.innerHTML, /Simulado AV2/);

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
    assert.match(app.innerHTML, /Voltar às revisões/);
    assert.equal(JSON.parse(storage.getItem(AV2_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');

    clickAction(document, 'restart');
    assert.match(app.innerHTML, /Questão 1 de 10/);
    clickAction(document, 'home');
    clickAction(document, 'av2-entry');
    const originalRandom = Math.random;
    try {
      Math.random = seededRandom(917);
      clickAction(document, 'start-av2-shopping');
    } finally {
      Math.random = originalRandom;
    }
    assert.match(app.innerHTML, /Questão 1 de 10/);
    const shoppingTypes = new Set();
    let testedProductSelection = false;
    for (let questionIndex = 0; questionIndex < 10; questionIndex += 1) {
      assert.doesNotMatch(app.innerHTML, /R\$\s*\d|\b\d+[,\.]\d{2}\b/);
      const questionType = app.innerHTML.match(/data-av2-question-type="(shopping-[^"]+)"/)?.[1];
      assert.ok(questionType, 'a rodada renderiza uma questão de Compras e Troco');
      shoppingTypes.add(questionType);
      const cards = [...app.innerHTML.matchAll(/<((?:article|button)\b[^>]*\bclass="[^"]*av2-product-card[^"]*"[^>]*)>([\s\S]*?)<\/(?:article|button)>/g)];
      if (questionType === 'shopping-available-total') {
        assert.equal(cards.length, 0, 'total disponível mantém as ilustrações de moedas e cédulas');
      } else {
        assert.ok(cards.length > 0, 'produtos têm cartões ilustrados');
        for (const [, attributes, card] of cards) {
          assert.match(card, /<img class="av2-product-image" src="\/public\/av2-products\/[a-z-]+\.svg" alt="" aria-hidden="true"/);
          assert.match(card, /<strong>[^<]+<\/strong>/, 'o cartão mostra o nome do produto');
          assert.match(card, /<span class="av2-product-price">\d+ (?:real|reais)<\/span>/, 'o cartão mostra o preço');
          assert.match(attributes, /data-av2-product-illustration="[a-z-]+"/);
        }
      }
      if (questionType === 'shopping-affordability') {
        assert.equal(cards.length, 4, 'todas as opções de compra aparecem');
        assert.ok(cards.every(([tag]) => tag.startsWith('<button ')), 'as alternativas continuam clicáveis');
        assert.match(app.innerHTML, /aria-label="[^"]+, \d+ (?:real|reais)"/);
        if (!testedProductSelection) {
          const initialId = cards[0][1].match(/data-av2-answer="([^"]+)"/)?.[1];
          document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer === initialId).click();
          assert.match(app.innerHTML, new RegExp(`data-av2-answer="${initialId}"[^>]*aria-pressed="true"`));
          document.querySelectorAll('[data-av2-answer]').find((element) => element.dataset.av2Answer === initialId).click();
          assert.match(app.innerHTML, new RegExp(`data-av2-answer="${initialId}"[^>]*aria-pressed="false"`));
          testedProductSelection = true;
        }
      }
      if (questionType === 'shopping-change') {
        assert.equal(cards.length, 1, 'o troco mostra apenas o produto comprado');
        assert.match(app.innerHTML, /data-av2-paid-amount="\d+">Valor pago: <strong>\d+ reais<\/strong>/);
        const prompt = app.innerHTML.match(/id="av2-question-prompt">([^<]+)</)?.[1]?.toLocaleLowerCase('pt-BR') ?? '';
        const expectedNames = SHOPPING_PRODUCT_LABELS.filter((name) => prompt.includes(name.toLocaleLowerCase('pt-BR')));
        const displayedName = cards[0][2].match(/<strong>([^<]+)<\/strong>/)?.[1];
        assert.deepEqual(expectedNames, [displayedName], 'o único cartão de troco corresponde ao produto citado');
      }
      if (questionType === 'shopping-product-sum' || questionType === 'shopping-selected-total') {
        assert.ok([2, 3].includes(cards.length), 'a soma mostra somente os dois ou três produtos pedidos');
        const prompt = app.innerHTML.match(/id="av2-question-prompt">([^<]+)</)?.[1]?.toLocaleLowerCase('pt-BR') ?? '';
        const expectedNames = SHOPPING_PRODUCT_LABELS.filter((name) => prompt.includes(name.toLocaleLowerCase('pt-BR'))).sort();
        const displayedNames = cards.map(([, , card]) => card.match(/<strong>([^<]+)<\/strong>/)?.[1]).sort();
        assert.deepEqual(displayedNames, expectedNames, 'a soma mostra exatamente os produtos citados');
      }
      answerCurrentShoppingQuestion(document, app);
      assert.match(app.innerHTML, /Muito bem, Ana!/);
      if (questionType === 'shopping-affordability') assert.match(app.innerHTML, /data-av2-answer="[^"]+"[^>]*disabled/);
      clickAction(document, 'next-av2');
    }
    for (const questionType of ['shopping-affordability', 'shopping-change', 'shopping-product-sum', 'shopping-selected-total', 'shopping-available-total']) {
      assert.ok(shoppingTypes.has(questionType), `${questionType} é coberto pela rodada renderizada`);
    }
    assert.match(app.innerHTML, /Você concluiu as 10 questões sobre dinheiro/);
    assert.equal(JSON.parse(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    clickAction(document, 'restart');
    assert.match(app.innerHTML, /data-av2-question-type="shopping-/);
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

test('simulado personalizado mantém seleção de assunto e quantidade de questões', async () => {
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
    querySelector(selector) { return selector === '#app' ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };
  globalThis.document = document;
  globalThis.window = { addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?av2-custom-setup-${Date.now()}`);
    clickAction(document, 'open-av2-simulado-setup');
    for (const subjectId of ['money', 'addition', 'subtraction', 'sequences']) {
      const checkbox = document.querySelectorAll('[data-simulado-subject]')
        .find((item) => item.dataset.simuladoSubject === subjectId);
      assert.ok(checkbox?.checked, `${subjectId} começa habilitado`);
      assert.ok(checkbox.listeners.has('change'), `${subjectId} permite mudar a seleção: ${[...checkbox.listeners.keys()].join(',')}`);
      checkbox.checked = false;
      checkbox.dispatchEvent({ type: 'change' });
    }
    const count = document.querySelectorAll('[data-simulado-count]')
      .find((item) => item.dataset.simuladoCount === 'words');
    count.value = '3';
    count.dispatchEvent({ type: 'change' });
    assert.match(app.innerHTML, /1 assunto selecionado/);
    clickAction(document, 'start-av2-simulado');
    assert.match(app.innerHTML, /Questão 1 de 3/);
    assert.match(app.innerHTML, /data-av2-question-type="simulado-(?:word-write|association|word)"/);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('simulado completo percorre os formatos oficiais, registra erro, pratica de novo e entrega a recompensa', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storageValues = new Map([[CHILD_NAME_STORAGE_KEY, 'Marina']]);
  const storage = {
    getItem(key) { return storageValues.get(key) ?? null; },
    setItem(key, value) { storageValues.set(key, String(value)); },
    removeItem(key) { storageValues.delete(key); },
  };
  const app = new FakeApp();
  const document = {
    title: '',
    querySelector(selector) { return selector === '#app' ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };
  globalThis.document = document;
  globalThis.window = { innerWidth: 390, addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  const seed = 20261024;
  const expectedRound = createAv2SimuladoFullCoverageRound(seededRandom(seed));
  const submit = () => clickAction(document, 'submit-av2');
  const input = (selector, value) => {
    const field = document.querySelector(selector);
    assert.ok(field, `campo ${selector} está visível`);
    field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const fillDigits = (result) => {
    const digits = String(result).padStart(3, '0');
    for (const field of document.querySelectorAll('[data-av2-add-field]')) {
      const name = field.dataset.av2AddField;
      if (['hundreds', 'tens', 'units'].includes(name)) {
        field.value = digits[{ hundreds: 0, tens: 1, units: 2 }[name]];
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    submit();
  };

  try {
    await import(`../app.js?av2-full-e2e-${Date.now()}`);
    assert.match(app.innerHTML, /Simulado AV2/);
    clickAction(document, 'open-av2-simulado-setup');
    assert.match(app.innerHTML, /Revisão completa AV2/);
    assert.match(app.innerHTML, /personalize sua prática/i);
    const originalRandom = Math.random;
    try { Math.random = seededRandom(seed); clickAction(document, 'start-av2-full-simulado'); }
    finally { Math.random = originalRandom; }
    assert.match(app.innerHTML, /Questão 1 de 15/);

    for (let index = 0; index < expectedRound.length; index += 1) {
      const question = expectedRound[index];
      assert.match(app.innerHTML, new RegExp(`Questão ${index + 1} de 15`));
      assert.match(app.innerHTML, /data-speech-button="question"/);
      assert.equal(app.innerHTML.match(/data-av2-question-type="([^"]+)"/)?.[1], question.type,
        `a questão ${index + 1} corresponde ao tipo esperado ${question.type}`);
      if (question.activityId === 'av2-money-composition') {
        assert.match(app.innerHTML, new RegExp(`data-challenge-id="${question.challengeId}"`));
      }
      if (question.type === 'equivalence') {
        const answer = document.querySelectorAll('[data-av2-answer]').find((button) => button.dataset.av2Answer === question.correctAnswer);
        assert.ok(answer, 'a nota equivalente tem uma ilustração selecionável');
        answer.click();
      } else if (question.type === 'simulado-money-product-match') {
        assert.match(app.innerHTML, /Toque em um grupo de cédulas/);
        for (let groupIndex = 0; groupIndex < question.data.groups.length; groupIndex += 1) {
          const group = question.data.groups[groupIndex];
          const nextGroup = question.data.groups[(groupIndex + 1) % question.data.groups.length];
          document.querySelectorAll('[data-match-group]').find((button) => button.dataset.matchGroup === group.id).click();
          document.querySelectorAll('[data-match-product]').find((button) => button.dataset.matchProduct === question.correctAnswer[nextGroup.id]).click();
        }
        submit();
        assert.match(app.innerHTML, /Confira os grupos destacados/);
        assert.match(app.innerHTML, /is-pair-incorrect/);
        for (const group of question.data.groups) {
          document.querySelectorAll('[data-match-group]').find((button) => button.dataset.matchGroup === group.id).click();
          document.querySelectorAll('[data-match-product]').find((button) => button.dataset.matchProduct === question.correctAnswer[group.id]).click();
        }
        submit();
      } else if (question.type === 'simulado-shopping-total' || question.type === 'simulado-shopping-change') {
        assert.match(app.innerHTML, /Dinheiro de Rael/);
        input('[data-simulado-numeric-answer]', question.correctAnswer);
        submit();
      } else if (question.type === 'simulado-shopping-affordability') {
        assert.match(app.innerHTML, /Pode haver mais de uma resposta/);
        for (const productId of question.correctAnswers) {
          document.querySelectorAll('[data-av2-answer]').find((button) => button.dataset.av2Answer === productId).click();
        }
        submit();
      } else if (question.activityId === 'av2-money-composition') {
        let remaining = question.targetCents;
        for (const denominationId of question.allowedDenominationIds) {
          const denomination = MONEY_DENOMINATIONS.find((money) => money.id === denominationId);
          const quantity = Math.floor(remaining / denomination.valueCents);
          for (let count = 0; count < quantity; count += 1) {
            document.querySelectorAll('[data-add-money]').find((button) => button.dataset.addMoney === denominationId).click();
          }
          remaining -= quantity * denomination.valueCents;
        }
        assert.equal(remaining, 0);
        submit();
      } else if (question.type === 'simulado-product-board' && question.options.length) {
        document.querySelectorAll('[data-av2-answer]').find((button) => button.dataset.av2Answer === question.correctAnswer).click();
        submit();
      } else if (question.type === 'simulado-product-board') {
        input('[data-simulado-numeric-answer]', question.correctAnswer);
        submit();
      } else if (question.type === 'simulado-number-table') {
        assert.match(app.innerHTML, /data-table-gap=/);
        assert.match(app.innerHTML, /simulado-number-table" style="--table-columns:5/);
        const gaps = document.querySelectorAll('[data-table-gap]');
        for (const field of gaps.slice(0, -1)) {
          const cellIndex = Number(field.dataset.tableGap);
          field.value = String(question.data.table.values[cellIndex]);
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        submit();
        assert.match(app.innerHTML, /Preencha todos os espaços vazios/);
        const lastIndex = Number(gaps.at(-1).dataset.tableGap);
        input(`[data-table-gap="${lastIndex}"]`, question.data.table.values[lastIndex]);
        for (const field of document.querySelectorAll('[data-table-gap]')) {
          const cellIndex = Number(field.dataset.tableGap);
          field.value = String(question.data.table.values[cellIndex]);
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        submit();
      } else if (question.type === 'simulado-word-write') {
        assert.match(app.innerHTML, /data-simulado-word-answer/);
        assert.doesNotMatch(app.innerHTML, new RegExp(question.correctAnswer, 'i'), 'a escrita não aparece antes da resposta');
        if (question.data.value === 208) {
          input('[data-simulado-word-answer]', 'duzentos e nove');
          submit();
          assert.match(app.innerHTML, /tente escrever novamente/i);
          clickAction(document, 'av2-hint');
          assert.match(app.innerHTML, /Pense nas centenas, dezenas e unidades/);
          assert.doesNotMatch(app.innerHTML, new RegExp(question.correctAnswer, 'i'), 'a dica não revela a resposta por extenso');
        }
        input('[data-simulado-word-answer]', question.correctAnswer);
        submit();
      } else if (question.type === 'simulado-two-step') {
        assert.match(app.innerHTML, /role="columnheader">C<\/b>/);
        assert.match(app.innerHTML, /role="columnheader">D<\/b>/);
        assert.match(app.innerHTML, /role="columnheader">U<\/b>/);
        assert.doesNotMatch(app.innerHTML, />351<|>204</, 'o resultado não aparece antes da primeira operação');
        fillDigits(351);
        assert.match(app.innerHTML, /Etapa 2 de 4/);
        for (const select of document.querySelectorAll('[data-simulado-term-role]')) {
          select.value = question.data.steps[1].expectedRoles[select.dataset.simuladoTermRole];
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        submit();
        assert.match(app.innerHTML, /Etapa 3 de 4/);
        assert.match(app.innerHTML, /Resultado confirmado na primeira etapa: <strong>351<\/strong>/);
        fillDigits(204);
        assert.match(app.innerHTML, /Etapa 4 de 4/);
        for (const select of document.querySelectorAll('[data-simulado-term-role]')) {
          select.value = question.data.steps[3].expectedRoles[select.dataset.simuladoTermRole];
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        submit();
      } else {
        assert.fail(`formato inesperado: ${question.type}`);
      }

      if (question.activityId === 'av2-money-composition') assert.ok(app.innerHTML.includes(question.feedback.correct));
      else assert.match(app.innerHTML, /Muito bem, Marina!/);
      clickAction(document, 'next-av2');
    }

    assert.match(app.innerHTML, /Você concluiu o Simulado AV2/);
    assert.doesNotMatch(app.innerHTML, /Resultado do simulado|Resultado por assunto/);
    assert.match(app.innerHTML, /Praticar as questões que errei \(2\)/);
    assert.equal(JSON.parse(storage.getItem(AV2_SIMULADO_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    clickAction(document, 'review-av2-simulado-errors');
    assert.match(app.innerHTML, /Questão 1 de 2/);
    for (let focusIndex = 0; focusIndex < 2; focusIndex += 1) {
      const focusedType = app.innerHTML.match(/data-av2-question-type="([^"]+)"/)?.[1];
      if (focusedType === 'simulado-money-product-match') {
        const getPairs = () => {
          const products = document.querySelectorAll('[data-match-product]').map((button) => ({
            id: button.dataset.matchProduct,
            cents: Number(button.attributes['aria-label'].match(/(\d+) reais?/)?.[1]) * 100,
          }));
          return document.querySelectorAll('[data-match-group]').map((button) => ({
            id: button.dataset.matchGroup,
            cents: button.dataset.matchDenominations.split('|').reduce((sum, id) => sum + MONEY_DENOMINATIONS.find((money) => money.id === id).valueCents, 0),
          })).map((group) => ({ ...group, productId: products.find((product) => product.cents === group.cents).id }));
        };
        for (const pair of getPairs()) {
          document.querySelectorAll('[data-match-group]').find((button) => button.dataset.matchGroup === pair.id).click();
          document.querySelectorAll('[data-match-product]').find((button) => button.dataset.matchProduct === pair.productId).click();
        }
        submit();
      } else {
        assert.equal(focusedType, 'simulado-word-write');
        const focusedValue = Number(app.innerHTML.match(/Escreva o número (\d+) por extenso/)?.[1]);
        input('[data-simulado-word-answer]', numberToWordsPtBr(focusedValue));
        submit();
      }
      clickAction(document, 'next-av2');
    }
    assert.match(app.innerHTML, /Você concluiu o Simulado AV2/);
    assert.doesNotMatch(app.innerHTML, /Rodada focada nos erros/);
    assert.match(app.innerHTML, /Você concluiu o Simulado AV2/);
    assert.match(app.innerHTML, /estrelas conquistadas/);
    assert.match(app.innerHTML, /data-coloring-image/);
    clickAction(document, 'home');
    assert.match(app.innerHTML, /Revisão de Matemática/);
    assert.equal(JSON.parse(storage.getItem(AV2_SIMULADO_PROGRESS_STORAGE_KEY)).roundsCompleted, 2);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('Block 03 alinha C/D/U, revela o vai um por etapas, conclui 12 questões e volta às atividades AV2', async () => {
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
    querySelector(selector) { return selector === '#app' ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };

  globalThis.document = document;
  globalThis.window = { addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?av2-addition-ui-${Date.now()}`);
    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /Adição com reagrupamento/);
    assert.match(app.innerHTML, /data-addition-rounds-completed/);

    const roundSeed = 30156;
    const expectedRound = createAv2AdditionRound(seededRandom(roundSeed));
    const doubleCarryIndex = expectedRound.findIndex(({ type, pedagogicalCategory }) => type === 'addition' && pedagogicalCategory === 'ADD-04');
    assert.ok(doubleCarryIndex >= 0);
    const originalRandom = Math.random;
    try {
      Math.random = seededRandom(roundSeed);
      clickAction(document, 'start-av2-addition');
    } finally {
      Math.random = originalRandom;
    }

    assert.match(app.innerHTML, /Questão 1 de 12/);
    assert.match(app.innerHTML, /data-speech-button="question"/);
    assert.match(app.innerHTML, /data-av2-question-type="/);
    assert.match(app.innerHTML, /role="columnheader">C<\/b>/);
    assert.match(app.innerHTML, /role="columnheader">D<\/b>/);
    assert.match(app.innerHTML, /role="columnheader">U<\/b>/);
    assert.match(app.innerHTML, /class="av2-addition-digit av2-addition-carry-digit[^"]*"[^>]*data-av2-add-field="carryHundreds"/,
      'a reserva das centenas usa a mesma caixinha de entrada da soma');
    assert.match(app.innerHTML, /class="av2-addition-digit av2-addition-carry-digit[^"]*"[^>]*data-av2-add-field="carryTens"/,
      'a reserva das dezenas pode receber um algarismo');

    for (let index = 0; index < expectedRound.length; index += 1) {
      const question = expectedRound[index];
      assert.match(app.innerHTML, new RegExp(`Questão ${index + 1} de 12`));
      if (index === doubleCarryIndex) {
        assert.doesNotMatch(app.innerHTML, /addition-carry-cell is-revealed/);
        assert.match(app.innerHTML, /data-av2-add-field="hundreds"/);
        assert.match(app.innerHTML, /data-av2-add-digit="0"/);
        clickAction(document, 'submit-av2');
        assert.match(app.innerHTML, /Preencha as casas do resultado/);
        assert.doesNotMatch(app.innerHTML, /addition-carry-cell is-revealed/);

        clickAction(document, 'av2-hint');
        assert.match(app.innerHTML, /Comece somando as unidades/);
        assert.doesNotMatch(app.innerHTML, /addition-carry-cell is-revealed/);
        fillAdditionAnswer(document, 0);
        fillAdditionCarry(document, 'carryTens', 0);
        clickAction(document, 'submit-av2');
        assert.match(app.innerHTML, /Confira o número que você escreveu na casa da reserva/);
        assert.match(app.innerHTML, /Tente novamente!/);
        assert.match(app.innerHTML, /addition-carry-cell is-revealed[^>]*data-cdu-marker="tens"/);
        assert.doesNotMatch(app.innerHTML, /addition-carry-cell is-revealed[^>]*data-cdu-marker="hundreds"/);

        clickAction(document, 'av2-hint');
        assert.match(app.innerHTML, /incluindo a dezena que foi levada/);
        assert.match(app.innerHTML, /addition-carry-cell is-revealed[^>]*data-cdu-marker="hundreds"/);
        fillAdditionCarry(document, 'carryTens', 1, { useKeypad: true });
        fillAdditionCarry(document, 'carryHundreds', 1);
        fillAdditionAnswer(document, question.data.result);
        clickAction(document, 'submit-av2');
      } else {
        answerCurrentAdditionQuestion(document, question);
      }

      assert.match(app.innerHTML, /Muito bem, Ana!/);
      assert.match(app.innerHTML, /data-action="next-av2"/);
      clickAction(document, 'next-av2');
    }

    assert.match(app.innerHTML, /Você concluiu as 12 questões de adição/);
    assert.match(app.innerHTML, /aria-label="12 estrelas conquistadas"/);
    assert.match(app.innerHTML, /Imprimir meu desenho/);
    assert.equal(JSON.parse(storage.getItem(AV2_ADDITION_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    assert.equal(storage.getItem(AV2_PROGRESS_STORAGE_KEY), null);
    assert.equal(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY), null);
    assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');

    clickAction(document, 'restart');
    assert.match(app.innerHTML, /Questão 1 de 12/);
    clickAction(document, 'av2-home');
    assert.match(app.innerHTML, /Escolha uma atividade/);
    assert.match(app.innerHTML, /Adição com reagrupamento/);

    const styles = await (await import('node:fs/promises')).readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(styles, /\.av2-addition-row\s*\{[^}]*grid-template-columns:\s*minmax\(54px, 0\.95fr\) repeat\(3, minmax\(0, 1fr\)\)/s);
    assert.match(styles, /@media \(max-width: 460px\)[\s\S]*?\.av2-addition-board/);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('Block 04 completes numeric input, progressive borrowing, terms, feedback, reward and restart', async () => {
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
    querySelector(selector) { return selector === '#app' ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };

  globalThis.document = document;
  globalThis.window = { addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    await import(`../app.js?av2-subtraction-ui-${Date.now()}`);
    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /Subtração com reagrupamento/);
    const seed = 862695;
    const round = createAv2SubtractionRound(seededRandom(seed));
    const originalRandom = Math.random;
    try { Math.random = seededRandom(seed); clickAction(document, 'start-av2-subtraction'); }
    finally { Math.random = originalRandom; }
    let checkedBorrow = false;
    for (let i = 0; i < 12; i++) {
      const q = round[i];
      assert.match(app.innerHTML, new RegExp(`Questão ${i+1} de 12`));
      assert.match(app.innerHTML, /data-speech-button="question"/);
      assert.doesNotMatch(app.innerHTML, /subtraction-history/);
      if (q.type === 'terms') {
        const button = document.querySelectorAll('[data-av2-answer]').find(b => b.dataset.av2Answer === String(q.correctAnswer));
        assert.ok(button); button.click();
      } else {
        clickAction(document, 'submit-av2');
        assert.match(app.innerHTML, /Digite a diferença antes de conferir/);
        if (!checkedBorrow && q.data.trace.pattern === 'both') {
          checkedBorrow = true;
          clickAction(document, 'av2-hint');
          assert.match(app.innerHTML, /Comece pelas unidades/);
          assert.doesNotMatch(app.innerHTML, /subtraction-history/);
          clickAction(document, 'av2-hint');
          assert.match(app.innerHTML, /subtraction-history/);
          assert.doesNotMatch(app.innerHTML, /Centenas: .* depois /);
          clickAction(document, 'av2-hint');
          clickAction(document, 'av2-hint');
          const e = q.data.trace.events[1];
          assert.ok(app.innerHTML.includes(`Centenas: ${e.stateBefore.hundreds} depois ${e.stateAfter.hundreds}`));
          fillAdditionAnswer(document, 0); clickAction(document, 'submit-av2');
          assert.match(app.innerHTML, /Tente novamente!/);
          assert.doesNotMatch(app.innerHTML, /data-action="next-av2"/);
        }
        // Exercise the shared touch keypad on one digit before entering the complete result.
        const field = document.querySelectorAll('[data-av2-add-field]').find(f => f.dataset.av2AddField === 'units');
        field.focus();
        const key = document.querySelectorAll('[data-av2-add-digit]').find(k => k.dataset.av2AddDigit === String(q.data.result % 10));
        key.click(); assert.equal(field.value, String(q.data.result % 10));
        fillAdditionAnswer(document, q.data.result);
        if (q.data.trace.pattern === 'both') {
          const topFields = document.querySelectorAll('[data-av2-add-field]').filter(f => f.dataset.av2AddField.startsWith('borrow'));
          const tens = topFields.find(f => f.dataset.av2AddField === 'borrowTens');
          tens.value = '99'; tens.dispatchEvent(new Event('input', { bubbles: true }));
          clickAction(document, 'submit-av2');
          assert.match(app.innerHTML, /Confira as trocas/);
          assert.doesNotMatch(app.innerHTML, /data-action="next-av2"/);
          for (const column of ['hundreds', 'tens', 'units']) {
            const name = `borrow${column[0].toUpperCase()}${column.slice(1)}`;
            const field = document.querySelectorAll('[data-av2-add-field]').find(f => f.dataset.av2AddField === name);
            field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); field.focus();
            for (const digit of String(q.data.trace.adjusted[column])) {
              const key = document.querySelectorAll('[data-av2-add-digit]').find(k => k.dataset.av2AddDigit === digit);
              key.click();
            }
            assert.equal(field.value, String(q.data.trace.adjusted[column]));
          }
        }
        clickAction(document, 'submit-av2');
      }
      assert.match(app.innerHTML, /Muito bem, Ana!/);
      assert.match(app.innerHTML, /data-speech-button="explanation"/);
      clickAction(document, 'next-av2');
    }
    assert.equal(checkedBorrow,true);
    assert.match(app.innerHTML, /Você concluiu as 12 questões de subtração/);
    assert.match(app.innerHTML, /aria-label="12 estrelas conquistadas"/);
    assert.match(app.innerHTML, /Imprimir meu desenho/);
    assert.equal(JSON.parse(storage.getItem(AV2_SUBTRACTION_PROGRESS_STORAGE_KEY)).roundsCompleted,1);
    assert.equal(storage.getItem(AV2_ADDITION_PROGRESS_STORAGE_KEY),null);
    assert.equal(storage.getItem(AV2_PROGRESS_STORAGE_KEY),null);
    assert.equal(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY),null);
    assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY),'Ana');
    clickAction(document,'restart'); assert.match(app.innerHTML,/Questão 1 de 12/);
    clickAction(document,'av2-home'); assert.match(app.innerHTML,/Escolha uma atividade/);
    assert.match(app.innerHTML,/Rodadas concluídas: <strong>1/);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});


test('Block 05 completes mixed questions, selects cursive number-word options, rewards progress and returns to AV2', async () => {
  const previousDocument=globalThis.document, previousWindow=globalThis.window, previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const values=new Map([[CHILD_NAME_STORAGE_KEY,'Ana']]);const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  const app=new FakeApp();const document={title:'',querySelector:s=>s==='#app'?app:app.querySelector(s),querySelectorAll:s=>app.querySelectorAll(s)};
  globalThis.document=document;globalThis.window={innerWidth:390,addEventListener(){}};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  try {
    await import(`../app.js?av2-sequences-ui-${Date.now()}`);clickAction(document,'av2-entry');assert.match(app.innerHTML,/Sequências e números por extenso/);
    const seed=90512, original=Math.random;
    const expectedRound = createAv2SequencesRound(seededRandom(seed));
    try{Math.random=seededRandom(seed);clickAction(document,'start-av2-sequences');}finally{Math.random=original;}
    assert.match(app.innerHTML,/Questão 1 de 12/);
    let checkedWrongWordOption=false;
    for(let i=0;i<12;i++){
      assert.match(app.innerHTML,/data-speech-button="question"/);
      const sequenceInput=document.querySelector('[data-sequence-answer]');
      const tableInputs=document.querySelectorAll('[data-table-gap]');
      if(sequenceInput){
        assert.match(app.innerHTML,/class="number-sequence/);const neighbor=app.innerHTML.match(/Qual é o (antecessor|sucessor) de (\d+)\?/);
        let answer;
        if(neighbor) answer=Number(neighbor[2])+(neighbor[1]==='antecessor'?-1:1);
        else {const row=app.innerHTML.match(/<div class="number-sequence[^\"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]??'';const tokens=[...row.matchAll(/<span>(\d+)<\/span>|<input[^>]*data-sequence-answer/g)];const blank=tokens.findIndex(t=>t[0].includes('data-sequence-answer'));const direction=app.innerHTML.includes('diminuem de um em um')?-1:1;const visible=tokens.findIndex(t=>t[1]!==undefined);const first=Number(tokens[visible][1]);const start=first-visible*direction;answer=start+blank*direction;}
        sequenceInput.value=String(answer);sequenceInput.dispatchEvent(new Event('input',{bubbles:true}));clickAction(document,'submit-av2');
      } else if(tableInputs.length){
        for(const input of tableInputs){const index=Number(input.dataset.tableGap);input.value=String(expectedRound[i].values[index]);input.dispatchEvent(new Event('input',{bubbles:true}));}clickAction(document,'submit-av2');
      } else {
        let answer;const word=app.innerHTML.match(/<div class="word-prompt cursive-text">([^<]+)<\/div>/)?.[1];const shownNumber=app.innerHTML.match(/<div class="number-prompt"><span>Número<\/span><strong>(\d+)<\/strong><\/div>/)?.[1];
        if(word){assert.match(app.innerHTML,/class="word-wrap av2-number-word-recognition"/);answer=[...Array(251).keys(),300,400].find(n=>numberToWordsPtBr(n)===word);}
        else if(shownNumber){assert.match(app.innerHTML,/class="word-wrap av2-number-to-word-choice"/);assert.match(app.innerHTML,/class="word-option cursive-text/);assert.doesNotMatch(app.innerHTML,/data-word-answer/);assert.doesNotMatch(app.innerHTML,/inputmode="text"/);answer=Number(shownNumber);}
        else {const m=app.innerHTML.match(/Qual é o (antecessor|sucessor) de (\d+)\?/);answer=Number(m[2])+(m[1]==='antecessor'?-1:1);}
        const options=document.querySelectorAll('[data-av2-answer]');const option=options.find(b=>b.dataset.av2Answer===String(answer));assert.ok(option);
        if(shownNumber&&!checkedWrongWordOption){options.find(b=>b!==option).click();clickAction(document,'submit-av2');assert.doesNotMatch(app.innerHTML,/Muito bem, Ana!/);assert.match(app.innerHTML,/Leia as palavras com calma/);checkedWrongWordOption=true;}
        const selected=document.querySelectorAll('[data-av2-answer]').find(b=>b.dataset.av2Answer===String(answer));selected.click();assert.doesNotMatch(app.innerHTML,/Muito bem, Ana!/);clickAction(document,'submit-av2');
      }
      assert.match(app.innerHTML,/Muito bem, Ana!/);clickAction(document,'next-av2');
    }
    assert.equal(checkedWrongWordOption,true);
    assert.match(app.innerHTML,/Você concluiu as 12 questões de sequências/);assert.match(app.innerHTML,/aria-label="12 estrelas conquistadas"/);
    assert.equal(JSON.parse(storage.getItem(AV2_SEQUENCES_PROGRESS_STORAGE_KEY)).roundsCompleted,1);clickAction(document,'restart');assert.match(app.innerHTML,/Questão 1 de 12/);clickAction(document,'av2-home');assert.match(app.innerHTML,/Escolha uma atividade/);
  } finally {globalThis.document=previousDocument;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;}
});

test('Block 06 lets the child add and remove money, solve two-way and banknote challenges, and finish a reward round', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([[CHILD_NAME_STORAGE_KEY, 'Ana']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  const app = new FakeApp();
  const document = { title: '', querySelector: (selector) => selector === '#app' ? app : app.querySelector(selector), querySelectorAll: (selector) => app.querySelectorAll(selector) };
  globalThis.document = document;
  globalThis.window = { innerWidth: 390, addEventListener() {} };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    await import(`../app.js?av2-money-composition-ui-${Date.now()}`);
    clickAction(document, 'av2-entry');
    assert.match(app.innerHTML, /Formar quantias/);
    assert.match(app.innerHTML, /data-action="start-av2-money-composition"/);

    const seed = 1;
    const round = createAv2MoneyCompositionRound(seededRandom(seed));
    const originalRandom = Math.random;
    try { Math.random = seededRandom(seed); clickAction(document, 'start-av2-money-composition'); }
    finally { Math.random = originalRandom; }
    assert.match(app.innerHTML, /Questão 1 de 12/);
    assert.match(app.innerHTML, /data-speech-button="question"/);

    const first = round[0];
    const firstId = first.allowedDenominationIds[0];
    const firstMoney = MONEY_DENOMINATIONS.find(({ id }) => id === firstId);
    const secondId = first.allowedDenominationIds[1];
    const secondMoney = MONEY_DENOMINATIONS.find(({ id }) => id === secondId);
    const add = (denominationId) => {
      const button = document.querySelectorAll('[data-add-money]').find((item) => item.dataset.addMoney === denominationId);
      assert.ok(button, `botão para adicionar ${denominationId} aparece`);
      button.click();
    };
    const totalText = (cents) => `Você formou: <strong>${formatMoneyCompositionTotal(cents)}</strong>`;

    add(firstId);
    add(firstId);
    add(secondId);
    assert.match(app.innerHTML, new RegExp(totalText(firstMoney.valueCents * 2 + secondMoney.valueCents)));
    assert.equal((app.innerHTML.match(/class="av2-composition-selected-item"/g) ?? []).length, 3);
    const removeFirst = () => document.querySelectorAll('[data-remove-money-item]').find((button) => button.attributes['aria-label'].includes(firstMoney.spokenLabel));
    removeFirst().click();
    assert.match(app.innerHTML, new RegExp(totalText(firstMoney.valueCents + secondMoney.valueCents)));
    removeFirst().click();
    assert.match(app.innerHTML, new RegExp(totalText(secondMoney.valueCents)));
    document.querySelectorAll('[data-remove-money-item]')[0].click();
    assert.match(app.innerHTML, new RegExp(totalText(0)));

    add(firstId);
    add(secondId);
    clickAction(document, 'clear-av2-money');
    assert.match(app.innerHTML, new RegExp(totalText(0)));
    clickAction(document, 'submit-av2');
    assert.match(app.innerHTML, /Você ainda não chegou ao valor pedido/);
    clickAction(document, 'av2-hint');
    assert.ok(app.innerHTML.includes(first.hint));
    assert.match(app.innerHTML, /data-speech-button="hint"/);

    const selectCounts = (counts) => {
      for (const [denominationId, quantity] of Object.entries(counts)) {
        for (let index = 0; index < quantity; index += 1) add(denominationId);
      }
    };
    for (let questionIndex = 0; questionIndex < round.length; questionIndex += 1) {
      const question = round[questionIndex];
      const solutions = findMoneyCompositionSolutions(question, { limit: question.requiredDistinctSolutions });
      assert.ok(solutions.length >= question.requiredDistinctSolutions, question.challengeId);
      assert.match(app.innerHTML, /Você formou: <strong>0 reais<\/strong>/, 'cada novo desafio começa sem itens anteriores');
      if (question.challengeId === 'exact-17-three-notes') {
        selectCounts({ 'note-5-reais': 3, 'note-2-reais': 1 });
        clickAction(document, 'submit-av2');
        assert.match(app.innerHTML, /O valor está certo, mas confira a quantidade de cédulas/);
        clickAction(document, 'clear-av2-money');
      }
      for (const solution of solutions) {
        selectCounts(solution);
        clickAction(document, 'submit-av2');
        if (question.requiredDistinctSolutions > 1 && solution === solutions[0]) {
          assert.match(app.innerHTML, /Primeira maneira: correta!/);
          assert.match(app.innerHTML, /Agora forme o mesmo valor de outro jeito/);
          assert.match(app.innerHTML, /av2-composition-first-way/);
          selectCounts(solutions[0]);
          clickAction(document, 'submit-av2');
          assert.match(app.innerHTML, /Essa combinação já foi usada\. Tente formar o valor de outro jeito!/);
          assert.match(app.innerHTML, /class="feedback av2-composition-duplicate-feedback" role="status"/);
          assert.doesNotMatch(app.innerHTML, /class="feedback retry-feedback"/);
          clickAction(document, 'clear-av2-money');
        }
      }
      assert.match(app.innerHTML, /data-action="next-av2"/);
      assert.match(app.innerHTML, /data-speech-button="feedback"/);
      if (questionIndex < round.length - 1) clickAction(document, 'next-av2');
    }
    clickAction(document, 'next-av2');
    assert.match(app.innerHTML, /Você concluiu os 12 desafios de formar quantias/);
    assert.match(app.innerHTML, /aria-label="12 estrelas conquistadas"/);
    assert.equal(JSON.parse(storage.getItem(AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
    assert.equal(storage.getItem(AV2_PROGRESS_STORAGE_KEY), null);
    assert.equal(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY), null);
    assert.equal(storage.getItem(AV2_ADDITION_PROGRESS_STORAGE_KEY), null);
    assert.equal(storage.getItem(AV2_SUBTRACTION_PROGRESS_STORAGE_KEY), null);
    clickAction(document, 'restart');
    assert.match(app.innerHTML, /Questão 1 de 12/);
    assert.match(app.innerHTML, /Você formou: <strong>0 reais<\/strong>/);
    clickAction(document, 'av2-home');
    assert.match(app.innerHTML, /Escolha uma atividade/);
    assert.equal(JSON.parse(storage.getItem(AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
  } finally {
    globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage;
  }
});
