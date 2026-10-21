import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANKNOTES,
  COINS,
  MONEY_DENOMINATIONS,
  formatMoneyAmount,
} from '../src/av2/money.js';
import { AV2_PROGRESS_STORAGE_KEY, createAv2ProgressStore } from '../src/av2/progress.js';
import { isMoneyAmountInUnit, isMoneyOperationInUnit } from '../src/av2/money-rules.js';
import {
  AV2_SHOPPING_ACTIVITY_ID,
  AV2_MAT_RULE_AV2_MAT_01,
  AV2_MAT_RULE_AV2_MAT_02,
  AV2_SHOPPING_PROGRESS_STORAGE_KEY,
  SHOPPING_FAMILIES,
  addMoney,
  createShoppingQuestion,
  createShoppingRound,
  formatMoney,
  subtractMoney,
  validateShoppingAnswer,
} from '../src/av2/shopping.js';
import { CHILD_NAME_STORAGE_KEY } from '../src/child-profile.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    values,
  };
}

function amountUsesUnit(amount, unit) {
  return unit === 'reais' ? amount % 100 === 0 : amount < 100;
}

test('dinheiro usa aritmética inteira em centavos e um único formatador em português', () => {
  assert.equal(addMoney(200, 500), 700);
  assert.equal(formatMoney(700), '7 reais');
  assert.equal(addMoney(25, 50), 75);
  assert.equal(formatMoney(75), '75 centavos');
  assert.equal(subtractMoney(1000, 600), 400);
  assert.equal(subtractMoney(1500, 1000), 500);
  assert.equal(subtractMoney(1000, 700), 300);
  assert.equal(subtractMoney(100, 50), 50);
  assert.equal(subtractMoney(1200, 800), 400);
  assert.equal(addMoney(250, 125), 375);
  assert.equal(formatMoneyAmount(250), '2 reais e 50 centavos');
  assert.equal(formatMoneyAmount(375), '3 reais e 75 centavos');
  assert.throws(() => addMoney(1, -1), RangeError);
  assert.throws(() => subtractMoney(10, 11), RangeError);
  assert.equal(AV2_SHOPPING_ACTIVITY_ID, 'compras-e-troco');
});

test('AV2-MAT-01 aceita somente valores integralmente em reais ou em centavos', () => {
  assert.equal(isMoneyAmountInUnit(500, 'reais'), true);
  assert.equal(isMoneyAmountInUnit(550, 'reais'), false);
  assert.equal(isMoneyAmountInUnit(75, 'centavos'), true);
  assert.equal(isMoneyAmountInUnit(1, 'centavos'), false);
  assert.equal(isMoneyAmountInUnit(12, 'centavos'), false);
  assert.equal(isMoneyAmountInUnit(100, 'centavos'), false);

  const centsQuestion = createShoppingQuestion('price-addition', {
    random: seededRandom(19),
    level: 2,
    variant: 1,
  });
  assert.equal(centsQuestion.operationUnit, 'centavos');
  assert.equal(validateShoppingAnswer({ ...centsQuestion, operationUnit: 'reais' }, centsQuestion.answer), false);
});

test('AV2-MAT-02 impede conversões quando a soma de centavos chega a um real', () => {
  assert.equal(isMoneyOperationInUnit([25, 50], 75, 'centavos'), true);
  assert.equal(isMoneyOperationInUnit([1, 5], 6, 'centavos'), false);
  assert.equal(isMoneyOperationInUnit([25, 50, 25], 100, 'centavos'), false);
  assert.equal(isMoneyOperationInUnit([100, 100, 100], 300, 'reais'), true);

  for (let seed = 1; seed <= 100; seed += 1) {
    const question = createShoppingQuestion('money-addition', {
      random: seededRandom(seed),
      level: 2,
      variant: 1,
      salt: seed,
    });
    assert.equal(question.operationUnit, 'centavos');
    assert.equal(question.values.items.length, 3);
    assert.ok(question.values.items.every(({ value }) => [10, 25, 50].includes(value)));
    assert.ok(question.answer < 100);
    assert.ok(question.options.every(({ value }) => value < 100));
    assert.ok(question.rulesApplied.includes(AV2_MAT_RULE_AV2_MAT_02));
    assert.equal(validateShoppingAnswer(question, question.answer), true);
  }
});

test('cada família produz problemas estruturados, respostas únicas e explicações corretas', () => {
  for (let familyIndex = 0; familyIndex < SHOPPING_FAMILIES.length; familyIndex += 1) {
    const family = SHOPPING_FAMILIES[familyIndex].id;
    for (let level = 1; level <= 3; level += 1) {
      for (let variant = 0; variant < 2; variant += 1) {
        for (let seed = 1; seed <= 35; seed += 1) {
          const question = createShoppingQuestion(family, {
            random: seededRandom(seed + familyIndex * 101 + level * 17 + variant * 7),
            level,
            variant,
            childName: 'Ana',
            salt: seed,
          });
          assert.equal(question.activityId, AV2_SHOPPING_ACTIVITY_ID);
          assert.equal(question.family, family);
          assert.ok(question.questionId);
          assert.ok(question.explanation.length > 0);
          assert.equal(validateShoppingAnswer(question, question.answer), true);
          assert.equal(validateShoppingAnswer(question, '__resposta_errada__'), false);
          assert.doesNotMatch(`${question.prompt} ${question.speech} ${question.explanation} ${question.options.map(({ label }) => label ?? '').join(' ')}`, /R\$\s*\d|\b\d+[,.]\d{2}\b/);

          if (question.answerType === 'product') {
            assert.equal(question.options.length, 2);
            assert.equal(new Set(question.options.map(({ value }) => value)).size, 2);
            assert.equal(question.options.filter(({ value }) => value === question.answer).length, 1);
            assert.equal(question.ruleId, AV2_MAT_RULE_AV2_MAT_01);
            assert.ok(question.rulesApplied.includes(AV2_MAT_RULE_AV2_MAT_02));
            assert.ok(['reais', 'centavos'].includes(question.operationUnit));
            assert.ok(question.values.products.every(({ price }) => amountUsesUnit(price, question.operationUnit)));
            continue;
          }

          assert.equal(question.ruleId, AV2_MAT_RULE_AV2_MAT_01);
          assert.ok(question.rulesApplied.includes(AV2_MAT_RULE_AV2_MAT_02));
          assert.ok(['reais', 'centavos'].includes(question.operationUnit));
          assert.ok(amountUsesUnit(question.answer, question.operationUnit));
          assert.equal(question.options.length, 4);
          assert.equal(new Set(question.options.map(({ value }) => value)).size, 4);
          assert.equal(question.options.filter(({ value }) => value === question.answer).length, 1);
          assert.equal(question.options.every(({ value }) => Number.isSafeInteger(value) && value >= 0), true);
          assert.ok(question.options.every(({ value }) => amountUsesUnit(value, question.operationUnit)));
          assert.equal(question.options.find(({ value }) => value === question.answer).label, formatMoney(question.answer));

          if (family === 'money-addition') {
            assert.ok([2, 3].includes(question.values.items.length));
            for (const { denomination, value } of question.values.items) {
              const catalogItem = MONEY_DENOMINATIONS.find(({ id }) => id === denomination.id);
              assert.ok(catalogItem, 'usa a denominação compartilhada de Block 01');
              assert.equal(catalogItem.valueCents, value);
              assert.equal(catalogItem.imageUrl, denomination.imageUrl);
            }
            assert.ok(question.values.items.every(({ value }) => amountUsesUnit(value, question.operationUnit)));
            assert.equal(question.answer, question.values.items.reduce((sum, { value }) => sum + value, 0));
          } else if (family === 'price-addition') {
            assert.ok(question.values.products.every(({ price }) => amountUsesUnit(price, question.operationUnit)));
            assert.equal(question.answer, question.values.products.reduce((sum, { price }) => sum + price, 0));
            assert.match(question.explanation, new RegExp(formatMoney(question.answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
          } else if (family === 'remaining') {
            assert.ok(amountUsesUnit(question.values.available, question.operationUnit));
            assert.ok(amountUsesUnit(question.values.cost, question.operationUnit));
            assert.ok(question.values.available > question.values.cost);
            assert.equal(question.answer, question.values.available - question.values.cost);
          } else if (family === 'missing') {
            assert.ok(amountUsesUnit(question.values.price, question.operationUnit));
            assert.ok(amountUsesUnit(question.values.available, question.operationUnit));
            assert.ok(question.values.price > question.values.available);
            assert.equal(question.answer, question.values.price - question.values.available);
          } else if (family === 'change') {
            assert.ok(amountUsesUnit(question.values.payment.value, question.operationUnit));
            assert.ok(amountUsesUnit(question.values.product.price, question.operationUnit));
            assert.ok(question.values.payment.value >= question.values.product.price);
            assert.ok(question.answer >= 0);
            assert.equal(question.answer, question.values.payment.value - question.values.product.price);
          } else if (family === 'compare') {
            const [first, second] = question.values.products;
            assert.ok(amountUsesUnit(first.price, question.operationUnit));
            assert.ok(amountUsesUnit(second.price, question.operationUnit));
            assert.notEqual(first.price, second.price);
            assert.equal(question.answer, Math.abs(first.price - second.price));
          }
          assert.match(question.explanation, new RegExp(formatMoney(question.answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
      }
    }
  }
});

test('as somas visuais usam moedas, cédulas e misturas compatíveis com a dificuldade', () => {
  const introductory = createShoppingRound({ random: seededRandom(4), roundNumber: 1 });
  const moneyQuestions = introductory.filter(({ family }) => family === 'money-addition');
  assert.equal(moneyQuestions.length, 2);
  assert.equal(moneyQuestions.some(({ values }) => values.items.some(({ denomination }) => denomination.kind === 'bill')), true);
  assert.equal(moneyQuestions.some(({ values }) => values.items.some(({ denomination }) => denomination.kind === 'coin')), true);
  assert.equal(moneyQuestions.every(({ values }) => values.items.length >= 2 && values.items.length <= 3), true);

  const consolidation = createShoppingRound({ random: seededRandom(21), roundNumber: 3 });
  const advancedSums = consolidation.filter(({ family }) => family === 'money-addition');
  assert.ok(advancedSums.some(({ values }) => values.items.some(({ denomination }) => denomination.kind === 'coin')
    && values.items.some(({ denomination }) => denomination.kind === 'bill')));
  assert.ok(COINS.length > 0 && BANKNOTES.length > 0);
});

test('rodadas têm doze questões, duas de cada família, ordem variada e IDs únicos', () => {
  const roundSignatures = new Set();
  const correctPositions = new Set();
  for (let seed = 1; seed <= 75; seed += 1) {
    const round = createShoppingRound({ random: seededRandom(seed), roundNumber: 1, childName: 'Ana' });
    assert.equal(round.length, 12);
    assert.equal(new Set(round.map(({ questionId }) => questionId)).size, 12);
    for (const family of SHOPPING_FAMILIES) {
      assert.equal(round.filter(({ family: questionFamily }) => questionFamily === family.id).length, 2);
    }
    for (const question of round) {
      assert.equal(validateShoppingAnswer(question, question.answer), true);
      assert.equal(validateShoppingAnswer(question, question.options.find(({ value }) => value !== question.answer)?.value), false);
      if (question.answerType === 'money') correctPositions.add(question.correctIndex);
    }
    roundSignatures.add(round.map(({ questionId }) => questionId).join('|'));
  }
  assert.ok(roundSignatures.size > 1);
  assert.ok(correctPositions.size > 1);
});

test('a próxima rodada evita as combinações da rodada anterior e o progresso fica isolado', () => {
  const first = createShoppingRound({ random: seededRandom(88), roundNumber: 1 });
  const next = createShoppingRound({
    random: seededRandom(89),
    roundNumber: 2,
    recentFingerprints: first.map(({ fingerprint }) => fingerprint),
  });
  assert.equal(next.some(({ fingerprint }) => first.some((question) => question.fingerprint === fingerprint)), false);

  const storage = memoryStorage({
    [CHILD_NAME_STORAGE_KEY]: 'Ana',
    [AV2_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 1, roundsCompleted: 4 }),
    'revisao-matematica.progress.v1': JSON.stringify({ roundsCompleted: 7 }),
  });
  const moneyProgress = createAv2ProgressStore({ storage });
  const shopping = createAv2ProgressStore({ storage, key: AV2_SHOPPING_PROGRESS_STORAGE_KEY });
  assert.deepEqual(shopping.get(), { roundsCompleted: 0 });
  assert.deepEqual(shopping.completeRound(), { roundsCompleted: 1 });
  assert.deepEqual(moneyProgress.get(), { roundsCompleted: 4 });
  assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');
  assert.equal(storage.getItem('revisao-matematica.progress.v1'), JSON.stringify({ roundsCompleted: 7 }));
});

test('o servidor e o build publicam o módulo e a interface registra a jornada independente', async () => {
  const [server, app] = await Promise.all([
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
    fs.readFile(path.join(root, 'app.js'), 'utf8'),
  ]);
  assert.match(server, /src\/av2\/shopping\.js/);
  assert.match(app, /data-action="start-shopping"/);
  assert.match(app, /data-action="next-shopping"/);
  assert.match(app, /data-shopping-answer=/);
  assert.match(app, /Questão \$\{state\.shoppingIndex \+ 1\} de 12/);
  assert.match(app, /shoppingProgress\.completeRound\(\)/);
});
