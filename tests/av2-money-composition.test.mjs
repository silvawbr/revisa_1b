import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AV2_MONEY_COMPOSITION_CATEGORIES,
  AV2_MONEY_COMPOSITION_ROUND_LENGTH,
  canonicalizeMoneyCompositionCounts,
  canonicalizeMoneyCompositionSelection,
  countMoneyCompositionSelection,
  createAv2MoneyCompositionRound,
  findMoneyCompositionSolutions,
  formatMoneyCompositionTotal,
  isAv2MoneyCompositionRound,
  totalMoneyCompositionCents,
  validateAv2MoneyCompositionChallenge,
  validateAv2MoneyCompositionSelection,
} from '../src/av2/money-composition.js';
import { MONEY_DENOMINATIONS } from '../src/av2/money.js';

const id = (value) => MONEY_DENOMINATIONS.find((money) => money.label === value)?.id;
const coin50 = id('50 centavos');
const coin25 = id('25 centavos');
const coin1 = id('1 real');
const note2 = id('2 reais');
const note5 = id('5 reais');
const note10 = id('10 reais');

function challenge({
  category = 'COMP-01',
  targetCents,
  allowed,
  limits = Object.fromEntries(allowed.map((denominationId) => [denominationId, 8])),
  maxItems = 8,
  requiredDistinctSolutions = category === 'COMP-05' ? 2 : 1,
  minimumDistinctDenominations = 1,
  exactBanknoteCount,
  referenceDenominationId,
  banknoteOnly = exactBanknoteCount !== undefined,
} = {}) {
  return {
    revisionId: 'av2-matematica',
    activityId: 'av2-money-composition',
    questionId: 'fixture',
    challengeId: 'fixture',
    type: 'money-composition',
    pedagogicalCategory: category,
    targetCents,
    allowedDenominationIds: allowed,
    quantityLimits: limits,
    maxItems,
    requiredDistinctSolutions,
    minimumDistinctDenominations,
    ...(exactBanknoteCount === undefined ? {} : { exactBanknoteCount, banknoteOnly }),
    ...(referenceDenominationId ? { referenceDenominationId } : {}),
    prompt: 'Forme o valor pedido.',
    speech: 'Forme o valor pedido.',
    hint: 'Some os valores com calma.',
    explanation: 'Confira o total formado.',
    feedback: { correct: 'Muito bem!', retry: 'Tente novamente.' },
  };
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function accepted(question, counts, previous = []) {
  const result = validateAv2MoneyCompositionSelection(question, counts, previous);
  assert.equal(result.correct, true, `${JSON.stringify(counts)} deve formar ${question.targetCents} centavos; recebeu ${result.reason}`);
  assert.equal(Number.isInteger(result.totalCents), true);
  return result;
}

test('o catálogo existente é a única fonte de denominações e os totais usam centavos inteiros', () => {
  assert.equal(totalMoneyCompositionCents({ [coin50]: 2 }), 100);
  assert.equal(totalMoneyCompositionCents({ [coin25]: 2, [coin50]: 1 }), 100);
  assert.equal(totalMoneyCompositionCents({ [coin1]: 1, [coin50]: 1, [coin25]: 2 }), 200);
  assert.equal(totalMoneyCompositionCents({ [coin1]: 5 }), 500);
  assert.equal(totalMoneyCompositionCents({ [note2]: 3 }), 600);
  assert.equal(totalMoneyCompositionCents({ [note5]: 1, [coin1]: 1 }), 600);
  assert.equal(totalMoneyCompositionCents({ [note10]: 1, [note5]: 1, [note2]: 1 }), 1700);
  assert.equal(totalMoneyCompositionCents({ [note10]: 2 }), 2000);
  assert.equal(totalMoneyCompositionCents({ [note5]: 4 }), 2000);
  assert.equal(formatMoneyCompositionTotal(0), '0 reais');
  assert.equal(formatMoneyCompositionTotal(25), '25 centavos');
  assert.equal(formatMoneyCompositionTotal(100), '1 real');
  assert.equal(formatMoneyCompositionTotal(225), '2 reais e 25 centavos');
  assert.ok(MONEY_DENOMINATIONS.every(({ valueCents }) => Number.isInteger(valueCents)));
});

test('aceita todas as equivalências e composições monetárias documentadas', () => {
  accepted(challenge({ category: 'COMP-03', targetCents: 100, allowed: [coin50], limits: { [coin50]: 2 }, maxItems: 2 }), { [coin50]: 2 });
  accepted(challenge({ category: 'COMP-03', targetCents: 100, allowed: [coin50, coin25], limits: { [coin50]: 1, [coin25]: 2 }, maxItems: 3 }), { [coin50]: 1, [coin25]: 2 });
  accepted(challenge({ category: 'COMP-03', targetCents: 200, allowed: [coin1, coin50, coin25], limits: { [coin1]: 1, [coin50]: 1, [coin25]: 2 }, maxItems: 4, minimumDistinctDenominations: 3 }), { [coin1]: 1, [coin50]: 1, [coin25]: 2 });
  accepted(challenge({ category: 'COMP-04', targetCents: 100, allowed: [coin50], limits: { [coin50]: 2 }, maxItems: 2, referenceDenominationId: coin1 }), { [coin50]: 2 });
  accepted(challenge({ targetCents: 500, allowed: [coin1], limits: { [coin1]: 5 }, maxItems: 5 }), { [coin1]: 5 });
  accepted(challenge({ targetCents: 600, allowed: [note2, note5, coin1], limits: { [note2]: 3, [note5]: 1, [coin1]: 6 }, maxItems: 6 }), { [note2]: 3 });
  accepted(challenge({ targetCents: 600, allowed: [note2, note5, coin1], limits: { [note2]: 3, [note5]: 1, [coin1]: 6 }, maxItems: 6 }), { [note5]: 1, [coin1]: 1 });
  accepted(challenge({ category: 'COMP-06', targetCents: 1700, allowed: [note10, note5, note2], limits: { [note10]: 1, [note5]: 2, [note2]: 2 }, maxItems: 3, exactBanknoteCount: 3 }), { [note10]: 1, [note5]: 1, [note2]: 1 });

  const twoWays = challenge({ category: 'COMP-05', targetCents: 2000, allowed: [note10, note5], limits: { [note10]: 2, [note5]: 4 }, maxItems: 4 });
  const first = { [note10]: 2 };
  const second = { [note5]: 4 };
  accepted(twoWays, first);
  accepted(twoWays, second, [first]);
  assert.equal(validateAv2MoneyCompositionSelection(twoWays, first, [first]).reason, 'duplicate-combination');
});

test('identidade de combinações conta denominações, ignora ordem e conserva itens repetidos', () => {
  const selectionA = [note2, note2, note5];
  const selectionB = [note5, note2, note2];
  const selectionC = [note2, note2, note2];
  const selectionD = [note5, coin1];
  assert.deepEqual(countMoneyCompositionSelection(selectionA), { [note2]: 2, [note5]: 1 });
  assert.equal(canonicalizeMoneyCompositionSelection(selectionA), canonicalizeMoneyCompositionSelection(selectionB));
  assert.notEqual(canonicalizeMoneyCompositionSelection(selectionC), canonicalizeMoneyCompositionSelection(selectionD));
  assert.equal(canonicalizeMoneyCompositionCounts({ [note2]: 2, [note5]: 1 }), canonicalizeMoneyCompositionCounts({ [note5]: 1, [note2]: 2 }));
});

test('rejeita totais incorretos, denominações não autorizadas, quantidades e limites inválidos', () => {
  const six = challenge({ targetCents: 600, allowed: [note2, note5, coin1], limits: { [note2]: 3, [note5]: 1, [coin1]: 6 }, maxItems: 6 });
  assert.equal(validateAv2MoneyCompositionSelection(six, { [note2]: 2 }).reason, 'below-target');
  assert.equal(validateAv2MoneyCompositionSelection(six, { [note5]: 1, [coin1]: 2 }).reason, 'above-target');
  assert.equal(validateAv2MoneyCompositionSelection(six, { [note2]: 1, [coin1]: 2, [note10]: 0 }).reason, 'unauthorized-denomination');
  assert.equal(validateAv2MoneyCompositionSelection(six, { [coin1]: -1 }).reason, 'invalid-quantities');
  assert.equal(validateAv2MoneyCompositionSelection(six, { [coin1]: 1.5 }).reason, 'invalid-quantities');
  assert.equal(validateAv2MoneyCompositionSelection(six, { [coin1]: 7 }).reason, 'inventory-limit');

  const notesOnly = challenge({ category: 'COMP-06', targetCents: 1000, allowed: [note5], limits: { [note5]: 2 }, maxItems: 2, exactBanknoteCount: 2 });
  assert.equal(validateAv2MoneyCompositionSelection(notesOnly, { [coin1]: 5 }).reason, 'unauthorized-denomination');
  assert.equal(validateAv2MoneyCompositionSelection(notesOnly, { [note5]: 2, [note10]: 0 }).reason, 'unauthorized-denomination');

  const exactThree = challenge({ category: 'COMP-06', targetCents: 1700, allowed: [note10, note5, note2], limits: { [note10]: 1, [note5]: 3, [note2]: 1 }, maxItems: 4, exactBanknoteCount: 3 });
  const rightTotalWrongCount = { [note5]: 3, [note2]: 1 };
  assert.equal(totalMoneyCompositionCents(rightTotalWrongCount), 1700);
  assert.equal(validateAv2MoneyCompositionSelection(exactThree, rightTotalWrongCount).reason, 'wrong-banknote-count');

  const arbitraryPriceQuestion = { ...six, type: 'operation', pedagogicalCategory: 'SHOPPING_PROBLEM', data: { operands: [550, 50] } };
  assert.equal(validateAv2MoneyCompositionChallenge(arbitraryPriceQuestion), false);
});

test('o validador rejeita questões impossíveis e exige duas soluções realmente distintas', () => {
  const impossible = challenge({ targetCents: 500, allowed: [note2], limits: { [note2]: 2 }, maxItems: 2 });
  assert.equal(findMoneyCompositionSolutions(impossible).length, 0);
  assert.equal(validateAv2MoneyCompositionChallenge(impossible), false);
  assert.equal(validateAv2MoneyCompositionSelection(impossible, { [note2]: 2 }).reason, 'invalid-challenge');

  const oneWayOnly = challenge({ category: 'COMP-05', targetCents: 1000, allowed: [note5], limits: { [note5]: 2 }, maxItems: 2 });
  assert.equal(findMoneyCompositionSolutions(oneWayOnly, { limit: 2 }).length, 1);
  assert.equal(validateAv2MoneyCompositionChallenge(oneWayOnly), false);

  const noExactCountSolution = challenge({ category: 'COMP-06', targetCents: 1700, allowed: [note10, note2], limits: { [note10]: 1, [note2]: 2 }, maxItems: 3, exactBanknoteCount: 3 });
  assert.equal(findMoneyCompositionSolutions(noExactCountSolution).length, 0);
  assert.equal(validateAv2MoneyCompositionChallenge(noExactCountSolution), false);

  const wrongReference = challenge({ category: 'COMP-04', targetCents: 500, allowed: [note5], limits: { [note5]: 2 }, maxItems: 2, referenceDenominationId: note10 });
  assert.equal(validateAv2MoneyCompositionChallenge(wrongReference), false);
});

test('solucionador respeita limite de quantidade e interrompe quando encontra as respostas necessárias', () => {
  const limited = challenge({ category: 'COMP-05', targetCents: 600, allowed: [note2, note5, coin1], limits: { [note2]: 2, [note5]: 1, [coin1]: 1 }, maxItems: 3 });
  assert.equal(findMoneyCompositionSolutions(limited, { limit: 2 }).length, 1);
  const broad = challenge({ category: 'COMP-05', targetCents: 2000, allowed: [note5, note10], limits: { [note5]: 4, [note10]: 2 }, maxItems: 4 });
  assert.equal(findMoneyCompositionSolutions(broad, { limit: 2 }).length, 2);
  for (let attempt = 0; attempt < 100; attempt += 1) assert.equal(findMoneyCompositionSolutions(broad, { limit: 2 }).length, 2);
});

test('mil rodadas com semente cobrem as seis categorias e só expõem desafios solucionáveis', () => {
  const orders = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const round = createAv2MoneyCompositionRound(seededRandom(seed));
    assert.equal(round.length, AV2_MONEY_COMPOSITION_ROUND_LENGTH);
    assert.equal(isAv2MoneyCompositionRound(round), true);
    assert.deepEqual([...new Set(round.map(({ pedagogicalCategory }) => pedagogicalCategory))].sort(), [...AV2_MONEY_COMPOSITION_CATEGORIES].sort());
    assert.equal(new Set(round.map(({ challengeId }) => challengeId)).size, 12);
    for (const item of round) {
      assert.equal(validateAv2MoneyCompositionChallenge(item), true, item.challengeId);
      assert.ok(item.targetCents <= 2000);
      assert.ok(item.allowedDenominationIds.every((denominationId) => MONEY_DENOMINATIONS.some(({ id: knownId }) => denominationId === knownId)));
      assert.ok(findMoneyCompositionSolutions(item, { limit: item.requiredDistinctSolutions }).length >= item.requiredDistinctSolutions);
      if (item.pedagogicalCategory === 'COMP-03') assert.ok(item.allowedDenominationIds.every((denominationId) => denomination(denominationId).kind === 'coin'));
      if (item.pedagogicalCategory === 'COMP-06') assert.ok(item.allowedDenominationIds.every((denominationId) => denomination(denominationId).kind === 'note'));
    }
    orders.add(round.map(({ challengeId }) => challengeId).join('|'));
  }
  assert.ok(orders.size > 1, 'a rodada varia a seleção e a ordem dos desafios');
});

function denomination(denominationId) {
  return MONEY_DENOMINATIONS.find(({ id: knownId }) => knownId === denominationId);
}
