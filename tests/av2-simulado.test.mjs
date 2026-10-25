import test from 'node:test';
import assert from 'node:assert/strict';
import { createCurrencyEquivalenceQuestion, MONEY_DENOMINATIONS, validateAv2MoneyQuestionCandidate } from '../src/av2/money.js';
import { getAv2MoneyCompositionChallenge, validateAv2MoneyCompositionChallenge, validateAv2MoneyCompositionSelection } from '../src/av2/money-composition.js';
import { AV2_SIMULADO_FULL_COVERAGE_PRESET_ID, createAv2SimuladoFocusRound, createAv2SimuladoFullCoverageRound, createAv2SimuladoRound, validateAv2SimuladoAnswer, validateAv2SimuladoFullCoverageRound, validateAv2SimuladoQuestionCandidate } from '../src/av2/simulado.js';
import { validateNumberTable } from '../src/av2/sequences.js';

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

const findType = (round, type, predicate = () => true) => round.find((question) => question.type === type && predicate(question));

test('REV-01 e REV-02: equivalência de moedas e quatro associações de cédulas são exatas e sem ambiguidades', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(101));
  const equivalence = round.find((question) => question.type === 'equivalence');
  const coinValues = equivalence.data.denominationIds.map((id) => MONEY_DENOMINATIONS.find((money) => money.id === id).valueCents);
  const targetNote = MONEY_DENOMINATIONS.find(({ id }) => id === equivalence.data.targetDenominationId);
  assert.equal(coinValues.reduce((sum, cents) => sum + cents, 0), targetNote.valueCents);
  assert.equal(equivalence.correctAnswer, targetNote.id);
  assert.equal(validateAv2MoneyQuestionCandidate(equivalence), true);

  const match = findType(round, 'simulado-money-product-match');
  assert.equal(validateAv2SimuladoQuestionCandidate(match), true);
  assert.deepEqual(match.data.groups.map(({ totalCents }) => totalCents).sort((a, b) => a - b),
    match.data.products.map(({ priceReais }) => priceReais * 100).sort((a, b) => a - b));
  assert.equal(new Set(Object.values(match.correctAnswer)).size, 4);
  assert.equal(validateAv2SimuladoAnswer(match, match.correctAnswer), true);
  const [firstGroup, secondGroup] = Object.keys(match.correctAnswer);
  const swappedMatches = { ...match.correctAnswer,
    [firstGroup]: match.correctAnswer[secondGroup], [secondGroup]: match.correctAnswer[firstGroup] };
  assert.equal(validateAv2SimuladoAnswer(match, swappedMatches), false);

  assert.throws(() => createCurrencyEquivalenceQuestion({
    denominationIds: ['coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-50-centavos', 'coin-10-centavos'],
    targetDenominationId: 'note-5-reais', random: seededRandom(1),
  }), /contrato pedagógico/i, 'R$ 4,60 não pode ser associado a uma cédula oferecida com outro valor');
});

test('REV-03: cenário de Rael calcula o conjunto de brinquedos e o troco com valores sorteados', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(202));
  const total = findType(round, 'simulado-shopping-total');
  const afford = findType(round, 'simulado-shopping-affordability');
  const change = findType(round, 'simulado-shopping-change');
  const availableCents = total.data.moneyDenominationIds.reduce((sum, id) => sum + MONEY_DENOMINATIONS.find((money) => money.id === id).valueCents, 0);
  assert.equal(availableCents, total.data.availableCents);
  assert.equal(total.correctAnswer, total.data.availableReais);
  assert.equal(total.correctAnswer * 100, availableCents);
  assert.equal(afford.data.scenarioId, total.data.scenarioId);
  assert.equal(afford.data.purchaseUnit, 'two-toy-set');
  assert.equal(afford.data.bundleProductIds.length, 2);
  const selectedProducts = afford.data.bundleProductIds.map((id) => afford.data.products.find((product) => product.id === id));
  const bundleTotal = selectedProducts.reduce((sum, product) => sum + product.priceReais, 0);
  assert.equal(bundleTotal, afford.data.bundlePriceReais);
  assert.ok(bundleTotal <= afford.data.availableReais);
  const affordablePairs = [];
  for (let firstIndex = 0; firstIndex < afford.data.products.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < afford.data.products.length; secondIndex += 1) {
      const pair = [afford.data.products[firstIndex], afford.data.products[secondIndex]];
      if (pair[0].priceReais + pair[1].priceReais <= afford.data.availableReais) affordablePairs.push(pair.map(({ id }) => id));
    }
  }
  assert.equal(affordablePairs.length, 1);
  assert.deepEqual([...afford.correctAnswers].sort(), [...afford.data.bundleProductIds].sort());
  assert.equal(validateAv2SimuladoAnswer(afford, afford.data.bundleProductIds), true);
  assert.equal(validateAv2SimuladoAnswer(afford, [afford.data.bundleProductIds[0]]), false);
  const decoy = afford.data.products.find(({ id }) => !afford.data.bundleProductIds.includes(id));
  assert.equal(validateAv2SimuladoAnswer(afford, [afford.data.bundleProductIds[0], decoy.id]), false);
  assert.deepEqual(change.data.bundleProductIds, afford.data.bundleProductIds);
  assert.equal(change.data.bundlePriceReais, bundleTotal);
  const changeAmount = change.data.availableReais - bundleTotal;
  assert.equal(change.correctAnswer, changeAmount);
  assert.match(change.prompt, /juntos/);
  assert.equal(validateAv2SimuladoAnswer(change, changeAmount), true);
});

test('REV-04: composição reutiliza os desafios reais do Block 06 e aceita equivalência de 100 centavos', () => {
  const fiveCoins = getAv2MoneyCompositionChallenge('equiv-5-from-1');
  const oneReal = getAv2MoneyCompositionChallenge('equiv-1-from-50');
  assert.equal(validateAv2MoneyCompositionChallenge(fiveCoins), true);
  assert.equal(fiveCoins.targetCents, 500);
  assert.deepEqual(fiveCoins.allowedDenominationIds, ['coin-1-real']);
  assert.equal(validateAv2MoneyCompositionSelection(fiveCoins, { 'coin-1-real': 5 }).correct, true);
  assert.equal(validateAv2MoneyCompositionChallenge(oneReal), true);
  assert.equal(oneReal.targetCents, 100);
  assert.deepEqual(oneReal.allowedDenominationIds, ['coin-50-centavos']);
  assert.equal(validateAv2MoneyCompositionSelection(oneReal, { 'coin-50-centavos': 2 }).correct, true);
});

test('REV-05: o quadro compartilhado escolhe os produtos certos e soma apenas seus preços', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(303));
  const board = round.filter((question) => question.type === 'simulado-product-board');
  const byTask = Object.fromEntries(board.map((question) => [question.data.taskId, question]));
  const products = byTask.cheapest.data.products;
  assert.equal(byTask.cheapest.correctAnswer, [...products].sort((a, b) => a.priceReais - b.priceReais)[0].id);
  assert.equal(byTask['most-expensive'].correctAnswer, [...products].sort((a, b) => b.priceReais - a.priceReais)[0].id);
  for (const task of [byTask['pencil-eraser-scissors'], byTask['notebook-glue']]) {
    const expected = task.data.productIds.reduce((sum, id) => sum + products.find((product) => product.id === id).priceReais, 0);
    assert.equal(task.correctAnswer, expected);
  }
  for (const question of board) assert.equal(validateAv2SimuladoQuestionCandidate(question), true);
});

test('REV-06: tabela mantém 40 números ordenados e exige todos os espaços corretos', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(404));
  const question = findType(round, 'simulado-number-table');
  const table = question.data.table;
  assert.equal(table.values.length, 40);
  assert.ok(table.values[0] >= 200 && table.values[0] <= 211);
  assert.deepEqual(table.values, Array.from({ length: 40 }, (_, index) => table.values[0] + index));
  assert.ok([0, 5, 10, 19, 20, 25, 30, 38].every((index) => !table.gaps.includes(index)));
  const answer = Object.fromEntries(table.gaps.map((index) => [index, table.values[index]]));
  assert.equal(validateAv2SimuladoAnswer(question, answer), true);
  assert.equal(validateAv2SimuladoAnswer(question, { ...answer, [table.gaps[0]]: '' }), false);
  assert.equal(validateAv2SimuladoAnswer(question, { ...answer, [table.gaps[0]]: 900 }), false);
  assert.equal(validateNumberTable(table, answer), true);
  assert.ok(table.gaps.length > 1);
  assert.ok(table.gaps.every((index, order) => table.values[index] === table.answers[order]));
});

test('REV-07: os dois números sorteados exigem escrita digitada e aceitam normalização de caixa e espaços', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(505));
  const questions = round.filter((question) => question.type === 'simulado-word-write');
  assert.equal(questions.length, 2);
  assert.equal(new Set(questions.map(({ data }) => data.value)).size, 2);
  for (const question of questions) {
    assert.equal(validateAv2SimuladoAnswer(question, ` ${question.correctAnswer.toLocaleUpperCase('pt-BR')} `), true);
    assert.equal(validateAv2SimuladoAnswer(question, `${question.correctAnswer} errado`), false);
    assert.equal(question.options.length, 0);
    assert.doesNotMatch(`${question.prompt} ${question.speech} ${question.hint}`, new RegExp(question.correctAnswer, 'i'));
  }
});

test('REV-08: biblioteca usa C/D/U, valida as duas operações e associa os termos em quatro etapas', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(606));
  const question = findType(round, 'simulado-two-step');
  const [addition, additionTerms, subtraction, subtractionTerms] = question.data.steps;
  assert.deepEqual([addition.question.data.a, addition.question.data.b, addition.question.data.trace.result], [
    question.data.initialAmount, question.data.donatedAmount, question.data.intermediate,
  ]);
  assert.ok(addition.question.data.trace.carries.toTens || addition.question.data.trace.carries.toHundreds);
  assert.deepEqual(additionTerms.expectedRoles, { a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' });
  assert.deepEqual([subtraction.question.data.a, subtraction.question.data.b, subtraction.question.data.trace.result], [
    question.data.intermediate, question.data.removedAmount, question.data.finalAmount,
  ]);
  assert.ok(subtraction.question.data.trace.events.length > 0);
  assert.deepEqual(subtractionTerms.expectedRoles, { a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' });
  assert.equal(validateAv2SimuladoAnswer(question, question.data.intermediate, 1), true);
  assert.equal(validateAv2SimuladoAnswer(question, additionTerms.expectedRoles, 2), true);
  assert.equal(validateAv2SimuladoAnswer(question, question.data.finalAmount, 3), true);
  assert.equal(validateAv2SimuladoAnswer(question, subtractionTerms.expectedRoles, 4), true);
  assert.equal(validateAv2SimuladoAnswer(question, question.data.finalAmount + 1, 1), false);
  assert.equal(validateAv2SimuladoQuestionCandidate(question), true);
});

test('preset completo cobre REV-01 a REV-08; rodadas personalizadas continuam flexíveis', () => {
  assert.equal(AV2_SIMULADO_FULL_COVERAGE_PRESET_ID, 'official-revision');
  const complete = createAv2SimuladoFullCoverageRound(seededRandom(707));
  assert.equal(validateAv2SimuladoFullCoverageRound(complete), true);
  assert.equal(complete.length, 15);
  assert.equal(createAv2SimuladoRound({ words: 1 }, seededRandom(8)).length, 1);
  assert.equal(createAv2SimuladoRound({ money: 2, sequences: 1 }, seededRandom(9)).length, 3);
  const matching = findType(complete, 'simulado-money-product-match');
  const writing = findType(complete, 'simulado-word-write');
  assert.equal(createAv2SimuladoFocusRound([{
    subjectId: 'money', sourceQuestionId: matching.simulado.questionId, sourceType: matching.type,
  }], seededRandom(10))[0].type, 'simulado-money-product-match');
  assert.equal(createAv2SimuladoFocusRound([{
    subjectId: 'words', sourceQuestionId: writing.simulado.questionId, sourceType: writing.type,
  }], seededRandom(11))[0].type, 'simulado-word-write');
});

test('geração completa com 256 sementes mantém contratos, contagens, alternativas e atribuição de assunto', () => {
  for (let seed = 1; seed <= 256; seed += 1) {
    const round = createAv2SimuladoFullCoverageRound(seededRandom(seed));
    assert.equal(validateAv2SimuladoFullCoverageRound(round), true, `semente ${seed}`);
    const questionIds = round.map((question) => question.simulado.questionId);
    assert.equal(new Set(questionIds).size, questionIds.length, `sem duplicatas na semente ${seed}`);
    for (const question of round) {
      assert.equal(validateAv2SimuladoQuestionCandidate(question), true, `${question.questionId}, semente ${seed}`);
      assert.ok(question.simulado.subjectIds.every((id) => ['money', 'addition', 'subtraction', 'sequences', 'words'].includes(id)));
      if (question.type === 'simulado-word' || question.type === 'simulado-sequence') {
        assert.equal(new Set(question.options.map((option) => typeof option === 'object' ? option.value : option)).size, question.options.length);
        assert.equal(question.options.filter((option) => (typeof option === 'object' ? option.value : option) === question.correctAnswer).length, 1);
      }
    }
  }
});
