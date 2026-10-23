import { createAv2SubtractionRound } from '../src/av2/subtraction.js';
import { AV2_SUBTRACTION_PROGRESS_STORAGE_KEY } from '../src/av2/progress.js';
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

const SHOPPING_PRODUCT_LABELS = [
  'Caderno', 'Livro', 'Lápis', 'Cola', 'Tesoura', 'Borracha', 'Régua', 'Giz de cera',
  'Boneca', 'Carrinho', 'Bola', 'Urso', 'Jogo', 'Brinquedo',
];

class FakeElement {
  constructor(attributes) {
    this.dataset = {};
    this.listeners = new Map();
    this.value = attributes.value ?? '';
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
    if (!this.elements.has(selector)) this.elements.set(selector, parseElements(this.markup, selector));
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
  if (!['data-action', 'data-av2-answer', 'data-av2-add-field', 'data-av2-add-digit', 'data-av2-add-clear'].includes(attribute)) return [];
  return [...markup.matchAll(/<(?:button|input|a)\b[^>]*>/g)].flatMap(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
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
