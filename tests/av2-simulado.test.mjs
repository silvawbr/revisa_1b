import test from 'node:test';
import assert from 'node:assert/strict';
import { createCurrencyEquivalenceQuestion, MONEY_DENOMINATIONS, validateAv2MoneyQuestionCandidate } from '../src/av2/money.js';
import { getAv2MoneyCompositionChallenge, validateAv2MoneyCompositionChallenge, validateAv2MoneyCompositionSelection } from '../src/av2/money-composition.js';
import {
  AV2_SIMULADO_FULL_COVERAGE_PRESET_ID,
  createAv2SimuladoFocusRound,
  createAv2SimuladoFullCoverageRound,
  createAv2SimuladoRound,
  createAv2SimuladoWordQuestion,
  upgradeLegacyAv2SimuladoQuestion,
  validateAv2SimuladoAnswer,
  validateAv2SimuladoFullCoverageRound,
  validateAv2SimuladoQuestionCandidate,
  validateAv2SimuladoRound,
} from '../src/av2/simulado.js';
import { AV2_ALLOWED_ANSWER_MODES, getAv2AnswerMode, validateAv2AnswerMode } from '../src/av2/interaction-contract.js';
import { createNumberToWordQuestion, createRecognitionQuestion, numberToWordsPtBr, validateAv2SequencesQuestion, validateNumberTable } from '../src/av2/sequences.js';

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

test('REV-07: as duas direções de números por extenso usam quatro alternativas válidas', () => {
  const round = createAv2SimuladoFullCoverageRound(seededRandom(505));
  const questions = round.filter((question) => question.type === 'simulado-word');
  assert.equal(questions.length, 2);
  assert.equal(new Set(questions.map(({ data }) => data.value)).size, 2);
  assert.deepEqual(questions.map(({ data }) => data.mode).sort(), ['number-to-word', 'word-to-number']);
  for (const question of questions) {
    assert.equal(question.answerMode, 'single-choice');
    assert.equal(getAv2AnswerMode(question), 'single-choice');
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(({ value }) => value)).size, 4);
    assert.equal(new Set(question.options.map(({ label }) => label)).size, 4);
    assert.equal(question.options.filter(({ value }) => value === question.correctAnswer).length, 1);
    assert.ok(question.options.every(({ value }) => Number.isInteger(value)
      && (value >= 0 && value <= 250 || [300, 400].includes(value) && question.data.mode === 'number-to-word')));
    assert.equal(validateAv2SimuladoAnswer(question, question.correctAnswer), true);
    assert.equal(validateAv2SimuladoAnswer(question, numberToWordsPtBr(question.data.value)), false);
    if (question.data.mode === 'number-to-word') {
      assert.ok(question.options.every(({ value, label }) => label === numberToWordsPtBr(value)));
      assert.doesNotMatch(`${question.prompt} ${question.speech} ${question.hint}`, new RegExp(numberToWordsPtBr(question.data.value), 'i'));
    } else {
      assert.ok(question.options.every(({ value, label }) => label === String(value)));
      assert.match(question.prompt, new RegExp(numberToWordsPtBr(question.data.value), 'i'));
    }
  }
});

test('o caso móvel 246 é sempre uma pergunta de reconhecimento com a alternativa correta selecionável', () => {
  const question = createAv2SimuladoWordQuestion({ value: 246, mode: 'number-to-word', random: seededRandom(246) });
  assert.equal(question.prompt, 'Como se escreve o número 246 por extenso?');
  assert.equal(question.answerMode, 'single-choice');
  assert.equal(question.options.length, 4);
  assert.deepEqual(question.options.filter(({ value }) => value === 246).map(({ label }) => label), ['duzentos e quarenta e seis']);
  assert.equal(validateAv2SimuladoAnswer(question, 246), true);
  assert.equal(validateAv2SimuladoAnswer(question, 'duzentos e quarenta e seis'), false);
});

test('perguntas legadas por extenso são rejeitadas e convertidas antes de renderizar', () => {
  const legacy = {
    revisionId: 'av2-matematica', activityId: 'av2-simulado-block-07',
    pedagogicalCategory: 'NUMBER_WORD_WRITING', questionId: 'word-writing-246', type: 'simulado-word-write',
    data: { value: 246 }, correctAnswer: 'duzentos e quarenta e seis', options: [],
    prompt: 'Escreva o número 246 por extenso.', speech: 'Escreva o número 246 por extenso.',
    simulado: { questionId: 'legacy-word-246', subjectId: 'words', subjectIds: ['words'], reviewTargetKey: 'words-0' },
  };
  assert.equal(getAv2AnswerMode(legacy), 'alphabetic-input');
  assert.equal(validateAv2AnswerMode(legacy), false);
  assert.equal(validateAv2SimuladoQuestionCandidate(legacy), false);
  const converted = upgradeLegacyAv2SimuladoQuestion(legacy, seededRandom(247));
  assert.equal(converted.type, 'simulado-word');
  assert.equal(converted.answerMode, 'single-choice');
  assert.equal(converted.data.value, 246);
  assert.equal(converted.simulado.questionId, 'legacy-word-246');
  assert.equal(converted.simulado.reviewTargetKey, 'words-0');
  assert.equal(converted.options.length, 4);
  assert.equal(validateAv2SimuladoQuestionCandidate(converted), true);
  assert.equal(validateAv2SimuladoAnswer(converted, 'duzentos e quarenta e seis'), false);
  assert.equal(upgradeLegacyAv2SimuladoQuestion({ ...legacy, data: { value: '246' } }, seededRandom(1)), null);
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
  const writing = findType(complete, 'simulado-word');
  assert.equal(createAv2SimuladoFocusRound([{
    subjectId: 'money', sourceQuestionId: matching.simulado.questionId, sourceType: matching.type,
  }], seededRandom(10))[0].type, 'simulado-money-product-match');
  assert.equal(createAv2SimuladoFocusRound([{
    subjectId: 'words', sourceQuestionId: writing.simulado.questionId, sourceType: writing.type,
  }], seededRandom(11))[0].type, 'simulado-word');
});

test('1.000 rodadas AV2 semeadas respeitam o contrato em presets, configurações personalizadas e reforço', () => {
  const correctOptionPositions = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const configuration = seed % 5;
    const count = 1 + (Math.floor(seed / 5) % 5);
    const customCounts = configuration === 0
      ? { money: count, addition: count, subtraction: count, sequences: count, words: count }
      : configuration === 1 ? { money: 1, sequences: 3, words: 5 }
        : configuration === 2 ? { money: 3, addition: 3, subtraction: 3, sequences: 3, words: 3 }
          : configuration === 3 ? { addition: 5, words: 1 }
            : { money: count, subtraction: 2, words: 4 };
    const full = configuration === 4 && seed % 2 === 0;
    const round = full
      ? createAv2SimuladoFullCoverageRound(seededRandom(seed))
      : createAv2SimuladoRound(customCounts, seededRandom(seed));
    assert.equal(validateAv2SimuladoRound(round), true, `rodada ${seed}`);
    if (!full) assert.equal(validateAv2SimuladoRound(round, customCounts), true, `contagens da rodada ${seed}`);
    if (full) assert.equal(validateAv2SimuladoFullCoverageRound(round), true, `revisão completa ${seed}`);
    const questionIds = round.map((question) => question.simulado.questionId);
    assert.equal(new Set(questionIds).size, questionIds.length, `sem duplicatas na semente ${seed}`);
    for (const question of round) {
      assert.equal(validateAv2SimuladoQuestionCandidate(question), true, `${question.questionId}, semente ${seed}`);
      assert.ok(AV2_ALLOWED_ANSWER_MODES.includes(question.answerMode), `${question.type} declara um modo permitido`);
      assert.notEqual(question.type, 'simulado-word-write');
      assert.ok(question.simulado.subjectIds.every((id) => ['money', 'addition', 'subtraction', 'sequences', 'words'].includes(id)));
      if (question.type === 'simulado-word') {
        assert.equal(question.answerMode, 'single-choice');
        assert.equal(question.options.length, 4);
        assert.equal(question.options.filter(({ value }) => value === question.correctAnswer).length, 1);
        correctOptionPositions.add(question.options.findIndex(({ value }) => value === question.correctAnswer));
      }
      if (question.type === 'simulado-word' || question.type === 'simulado-sequence') {
        assert.equal(new Set(question.options.map((option) => typeof option === 'object' ? option.value : option)).size, question.options.length);
        assert.equal(question.options.filter((option) => (typeof option === 'object' ? option.value : option) === question.correctAnswer).length, 1);
      }
    }
    if (seed % 20 === 0) {
      const target = round.find((question) => question.simulado.subjectId === 'words');
      if (target) {
        const focus = createAv2SimuladoFocusRound([{
          subjectId: 'words', sourceQuestionId: target.simulado.questionId, sourceType: target.type,
        }], seededRandom(seed + 100000));
        assert.equal(validateAv2SimuladoRound(focus), true, `reforço da semente ${seed}`);
        assert.ok(focus.every((question) => question.type !== 'simulado-word-write'));
        assert.ok(focus.every((question) => AV2_ALLOWED_ANSWER_MODES.includes(question.answerMode)));
      }
    }
  }
  assert.ok(correctOptionPositions.size > 1, 'a posição da resposta correta varia entre as alternativas');
});

test('Block 05 e AV2 usam o mesmo contrato de seleção para reconhecer números por extenso', () => {
  const block05 = createNumberToWordQuestion(seededRandom(7), { value: 246 });
  const simulado = createAv2SimuladoWordQuestion({ value: 246, mode: 'number-to-word', random: seededRandom(8) });
  assert.equal(validateAv2SequencesQuestion(block05), true);
  assert.equal(block05.answerMode, 'single-choice');
  assert.equal(block05.options.length, 4);
  assert.equal(validateAv2SimuladoQuestionCandidate(simulado), true);
  assert.equal(simulado.answerMode, block05.answerMode);
});

test('1.000 perguntas do Block 05 mantêm quatro opções escritas ou numéricas e ordem aleatória', () => {
  const correctPositions = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const questions = [
      createNumberToWordQuestion(seededRandom(seed)),
      createRecognitionQuestion(seededRandom(seed + 10000)),
    ];
    for (const question of questions) {
      assert.equal(validateAv2SequencesQuestion(question), true, `questão ${question.category}, semente ${seed}`);
      assert.equal(question.answerMode, 'single-choice');
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.equal(question.options.filter((value) => value === question.correctAnswer).length, 1);
      correctPositions.add(question.options.indexOf(question.correctAnswer));
      if (question.category === 'NUM-06') {
        assert.equal(new Set(question.optionLabels).size, 4);
        assert.deepEqual(question.optionLabels, question.options.map(numberToWordsPtBr));
      }
    }
  }
  assert.ok(correctPositions.size > 1);
});
