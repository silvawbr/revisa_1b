import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AV2_MONEY_ACTIVITY_ID,
  AV2_REVISION_ID,
  AV2_SHOPPING_ACTIVITY_ID,
  AV2_PEDAGOGICAL_CATEGORIES,
  BANKNOTES,
  COINS,
  MONEY_DENOMINATIONS,
  createAv2Round,
  createAv2ShoppingRound,
  createComparisonQuestion,
  createCurrencyCompositionQuestion,
  createCurrencyEquivalenceQuestion,
  createIdentificationQuestion,
  validateAv2MoneyQuestionCandidate,
  validateAv2Answer,
} from '../src/av2/money.js';
import { AV2_PROGRESS_STORAGE_KEY, AV2_SHOPPING_PROGRESS_STORAGE_KEY, createAv2ProgressStore } from '../src/av2/progress.js';
import { CHILD_NAME_STORAGE_KEY } from '../src/child-profile.js';
import { numberToPortuguese } from '../src/game.js';

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

test('todas as moedas e cédulas têm IDs únicos, centavos inteiros, rótulos e representação', async () => {
  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  const attributions = await fs.readFile(path.join(root, 'public/currency/ATTRIBUTIONS.md'), 'utf8');
  const expected = new Map([
    ['coin-5-centavos', 5], ['coin-10-centavos', 10], ['coin-25-centavos', 25],
    ['coin-50-centavos', 50], ['coin-1-real', 100], ['note-2-reais', 200],
    ['note-5-reais', 500], ['note-10-reais', 1000], ['note-20-reais', 2000],
    ['note-50-reais', 5000], ['note-100-reais', 10000], ['note-200-reais', 20000],
  ]);
  assert.equal(MONEY_DENOMINATIONS.length, 12);
  assert.equal(new Set(MONEY_DENOMINATIONS.map(({ id }) => id)).size, 12);
  assert.equal(COINS.length, 5);
  assert.equal(BANKNOTES.length, 7);
  for (const money of MONEY_DENOMINATIONS) {
    assert.equal(money.valueCents, expected.get(money.id), money.id);
    assert.equal(Number.isInteger(money.valueCents), true);
    assert.ok(money.label.length > 0);
    assert.ok(money.spokenLabel.length > 0);
    assert.ok(money.description.length > 0);
    const imageUrl = new URL(money.imageUrl);
    const imageFile = decodeURIComponent(imageUrl.pathname.split('/').at(-1));
    assert.equal(imageUrl.protocol, 'https:');
    assert.equal(imageUrl.hostname, 'commons.wikimedia.org');
    assert.match(imageUrl.pathname, /Special:FilePath\//);
    assert.equal(imageUrl.searchParams.get('width'), '600');
    assert.ok(attributions.includes(imageFile), `${money.id} precisa de crédito de imagem`);
    assert.equal(Object.isFrozen(money), true);
    assert.doesNotMatch(money.label, /R\$|\d+\.\d{2}/);
  }
  assert.deepEqual(COINS.map(({ label }) => label), ['5 centavos', '10 centavos', '25 centavos', '50 centavos', '1 real']);
  assert.deepEqual(BANKNOTES.map(({ label }) => label), ['2 reais', '5 reais', '10 reais', '20 reais', '50 reais', '100 reais', '200 reais']);
  assert.match(styles, /\.money-object-image\s*\{/);
  assert.doesNotMatch(styles, /\.money-sem-valor\s*\{/);
});

test('cada questão de identificação tem uma resposta correta e alternativas distintas da mesma categoria', () => {
  const positions = new Set();
  for (const money of MONEY_DENOMINATIONS) {
    const question = createIdentificationQuestion({ denomination: money, random: seededRandom(money.valueCents) });
    assert.equal(question.revisionId, AV2_REVISION_ID);
    assert.equal(question.activityId, AV2_MONEY_ACTIVITY_ID);
    assert.equal(question.type, 'identification');
    assert.equal(question.data.denominationId, money.id);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.equal(question.options.filter((id) => id === question.correctAnswer).length, 1);
    assert.equal(question.correctAnswer, money.id);
    assert.equal(question.options.every((id) => MONEY_DENOMINATIONS.find((candidate) => candidate.id === id)?.kind === money.kind), true);
    const values = question.options.map((id) => MONEY_DENOMINATIONS.find((candidate) => candidate.id === id).valueCents);
    assert.equal(new Set(values).size, 4);
    assert.equal(validateAv2Answer(question, money.id), true);
    assert.equal(validateAv2Answer(question, question.options.find((id) => id !== money.id)), false);
    positions.add(question.options.indexOf(money.id));
  }
  assert.ok(positions.size > 1);
});

test('comparações entre moedas, cédulas e valores mistos nunca empatam e validam maior e menor', () => {
  for (const category of ['coin', 'note', 'mixed']) {
    for (const direction of ['greater', 'less']) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const question = createComparisonQuestion({ category, direction, random: seededRandom(seed) });
        const left = MONEY_DENOMINATIONS.find(({ id }) => id === question.data.leftId);
        const right = MONEY_DENOMINATIONS.find(({ id }) => id === question.data.rightId);
        assert.equal(question.revisionId, AV2_REVISION_ID);
        assert.equal(question.activityId, AV2_MONEY_ACTIVITY_ID);
        assert.equal(question.type, 'comparison');
        assert.notEqual(left.id, right.id);
        assert.notEqual(left.valueCents, right.valueCents);
        assert.equal(question.options.length, 2);
        assert.equal(new Set(question.options).size, 2);
        assert.equal(question.options.includes(question.correctAnswer), true);
        assert.equal(validateAv2Answer(question, question.correctAnswer), true);
        assert.equal(validateAv2Answer(question, question.options.find((id) => id !== question.correctAnswer)), false);
        assert.equal(question.correctAnswer, direction === 'greater'
          ? (left.valueCents > right.valueCents ? left.id : right.id)
          : (left.valueCents < right.valueCents ? left.id : right.id));
      }
    }
  }
});

test('rodadas têm dez perguntas, composição 6+4, variedade de valores e IDs sem repetição', () => {
  const signatures = new Set();
  const answerPositions = new Set();
  for (let seed = 1; seed <= 50; seed += 1) {
    const round = createAv2Round(seededRandom(seed));
    const identification = round.filter(({ type }) => type === 'identification');
    const comparisons = round.filter(({ type }) => type === 'comparison');
    const equivalences = round.filter(({ type }) => type === 'equivalence');
    assert.equal(round.length, 10);
    assert.equal(identification.length, 6);
    assert.equal(comparisons.length, 3);
    assert.equal(equivalences.length, 1);
    assert.equal(new Set(round.map(({ questionId }) => questionId)).size, 10);
    assert.equal(new Set(identification.map(({ data }) => data.denominationId)).size, 6);
    assert.equal(identification.filter(({ data }) => MONEY_DENOMINATIONS.find(({ id }) => id === data.denominationId).kind === 'coin').length, 3);
    assert.equal(identification.filter(({ data }) => MONEY_DENOMINATIONS.find(({ id }) => id === data.denominationId).kind === 'note').length, 3);
    assert.deepEqual(new Set(comparisons.map(({ data }) => data.category)), new Set(['coin', 'note', 'mixed']));
    assert.equal(equivalences.every(({ correctAnswer, data }) => correctAnswer === (data.targetDenominationId ?? 1)), true);
    assert.deepEqual(new Set(comparisons.map(({ data }) => data.direction)), new Set(['greater', 'less']));
    for (const question of round) answerPositions.add(question.options.indexOf(question.correctAnswer));
    signatures.add(round.map(({ questionId, options }) => `${questionId}:${options.join(',')}`).join('|'));
  }
  assert.ok(signatures.size > 1);
  assert.ok(answerPositions.size > 1);
});

test('valida milhares de candidatos e bloqueia regressões de unidade e conversão monetária', () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const round = createAv2Round(seededRandom(seed));
    for (const question of round) {
      assert.equal(validateAv2MoneyQuestionCandidate(question), true, question.questionId);
      assert.ok(question.pedagogicalCategory);
      assert.equal(validateAv2Answer(question, question.correctAnswer), true, question.questionId);
    }
  }
  const shoppingVariationSignatures = new Set();
  for (let seed = 1; seed <= 500; seed += 1) {
    const round = createAv2ShoppingRound(seededRandom(seed));
    assert.equal(round.length, 10);
    shoppingVariationSignatures.add(round.map(({ questionId }) => questionId).filter((id) => /var-|budget-|change-|sum-|pair-/.test(id)).sort().join('|'));
    for (const question of round) {
      assert.equal(validateAv2MoneyQuestionCandidate(question), true, question.questionId);
      if (question.type === 'shopping-affordability') {
        assert.equal(new Set(question.options).size, question.options.length);
        assert.deepEqual([...question.correctAnswers].sort(), question.data.products
          .filter(({ priceReais }) => priceReais <= question.data.availableReais)
          .map(({ id }) => id).sort());
        assert.equal(validateAv2Answer(question, question.correctAnswers), true);
      } else {
        assert.equal(question.options.filter((option) => option === question.correctAnswer).length, 1);
        assert.equal(validateAv2Answer(question, question.correctAnswer), true);
      }
    }
  }
  assert.ok(shoppingVariationSignatures.size > 10, 'as sementes alteram os valores das variações, não apenas a ordem das questões');

  const candidate = ({ type, pedagogicalCategory, data, correctAnswer, options, prompt = 'Resolva a questão.' }) => ({
    revisionId: AV2_REVISION_ID,
    activityId: AV2_MONEY_ACTIVITY_ID,
    type,
    pedagogicalCategory,
    data,
    correctAnswer,
    options,
    prompt,
    speech: prompt,
    explanation: 'Observe os valores com calma.',
    hint: 'Leia a questão.',
    feedback: { correct: 'Muito bem!', retry: 'Tente novamente.' },
  });
  const operation = ({ data, correctAnswer, options, prompt }) => candidate({
    type: 'operation', pedagogicalCategory: data.domain === 'BRL_INTEIROS' ? 'WHOLE_REAL_ARITHMETIC' : 'CENTAVO_ARITHMETIC', data, correctAnswer, options, prompt,
  });

  const mixedUnits = operation({
    data: {
      operation: 'addition',
      domain: 'BRL_INTEIROS',
      operands: [
        { value: 5, unit: 'reais' },
        { value: 50, unit: 'centavos' },
        { value: 50, unit: 'centavos' },
      ],
      resultUnit: 'reais',
    },
    correctAnswer: 6,
    options: [5, 6, 7, 8],
    prompt: 'Marina comprou um biscoito por 5 reais e 50 centavos e uma figurinha por 50 centavos.',
  });
  assert.equal(validateAv2MoneyQuestionCandidate(mixedUnits), false, 'Caso A: rejeitar soma que mistura unidades');

  const conversionToReal = operation({
    data: {
      operation: 'addition',
      domain: 'CENTAVOS',
      operands: [25, 50, 25].map((value) => ({ value, unit: 'centavos' })),
      resultUnit: 'centavos',
      representations: [['coin-25-centavos'], ['coin-50-centavos'], ['coin-25-centavos']],
    },
    correctAnswer: 100,
    options: [75, 100, 50, 25],
    prompt: 'Quanto valem 25, 50 e 25 centavos? Responda em reais.',
  });
  assert.equal(validateAv2MoneyQuestionCandidate(conversionToReal), false, 'Caso B: rejeitar total que exige conversão');

  const denominationComparison = candidate({
    type: 'comparison',
    pedagogicalCategory: 'DENOMINATION_COMPARISON',
    data: {
      leftId: 'coin-1-real',
      rightId: 'coin-50-centavos',
      category: 'coin',
      direction: 'greater',
    },
    correctAnswer: 'coin-1-real',
    options: ['coin-1-real', 'coin-50-centavos'],
    prompt: 'Qual moeda vale mais, 1 real ou 50 centavos?',
  });
  assert.equal(validateAv2MoneyQuestionCandidate(denominationComparison), true, 'Caso C: aceitar comparação entre denominações');

  const wholeRealSum = operation({
    data: {
      operation: 'addition',
      domain: 'BRL_INTEIROS',
      operands: [5, 2, 1].map((value) => ({ value, unit: 'reais' })),
      resultUnit: 'reais',
      representations: [['note-5-reais'], ['note-2-reais'], ['coin-1-real']],
    },
    correctAnswer: 8,
    options: [7, 8, 9, 10],
    prompt: '5 reais + 2 reais + 1 real. Quanto é?',
  });
  assert.equal(validateAv2MoneyQuestionCandidate(wholeRealSum), true, 'Caso D: aceitar soma em reais inteiros');

  const centsChange = operation({
    data: {
      operation: 'subtraction',
      domain: 'CENTAVOS',
      operands: [75, 60].map((value) => ({ value, unit: 'centavos' })),
      resultUnit: 'centavos',
      representations: [['coin-50-centavos', 'coin-25-centavos'], ['coin-50-centavos', 'coin-10-centavos']],
    },
    correctAnswer: 15,
    options: [10, 15, 20, 25],
    prompt: '75 centavos menos 60 centavos. Quanto sobrou?',
  });
  assert.equal(validateAv2MoneyQuestionCandidate(centsChange), true, 'Caso E: aceitar troco em centavos');
  assert.equal(validateAv2MoneyQuestionCandidate({ ...wholeRealSum, prompt: 'R$ 8,00' }), true, 'aceitar notação escrita quando o total inteiro confere');
  assert.equal(validateAv2MoneyQuestionCandidate(operation({
    data: {
      operation: 'addition',
      domain: 'CENTAVOS',
      operands: [{ value: 1, unit: 'centavos' }, { value: 5, unit: 'centavos' }],
      resultUnit: 'centavos',
    },
    correctAnswer: 6,
    options: [5, 6, 10, 15],
    prompt: '1 centavo + 5 centavos. Quanto é?',
  })), false, 'não usar moeda de 1 centavo em operações');

  for (const group of [
    ['coin-50-centavos', 'coin-50-centavos'],
    ['coin-25-centavos', 'coin-50-centavos', 'coin-25-centavos'],
  ]) {
    const equivalence = createCurrencyEquivalenceQuestion({ denominationIds: group, random: seededRandom(group.length) });
    assert.equal(equivalence.pedagogicalCategory, 'CURRENCY_EQUIVALENCE');
    assert.equal(equivalence.correctAnswer, 1);
    assert.equal(validateAv2MoneyQuestionCandidate(equivalence), true);
  }
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...wholeRealSum,
    data: { ...wholeRealSum.data, operation: 'addition', domain: 'BRL_INTEIROS' },
  }), true);
  assert.equal(validateAv2MoneyQuestionCandidate({ ...wholeRealSum, pedagogicalCategory: 'CURRENCY_EQUIVALENCE' }), false, 'categoria precisa corresponder à pergunta');
  assert.equal(validateAv2MoneyQuestionCandidate({ revisionId: AV2_REVISION_ID, activityId: AV2_MONEY_ACTIVITY_ID, pedagogicalCategory: 'DENOMINATION_RECOGNITION' }), false, 'candidato sem tipo é rejeitado sem erro');
});

test('o contrato pedagógico está documentado e ligado no README', async () => {
  const readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
  const contract = await fs.readFile(path.join(root, 'docs/av2-matematica-contrato-pedagogico.md'), 'utf8');
  assert.match(readme, /\[Contrato Pedagógico da AV2 Matemática\]\(docs\/av2-matematica-contrato-pedagogico\.md\)/);
  assert.match(contract, /WHOLE_REAL_ARITHMETIC/);
  assert.match(contract, /CENTAVO_ARITHMETIC/);
  assert.match(contract, /25 \+ 50 \+ 25 centavos = 1 real/);
});

test('regressões escolares de cálculo e escrita por extenso permanecem exatas', () => {
  assert.equal(156 + 195, 351);
  assert.equal(351 - 147, 204);
  assert.equal(862 - 695, 167);
  assert.equal(numberToPortuguese(208), 'duzentos e oito');
  assert.equal(numberToPortuguese(215), 'duzentos e quinze');
  assert.equal(numberToPortuguese(300), 'trezentos');
  assert.equal(numberToPortuguese(400), 'quatrocentos');
  assert.throws(() => numberToPortuguese(251), RangeError);
  assert.throws(() => numberToPortuguese(301), RangeError);
});

test('a revisão oficial libera equivalências e compras específicas sem liberar preços decimais', () => {
  const equivalenceGroups = [
    ['coin-50-centavos', 'coin-50-centavos'],
    ['coin-25-centavos', 'coin-50-centavos', 'coin-25-centavos'],
  ];
  for (const denominationIds of equivalenceGroups) {
    const question = createCurrencyEquivalenceQuestion({ denominationIds, random: seededRandom(41) });
    assert.equal(question.correctAnswer, 1);
    assert.equal(question.data.amountCents, 100);
    assert.equal(validateAv2MoneyQuestionCandidate(question), true);
  }
  for (const [denominationIds, expected] of [
    [['coin-5-centavos', 'coin-5-centavos'], 10],
    [['coin-10-centavos', 'coin-10-centavos', 'coin-5-centavos'], 25],
    [Array(5).fill('coin-10-centavos'), 50],
  ]) {
    const question = createCurrencyEquivalenceQuestion({ denominationIds, random: seededRandom(expected) });
    assert.equal(question.correctAnswer, expected);
    assert.equal(question.data.resultUnit, 'centavos');
    assert.equal(validateAv2MoneyQuestionCandidate(question), true, 'equivalências suplementares do livro continuam aceitas');
  }
  const noteEquivalence = createCurrencyEquivalenceQuestion({
    denominationIds: ['note-5-reais', 'note-5-reais'], targetDenominationId: 'note-10-reais', random: seededRandom(10),
  });
  assert.equal(validateAv2MoneyQuestionCandidate(noteEquivalence), true, 'equivalência anterior entre grupos de cédulas continua aceita');
  const writtenEquivalence = createCurrencyEquivalenceQuestion({ denominationIds: equivalenceGroups[0], random: seededRandom(4) });
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...writtenEquivalence,
    prompt: 'R$0,50 + R$0,50 = R$1,00',
    speech: 'R$0,50 + R$0,50 = R$1,00',
  }), true);

  const composition = createCurrencyCompositionQuestion({
    denominationIds: ['coin-1-real', 'coin-50-centavos', 'coin-25-centavos', 'coin-25-centavos'],
    random: seededRandom(23),
  });
  assert.equal(composition.correctAnswer, 2);
  assert.equal(validateAv2MoneyQuestionCandidate(composition), true);
  const fullCentavoGroup = Array(10).fill('coin-10-centavos');
  assert.equal(validateAv2MoneyQuestionCandidate(createCurrencyEquivalenceQuestion({
    denominationIds: fullCentavoGroup, random: seededRandom(100),
  })), true, 'a categoria permite grupos de moedas que totalizem exatamente 100 centavos');
  assert.equal(validateAv2MoneyQuestionCandidate(createCurrencyCompositionQuestion({
    denominationIds: fullCentavoGroup, random: seededRandom(101),
  })), true);
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...composition,
    data: { ...composition.data, denominationIds: ['coin-1-real', 'coin-50-centavos'], amountCents: 150 },
    correctAnswer: 1.5,
  }), false, 'rejeita composição que termina em reais e centavos');

  const matchingGroup = createCurrencyEquivalenceQuestion({
    denominationIds: Array(5).fill('coin-1-real'), targetDenominationId: 'note-5-reais', random: seededRandom(5),
  });
  assert.equal(validateAv2MoneyQuestionCandidate(matchingGroup), true, 'a cédula precisa igualar exatamente o grupo');
  const mixedMatchingGroup = createCurrencyEquivalenceQuestion({
    denominationIds: ['coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-50-centavos', 'coin-25-centavos', 'coin-25-centavos'],
    targetDenominationId: 'note-5-reais', random: seededRandom(6),
  });
  assert.equal(validateAv2MoneyQuestionCandidate(mixedMatchingGroup), true, 'composição mista inteira também pode corresponder a uma cédula');
  const impossibleMatch = {
    ...matchingGroup,
    data: { ...matchingGroup.data, denominationIds: [
      'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-50-centavos', 'coin-10-centavos',
    ], amountCents: 460 },
    options: ['note-2-reais', 'note-5-reais', 'note-10-reais'],
  };
  assert.equal(validateAv2MoneyQuestionCandidate(impossibleMatch), false, 'quatro reais e sessenta centavos não têm alternativa correta');

  const shopping = createAv2ShoppingRound(seededRandom(1));
  assert.equal(shopping.length, 10);
  for (const question of shopping) {
    assert.equal(question.activityId, AV2_SHOPPING_ACTIVITY_ID);
    assert.equal(question.pedagogicalCategory, 'SHOPPING_PROBLEM');
    assert.equal(validateAv2MoneyQuestionCandidate(question), true);
  }
  const total24 = shopping.find((question) => question.type === 'shopping-available-total' && question.correctAnswer === 24);
  assert.ok(total24, '5 + 5 + 10 + 2 + 2 reais = 24');
  assert.equal(validateAv2MoneyQuestionCandidate({ ...total24, prompt: 'Quanto dinheiro há? R$24,00', speech: 'Quanto dinheiro há? R$24,00' }), true);
  assert.equal(validateAv2MoneyQuestionCandidate({ ...total24, prompt: 'Quanto dinheiro há? R$30,00', speech: 'Quanto dinheiro há? R$30,00' }), false);
  const fiftyCentEquivalence = {
    ...total24,
    data: { denominationIds: ['coin-50-centavos', 'coin-50-centavos'] },
    correctAnswer: 1,
    options: [0, 1, 2, 3],
    explanation: 'O grupo de moedas soma 1 real.',
    feedback: { correct: 'Muito bem! O grupo de moedas soma 1 real.', retry: 'Tente novamente.' },
  };
  assert.equal(validateAv2MoneyQuestionCandidate(fiftyCentEquivalence), true, 'dinheiro disponível pode usar equivalência de centavos documentada');
  assert.equal(validateAv2Answer(fiftyCentEquivalence, 1), true);
  const quarterEquivalence = {
    ...fiftyCentEquivalence,
    data: { denominationIds: ['coin-25-centavos', 'coin-50-centavos', 'coin-25-centavos'] },
    explanation: 'O grupo de moedas soma 1 real.',
    feedback: { correct: 'Muito bem! O grupo de moedas soma 1 real.', retry: 'Tente novamente.' },
  };
  assert.equal(validateAv2MoneyQuestionCandidate(quarterEquivalence), true, '25 + 50 + 25 centavos também pode formar um real disponível');
  const mixedWholeRealGroup = {
    ...fiftyCentEquivalence,
    data: { denominationIds: ['coin-1-real', 'coin-50-centavos', 'coin-25-centavos', 'coin-25-centavos'] },
    correctAnswer: 2,
    options: [1, 2, 3, 4],
    explanation: 'O grupo de moedas soma 2 reais.',
    feedback: { correct: 'Muito bem! O grupo de moedas soma 2 reais.', retry: 'Tente novamente.' },
  };
  assert.equal(validateAv2MoneyQuestionCandidate(mixedWholeRealGroup), true, 'dinheiro disponível pode combinar reais e uma equivalência completa de centavos');
  const fractionalRealGroup = {
    ...total24,
    data: { denominationIds: ['note-2-reais', 'note-2-reais', 'coin-50-centavos', 'coin-10-centavos'] },
    correctAnswer: 4,
    options: [3, 4, 5, 6],
  };
  assert.equal(validateAv2MoneyQuestionCandidate(fractionalRealGroup), false, 'rejeita 4 reais e 60 centavos quando as respostas estão em reais inteiros');
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...total24,
    data: { denominationIds: ['coin-1-real', 'note-2-reais'] },
    correctAnswer: 3,
    options: [2, 3, 4, 5],
    explanation: 'O grupo de moedas e cédulas soma 3 reais.',
    feedback: { correct: 'Muito bem! O grupo de moedas e cédulas soma 3 reais.', retry: 'Tente novamente.' },
  }), true, 'dinheiro disponível pode combinar denominações inteiras em reais');
  const affordability = shopping.find((question) => question.type === 'shopping-affordability' && question.data.availableReais === 24);
  assert.deepEqual([...affordability.correctAnswers].sort(), ['caderno-3', 'livro-20']);
  assert.equal(validateAv2Answer(affordability, ['caderno-3', 'livro-20']), true);
  assert.equal(validateAv2Answer(affordability, ['caderno-3']), false);
  assert.equal(validateAv2Answer(affordability, ['caderno-3', 'livro-20', 'urso-25']), false);
  assert.equal(shopping.find((question) => question.type === 'shopping-change' && question.correctAnswer === 4).data.availableReais, 24);
  assert.equal(shopping.some((question) => question.type === 'shopping-product-sum' && question.correctAnswer === 9), true);
  assert.equal(shopping.some((question) => question.type === 'shopping-selected-total' && question.correctAnswer === 17), true);

  const invalidAffordability = { ...affordability, correctAnswers: ['livro-20', 'urso-25'] };
  assert.equal(validateAv2MoneyQuestionCandidate(invalidAffordability), false, 'validador bloqueia conjunto de produtos errado');
  assert.equal(validateAv2MoneyQuestionCandidate({ ...affordability, options: undefined }), false, 'validador rejeita candidato sem alternativas sem lançar exceção');
  const invalidChange = { ...shopping.find((question) => question.type === 'shopping-change' && question.correctAnswer === 4), correctAnswer: 5 };
  assert.equal(validateAv2MoneyQuestionCandidate(invalidChange), false, 'validador bloqueia troco inconsistente');
  const decimalShopping = {
    ...shopping.find((question) => question.type === 'shopping-product-sum'),
    prompt: 'R$5,50 + R$0,50. Quanto custa?',
  };
  assert.equal(validateAv2MoneyQuestionCandidate(decimalShopping), false, 'preços decimais arbitrários seguem sem suporte');
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...total24,
    data: { denominationIds: ['note-50-reais', 'note-50-reais'] },
    correctAnswer: 100,
    options: [98, 99, 100, 101],
  }), false, 'não extrapola a faixa de dinheiro total demonstrada');
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...affordability,
    data: { ...affordability.data, products: affordability.data.products.map((product, index) => index === 0 ? { ...product, priceReais: 48 } : product) },
  }), false, 'não cria preço de produto além da evidência complementar');
  assert.ok(AV2_PEDAGOGICAL_CATEGORIES.includes('CURRENCY_EQUIVALENCE'));
  assert.ok(AV2_PEDAGOGICAL_CATEGORIES.includes('SHOPPING_PROBLEM'));
});

test('reconhecimento aceita representação monetária escrita quando o valor visual confere', () => {
  const coin = createIdentificationQuestion({ denomination: 'coin-50-centavos', random: seededRandom(51) });
  const writtenCoin = { ...coin, prompt: 'Quanto vale esta moeda? R$0,50', speech: 'Quanto vale esta moeda? R$0,50' };
  assert.equal(validateAv2MoneyQuestionCandidate(writtenCoin), true);
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...writtenCoin, prompt: 'Quanto vale esta moeda? R$1,00', speech: 'Quanto vale esta moeda? R$1,00',
  }), false, 'texto monetário e denominação precisam concordar');
  const note = createIdentificationQuestion({ denomination: 'note-20-reais', random: seededRandom(52) });
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...note, prompt: 'Qual é o valor desta cédula? R$20,00', speech: 'Qual é o valor desta cédula? R$20,00',
  }), true);
  const comparison = createComparisonQuestion({ category: 'mixed', direction: 'greater', random: seededRandom(1) });
  const left = MONEY_DENOMINATIONS.find(({ id }) => id === comparison.data.leftId);
  const right = MONEY_DENOMINATIONS.find(({ id }) => id === comparison.data.rightId);
  const writtenValues = [left, right].map(({ valueCents }) => `R$${Math.floor(valueCents / 100)},${String(valueCents % 100).padStart(2, '0')}`).join(' ou ');
  assert.equal(validateAv2MoneyQuestionCandidate({
    ...comparison, prompt: `Qual vale mais: ${writtenValues}?`, speech: `Qual vale mais: ${writtenValues}?`,
  }), true);
});

test('o progresso AV2 usa chave própria e não altera o nome nem os dados da revisão anterior', () => {
  const original = {
    [CHILD_NAME_STORAGE_KEY]: 'Ana',
    'revisao-matematica.progress.v1': '{"roundsCompleted":7}',
  };
  const storage = memoryStorage(original);
  const progress = createAv2ProgressStore({ storage });
  assert.equal(AV2_PROGRESS_STORAGE_KEY, 'av2-matematica.block-01.dinheiro.progress.v1');
  assert.equal(AV2_SHOPPING_PROGRESS_STORAGE_KEY, 'av2-matematica.block-02.compras.progress.v1');
  assert.deepEqual(progress.get(), { roundsCompleted: 0 });
  assert.deepEqual(progress.completeRound(), { roundsCompleted: 1 });
  assert.deepEqual(createAv2ProgressStore({ storage }).get(), { roundsCompleted: 1 });
  assert.equal(storage.getItem(CHILD_NAME_STORAGE_KEY), 'Ana');
  assert.equal(storage.getItem('revisao-matematica.progress.v1'), '{"roundsCompleted":7}');
  assert.equal(JSON.parse(storage.getItem(AV2_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
  const shoppingProgress = createAv2ProgressStore({ storage, key: AV2_SHOPPING_PROGRESS_STORAGE_KEY });
  assert.deepEqual(shoppingProgress.completeRound(), { roundsCompleted: 1 });
  assert.equal(JSON.parse(storage.getItem(AV2_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);
  assert.equal(JSON.parse(storage.getItem(AV2_SHOPPING_PROGRESS_STORAGE_KEY)).roundsCompleted, 1);

  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const memoryOnly = createAv2ProgressStore({ storage: blocked });
  assert.deepEqual(memoryOnly.completeRound(), { roundsCompleted: 1 });
  assert.deepEqual(memoryOnly.get(), { roundsCompleted: 1 });
});

test('a interface oferece as duas revisões, mantém o gerador anterior e publica os módulos AV2', async () => {
  const [app, server, css] = await Promise.all([
    fs.readFile(path.join(root, 'app.js'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
    fs.readFile(path.join(root, 'styles.css'), 'utf8'),
  ]);
  assert.match(app, /data-action="start"/);
  assert.match(app, /data-action="av2-entry"/);
  assert.match(app, /data-action="start-av2"/);
  assert.match(app, /data-action="start-av2-shopping"/);
  assert.match(app, /data-action="home"/);
  assert.match(app, /data-action="next-av2"/);
  assert.match(app, /data-av2-answer=/);
  assert.match(app, /state\.round = createRound\(\)/);
  assert.match(app, /state\.av2Round = block === 'block-02' \? createAv2ShoppingRound\(\) : createAv2Round\(\)/);
  assert.match(app, /data-action="submit-av2"/);
  assert.match(app, /AV2_PROGRESS_STORAGE_KEY|createAv2ProgressStore/);
  assert.match(app, /createChildProfileStore\(\)/);
  assert.match(app, /aria-label="\$\{escapeAttribute\(money\.description\)\}"/);
  assert.match(app, /class="money-object-image" src="\$\{escapeAttribute\(money\.imageUrl\)\}"/);
  assert.doesNotMatch(app, /money-sem-valor|SEM VALOR/);
  const av2Interface = app.slice(app.indexOf('function renderMoneyIllustration'), app.indexOf('function renderAv2Feedback'));
  assert.doesNotMatch(av2Interface, /R\$\s*\d|\b\d+,\d{2}\b|\b0\.\d{2}\b/);
  assert.match(server, /src\/av2\/money\.js/);
  assert.match(server, /src\/av2\/progress\.js/);
  assert.match(server, /public\/currency\/ATTRIBUTIONS\.md/);
  assert.match(css, /@media \(max-width: 460px\)/);
  assert.match(css, /\.av2-money-option/);
});
