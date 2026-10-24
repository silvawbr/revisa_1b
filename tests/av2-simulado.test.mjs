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
  assert.deepEqual(coinValues, [100, 50, 25, 25]);
  assert.equal(coinValues.reduce((sum, cents) => sum + cents, 0), 200);
  assert.equal(equivalence.correctAnswer, 'note-2-reais');
  assert.equal(validateAv2MoneyQuestionCandidate(equivalence), true);

  const match = findType(round, 'simulado-money-product-match');
  assert.equal(validateAv2SimuladoQuestionCandidate(match), true);
  assert.deepEqual(match.data.groups.map(({ totalCents }) => totalCents).sort((a, b) => a - b), [700, 1200, 2200, 2500]);
  assert.deepEqual(match.data.products.map(({ priceReais }) => priceReais).sort((a, b) => a - b), [7, 12, 22, 25]);
  assert.equal(new Set(Object.values(match.correctAnswer)).size, 4);
  assert.equal(validateAv2SimuladoAnswer(match, match.correctAnswer), true);
  assert.equal(validateAv2SimuladoAnswer(match, { ...match.correctAnswer, 'group-12': 'truck-7' }), false);

  assert.throws(() => createCurrencyEquivalenceQuestion({
    denominationIds: ['coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-50-centavos', 'coin-10-centavos'],
    targetDenominationId: 'note-5-reais', random: seededRandom(1),
  }), /contrato pedagógico/i, 'R$ 4,60 não pode ser associado a uma cédula oferecida com outro valor');
});

test('REV-03: cenário de Rael preserva R$ 24, seleção exata dos brinquedos e troco', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(202));
  const total = findType(round, 'simulado-shopping-total');
  const afford = findType(round, 'simulado-shopping-affordability');
  const change = findType(round, 'simulado-shopping-change');
  assert.equal(total.data.moneyDenominationIds.reduce((sum, id) => sum + MONEY_DENOMINATIONS.find((money) => money.id === id).valueCents, 0), 2400);
  assert.equal(total.correctAnswer, 24);
  assert.equal(afford.data.scenarioId, total.data.scenarioId);
  assert.deepEqual([...afford.correctAnswers].sort(), ['dinosaur-3', 'truck-20']);
  assert.equal(validateAv2SimuladoAnswer(afford, ['truck-20']), false);
  assert.equal(validateAv2SimuladoAnswer(afford, ['truck-20', 'dinosaur-3']), true);
  assert.equal(validateAv2SimuladoAnswer(afford, ['truck-20', 'dinosaur-3', 'teddy-bear-25']), false);
  assert.equal(change.data.availableReais, 24);
  assert.equal(change.data.purchaseProductId, 'truck-20');
  assert.equal(validateAv2SimuladoAnswer(change, 4), true);
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
  assert.equal(byTask.cheapest.correctAnswer, 'pencil');
  assert.equal(byTask['most-expensive'].correctAnswer, 'notebook');
  assert.deepEqual(byTask['pencil-eraser-scissors'].data.productIds, ['pencil', 'eraser', 'scissors']);
  assert.equal(byTask['pencil-eraser-scissors'].correctAnswer, 9);
  assert.deepEqual(byTask['notebook-glue'].data.productIds, ['notebook', 'glue']);
  assert.equal(byTask['notebook-glue'].correctAnswer, 17);
  for (const question of board) assert.equal(validateAv2SimuladoQuestionCandidate(question), true);
});

test('REV-06: tabela mantém 200–239 ordenados e exige todos os espaços corretos', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(404));
  const question = findType(round, 'simulado-number-table');
  const table = question.data.table;
  assert.equal(table.values.length, 40);
  assert.deepEqual(table.values, Array.from({ length: 40 }, (_, index) => 200 + index));
  const answer = Object.fromEntries(table.gaps.map((index) => [index, table.values[index]]));
  assert.equal(validateAv2SimuladoAnswer(question, answer), true);
  assert.equal(validateAv2SimuladoAnswer(question, { ...answer, [table.gaps[0]]: '' }), false);
  assert.equal(validateAv2SimuladoAnswer(question, { ...answer, [table.gaps[0]]: 900 }), false);
  assert.equal(validateNumberTable(table, answer), true);
  assert.ok(table.gaps.length > 1);
  assert.ok(table.gaps.every((index, order) => table.values[index] === table.answers[order]));
});

test('REV-07: 208 e 215 exigem escrita digitada e aceitam apenas normalização de caixa e espaços', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(505));
  const byValue = new Map(round.filter((question) => question.type === 'simulado-word-write').map((question) => [question.data.value, question]));
  assert.equal(validateAv2SimuladoAnswer(byValue.get(208), '  DUZENTOS   E oito '), true);
  assert.equal(validateAv2SimuladoAnswer(byValue.get(208), 'duzentos e oitenta'), false);
  assert.equal(validateAv2SimuladoAnswer(byValue.get(215), 'duzentos e quinze'), true);
  assert.equal(byValue.get(208).options.length, 0);
  assert.doesNotMatch(`${byValue.get(208).prompt} ${byValue.get(208).speech} ${byValue.get(208).hint}`, /duzentos e oito/i);
  assert.doesNotMatch(`${byValue.get(215).prompt} ${byValue.get(215).speech} ${byValue.get(215).hint}`, /duzentos e quinze/i);
  assert.equal(round.filter((question) => question.type === 'simulado-word-write').length, 2);
});

test('REV-08: biblioteca usa C/D/U, valida as duas operações e associa os termos em quatro etapas', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(606));
  const question = findType(round, 'simulado-two-step');
  const [addition, additionTerms, subtraction, subtractionTerms] = question.data.steps;
  assert.deepEqual([addition.question.data.a, addition.question.data.b, addition.question.data.trace.result], [156, 195, 351]);
  assert.equal(addition.question.data.trace.pattern, 'both');
  assert.deepEqual(addition.question.data.trace.carries, { toTens: 1, toHundreds: 1, toThousands: 0 });
  assert.deepEqual(additionTerms.expectedRoles, { a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' });
  assert.deepEqual([subtraction.question.data.a, subtraction.question.data.b, subtraction.question.data.trace.result], [351, 147, 204]);
  assert.equal(subtraction.question.data.trace.pattern, 'units');
  assert.deepEqual(subtractionTerms.expectedRoles, { a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' });
  assert.equal(validateAv2SimuladoAnswer(question, 351, 1), true);
  assert.equal(validateAv2SimuladoAnswer(question, additionTerms.expectedRoles, 2), true);
  assert.equal(validateAv2SimuladoAnswer(question, 204, 3), true);
  assert.equal(validateAv2SimuladoAnswer(question, subtractionTerms.expectedRoles, 4), true);
  assert.equal(validateAv2SimuladoAnswer(question, 204, 1), false);
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
