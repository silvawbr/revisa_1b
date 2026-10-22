export const AV2_REVISION_ID = 'av2-matematica';
export const AV2_MONEY_ACTIVITY_ID = 'dinheiro-reconhecimento-e-comparacao';
export const AV2_SHOPPING_ACTIVITY_ID = 'dinheiro-compras-e-troco';
export const AV2_PEDAGOGICAL_CATEGORIES = Object.freeze([
  'DENOMINATION_RECOGNITION',
  'DENOMINATION_COMPARISON',
  'CURRENCY_EQUIVALENCE',
  'CURRENCY_COMPOSITION',
  'WHOLE_REAL_ARITHMETIC',
  'CENTAVO_ARITHMETIC',
  'SHOPPING_PROBLEM',
]);

function commonsImage(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=600`;
}

export const MONEY_DENOMINATIONS = Object.freeze([
  { id: 'coin-5-centavos', kind: 'coin', valueCents: 5, label: '5 centavos', spokenLabel: 'moeda de 5 centavos', imageUrl: commonsImage('5 CENTAVOS Brasil 1998.jpg'), description: 'Moeda brasileira de 5 centavos, frente e verso.' },
  { id: 'coin-10-centavos', kind: 'coin', valueCents: 10, label: '10 centavos', spokenLabel: 'moeda de 10 centavos', imageUrl: commonsImage('ME0DA10 centavo2BR.jpg'), description: 'Moeda brasileira de 10 centavos, frente e verso.' },
  { id: 'coin-25-centavos', kind: 'coin', valueCents: 25, label: '25 centavos', spokenLabel: 'moeda de 25 centavos', imageUrl: commonsImage('25 centavosDeodoro da Fonseca.jpg'), description: 'Moeda brasileira de 25 centavos, frente e verso.' },
  { id: 'coin-50-centavos', kind: 'coin', valueCents: 50, label: '50 centavos', spokenLabel: 'moeda de 50 centavos', imageUrl: commonsImage('Moeda de 50 centavos Barão do Rio Branco.png'), description: 'Moeda brasileira de 50 centavos, frente e verso.' },
  { id: 'coin-1-real', kind: 'coin', valueCents: 100, label: '1 real', spokenLabel: 'moeda de 1 real', imageUrl: commonsImage('Moeda de 1 Real de 1998.png'), description: 'Moeda brasileira de 1 real, frente e verso.' },
  { id: 'note-2-reais', kind: 'note', valueCents: 200, label: '2 reais', spokenLabel: 'cédula de 2 reais', imageUrl: commonsImage('2 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 2 reais, da segunda família.' },
  { id: 'note-5-reais', kind: 'note', valueCents: 500, label: '5 reais', spokenLabel: 'cédula de 5 reais', imageUrl: commonsImage('5 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 5 reais, da segunda família.' },
  { id: 'note-10-reais', kind: 'note', valueCents: 1000, label: '10 reais', spokenLabel: 'cédula de 10 reais', imageUrl: commonsImage('10 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 10 reais, da segunda família.' },
  { id: 'note-20-reais', kind: 'note', valueCents: 2000, label: '20 reais', spokenLabel: 'cédula de 20 reais', imageUrl: commonsImage('20 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 20 reais, da segunda família.' },
  { id: 'note-50-reais', kind: 'note', valueCents: 5000, label: '50 reais', spokenLabel: 'cédula de 50 reais', imageUrl: commonsImage('50 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 50 reais, da segunda família.' },
  { id: 'note-100-reais', kind: 'note', valueCents: 10000, label: '100 reais', spokenLabel: 'cédula de 100 reais', imageUrl: commonsImage('100 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 100 reais, da segunda família.' },
  { id: 'note-200-reais', kind: 'note', valueCents: 20000, label: '200 reais', spokenLabel: 'cédula de 200 reais', imageUrl: commonsImage('200 Brazil real Second Obverse.jpg'), description: 'Cédula brasileira de 200 reais, da segunda família.' },
].map((money) => Object.freeze(money)));

export const COINS = Object.freeze(MONEY_DENOMINATIONS.filter(({ kind }) => kind === 'coin'));
export const BANKNOTES = Object.freeze(MONEY_DENOMINATIONS.filter(({ kind }) => kind === 'note'));

const DENOMINATION_BY_ID = new Map(MONEY_DENOMINATIONS.map((money) => [money.id, money]));

const MONEY_DOMAINS = Object.freeze({
  BRL_INTEIROS: 'reais',
  CENTAVOS: 'centavos',
});
const MAX_WHOLE_REAL_ARITHMETIC = 89;
const MAX_SHOPPING_PRODUCT_PRICE = 47;
const MAX_SHOPPING_TOTAL = 89;
const MAX_CURRENCY_COMPOSITION_REAIS = 20;

function questionText(question) {
  const optionText = Array.isArray(question.options)
    ? question.options.map((option) => (typeof option === 'string' ? option : option?.label))
    : [];
  return [
    question.prompt,
    question.speech,
    question.explanation,
    question.hint,
    question.feedback?.correct,
    question.feedback?.retry,
    ...optionText,
  ].filter((value) => typeof value === 'string').join(' ');
}

function hasUnsupportedDecimalMoneyNotation(question, allowCentavoLabels = false) {
  const text = questionText(question);
  const decimalValues = [...text.matchAll(/\b\d+[,.]\d{2}\b/g)];
  const currencyValues = [...text.matchAll(/R\$\s*(\d+)[,.](\d{2})/gi)];
  const currencyLabels = [...text.matchAll(/R\$\s*\d+/gi)];
  return decimalValues.length !== currencyValues.length
    || (!allowCentavoLabels && currencyValues.some(([, reais, centavos]) => Number(centavos) !== 0))
    || currencyLabels.length !== currencyValues.length;
}

function writtenMoneyCents(question) {
  const text = questionText(question);
  return [...new Set([...text.matchAll(/R\$\s*(\d+)[,.](\d{2})/gi)]
    .map(([, reais, centavos]) => Number(reais) * 100 + Number(centavos)))];
}

function writtenAmountsMatch(question, expectedCents) {
  const displayed = writtenMoneyCents(question);
  return displayed.length === 0 || (displayed.length === new Set(expectedCents).size
    && displayed.every((value) => expectedCents.includes(value)));
}

function writtenAmountsBelongTo(question, expectedCents, wholeReaisOnly = false) {
  const displayed = writtenMoneyCents(question);
  return displayed.every((value) => expectedCents.includes(value) && (!wholeReaisOnly || value % 100 === 0));
}

function hasDistinctOptionsWithOneCorrectAnswer(question) {
  return Array.isArray(question.options)
    && question.options.length >= 2
    && new Set(question.options).size === question.options.length
    && question.options.filter((option) => option === question.correctAnswer).length === 1;
}

function validateIdentificationCandidate(question) {
  if (question.pedagogicalCategory !== 'DENOMINATION_RECOGNITION') return false;
  const denomination = DENOMINATION_BY_ID.get(question.data?.denominationId);
  if (!denomination || question.correctAnswer !== denomination.id) return false;
  if (!hasDistinctOptionsWithOneCorrectAnswer(question) || question.options.length !== 4) return false;
  return question.options.every((id) => DENOMINATION_BY_ID.get(id)?.kind === denomination.kind);
}

function validateComparisonCandidate(question) {
  if (question.pedagogicalCategory !== 'DENOMINATION_COMPARISON') return false;
  const { leftId, rightId, category, direction } = question.data ?? {};
  const left = DENOMINATION_BY_ID.get(leftId);
  const right = DENOMINATION_BY_ID.get(rightId);
  if (!left || !right || left.id === right.id || left.valueCents === right.valueCents) return false;
  if (!['coin', 'note', 'mixed'].includes(category) || !['greater', 'less'].includes(direction)) return false;
  if (category === 'coin' && (left.kind !== 'coin' || right.kind !== 'coin')) return false;
  if (category === 'note' && (left.kind !== 'note' || right.kind !== 'note')) return false;
  if (category === 'mixed' && left.kind === right.kind) return false;
  if (!hasDistinctOptionsWithOneCorrectAnswer(question) || question.options.length !== 2) return false;
  if (!question.options.includes(left.id) || !question.options.includes(right.id)) return false;

  const expected = direction === 'greater'
    ? (left.valueCents > right.valueCents ? left.id : right.id)
    : (left.valueCents < right.valueCents ? left.id : right.id);
  return question.correctAnswer === expected;
}

function denominationValueInDomain(id, domain) {
  const denomination = DENOMINATION_BY_ID.get(id);
  if (!denomination) return null;
  if (domain === 'CENTAVOS') {
    return denomination.kind === 'coin' && denomination.valueCents < 100
      ? denomination.valueCents
      : null;
  }
  if (domain === 'BRL_INTEIROS' && denomination.valueCents % 100 === 0) {
    return denomination.valueCents / 100;
  }
  return null;
}

function validateOperationCandidate(question) {
  const {
    operation,
    domain,
    operands,
    resultUnit,
    representations,
  } = question.data ?? {};
  const requiredCategory = domain === 'BRL_INTEIROS' ? 'WHOLE_REAL_ARITHMETIC' : 'CENTAVO_ARITHMETIC';
  if (question.pedagogicalCategory !== requiredCategory) return false;
  const unit = MONEY_DOMAINS[domain];
  if (!unit || !['addition', 'subtraction'].includes(operation)) return false;
  if (!Array.isArray(operands) || operands.length < 2) return false;
  if (operation === 'subtraction' && operands.length !== 2) return false;
  if (resultUnit !== unit) return false;
  if (!operands.every((operand) => (
    operand
    && Number.isInteger(operand.value)
    && operand.value > 0
    && (domain !== 'BRL_INTEIROS' || operand.value <= MAX_WHOLE_REAL_ARITHMETIC)
    && operand.unit === unit
    && (domain !== 'CENTAVOS' || (operand.value < 100 && operand.value % 5 === 0))
  ))) return false;

  if (representations !== undefined) {
    if (!Array.isArray(representations) || representations.length !== operands.length) return false;
    for (let index = 0; index < representations.length; index += 1) {
      const group = representations[index];
      if (!Array.isArray(group) || group.length === 0) return false;
      const representedValue = group.reduce((total, id) => {
        const value = denominationValueInDomain(id, domain);
        return value === null ? Number.NaN : total + value;
      }, 0);
      if (representedValue !== operands[index].value) return false;
    }
  }

  const expected = operation === 'addition'
    ? operands.reduce((total, operand) => total + operand.value, 0)
    : operands[0].value - operands[1].value;
  if (expected < 0 || (domain === 'BRL_INTEIROS' && expected > MAX_WHOLE_REAL_ARITHMETIC)
    || !Number.isInteger(question.correctAnswer) || question.correctAnswer !== expected) return false;
  if (domain === 'CENTAVOS' && expected >= 100) return false;
  return hasDistinctOptionsWithOneCorrectAnswer(question)
    && question.options.every((option) => (
      Number.isInteger(option)
      && option >= 0
      && (domain !== 'BRL_INTEIROS' || option <= MAX_WHOLE_REAL_ARITHMETIC)
      && (domain !== 'CENTAVOS' || (option < 100 && option % 5 === 0))
    ));
}

/**
 * Validates the pedagogical contract before a generated candidate is exposed
 * to the interface. Operation candidates use data.domain, data.operands,
 * data.resultUnit and, when money images are shown, data.representations.
 */
export function validateAv2MoneyQuestionCandidate(question) {
  if (!question || question.revisionId !== AV2_REVISION_ID
    || ![AV2_MONEY_ACTIVITY_ID, AV2_SHOPPING_ACTIVITY_ID].includes(question.activityId)
    || typeof question.type !== 'string'
    || !AV2_PEDAGOGICAL_CATEGORIES.includes(question.pedagogicalCategory)) return false;
  if ((question.pedagogicalCategory === 'SHOPPING_PROBLEM') !== (question.activityId === AV2_SHOPPING_ACTIVITY_ID)) return false;
  const allowCentavoLabels = !['WHOLE_REAL_ARITHMETIC', 'CENTAVO_ARITHMETIC', 'SHOPPING_PROBLEM']
    .includes(question.pedagogicalCategory);
  if (hasUnsupportedDecimalMoneyNotation(question, allowCentavoLabels)) return false;

  if (question.type === 'identification') {
    const value = DENOMINATION_BY_ID.get(question.data?.denominationId)?.valueCents;
    return validateIdentificationCandidate(question) && (value !== undefined) && writtenAmountsMatch(question, [value]);
  }
  if (question.type === 'comparison') {
    const values = [question.data?.leftId, question.data?.rightId].map((id) => DENOMINATION_BY_ID.get(id)?.valueCents);
    return validateComparisonCandidate(question) && values.every(Number.isInteger) && writtenAmountsMatch(question, values);
  }
  if (question.type === 'operation') {
    if (!validateOperationCandidate(question)) return false;
    const unit = question.data.domain === 'BRL_INTEIROS' ? 100 : 1;
    const expected = [...question.data.operands.map(({ value }) => value * unit), question.correctAnswer * unit,
      ...question.options.map((value) => value * unit)];
    return writtenAmountsBelongTo(question, expected, question.data.domain === 'BRL_INTEIROS');
  }
  if (question.type === 'equivalence') {
    if (!validateEquivalenceCandidate(question)) return false;
    const expected = [...question.data.denominationIds.map((id) => DENOMINATION_BY_ID.get(id).valueCents), question.data.amountCents];
    return writtenAmountsBelongTo(question, expected);
  }
  if (question.type === 'composition') {
    if (!validateCompositionCandidate(question)) return false;
    const expected = [...question.data.denominationIds.map((id) => DENOMINATION_BY_ID.get(id).valueCents), question.data.amountCents];
    return writtenAmountsBelongTo(question, expected);
  }
  if (question.type.startsWith('shopping-')) {
    if (!validateShoppingCandidate(question)) return false;
    const data = question.data;
    const values = question.type === 'shopping-available-total'
      ? data.denominationIds.map((id) => DENOMINATION_BY_ID.get(id).valueCents)
      : [...data.products.map(({ priceReais }) => priceReais * 100),
        ...(Number.isInteger(data.availableReais) ? [data.availableReais * 100] : [])];
    const expected = [...values, question.correctAnswer * 100,
      ...question.options.filter(Number.isInteger).map((value) => value * 100)];
    return writtenAmountsBelongTo(question, expected, true);
  }
  return false;
}

function assertAv2MoneyQuestionCandidate(question) {
  if (!validateAv2MoneyQuestionCandidate(question)) {
    throw new TypeError('A questão viola o contrato pedagógico da AV2 Matemática.');
  }
  return question;
}

function randomIndex(length, random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999999) : 0;
  return Math.floor(normalized * length);
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomIndex(index + 1, random);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function takeRandom(items, count, random) {
  return shuffled(items, random).slice(0, count);
}

function getDenomination(value) {
  const denomination = typeof value === 'string' ? DENOMINATION_BY_ID.get(value) : value;
  if (!denomination || !DENOMINATION_BY_ID.has(denomination.id)) {
    throw new TypeError('Denominação de dinheiro desconhecida.');
  }
  return DENOMINATION_BY_ID.get(denomination.id);
}

function createQuestion({ type, pedagogicalCategory, activityId = AV2_MONEY_ACTIVITY_ID, data, correctAnswer, correctAnswers, options, prompt, speech, explanation, hint, questionId }) {
  const question = Object.freeze({
    revisionId: AV2_REVISION_ID,
    activityId,
    pedagogicalCategory,
    questionId,
    type,
    data: Object.freeze(data),
    correctAnswer,
    ...(correctAnswers ? { correctAnswers: Object.freeze([...correctAnswers]) } : {}),
    options: Object.freeze(options),
    prompt,
    speech,
    explanation,
    hint,
    feedback: Object.freeze({
      correct: `Muito bem! ${explanation}`,
      retry: 'Tente novamente! Observe os valores com calma.',
    }),
  });
  return assertAv2MoneyQuestionCandidate(question);
}

export function formatMoneyComparison(left, right, direction) {
  const first = getDenomination(left);
  const second = getDenomination(right);
  const verb = direction === 'greater' ? 'vale mais que' : 'vale menos que';
  return `${capitalize(first.spokenLabel)} ${verb} ${second.spokenLabel}.`;
}

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
}

export function createIdentificationQuestion({ denomination = null, random = Math.random } = {}) {
  const correct = denomination
    ? getDenomination(denomination)
    : MONEY_DENOMINATIONS[randomIndex(MONEY_DENOMINATIONS.length, random)];
  const group = correct.kind === 'coin' ? COINS : BANKNOTES;
  const distractors = takeRandom(group.filter(({ id }) => id !== correct.id), 3, random);
  const options = shuffled([correct, ...distractors], random).map(({ id }) => id);
  const objectLabel = correct.kind === 'coin' ? 'moeda' : 'cédula';
  const explanation = `Esta ${objectLabel} vale ${correct.label}.`;
  return createQuestion({
    type: 'identification',
    pedagogicalCategory: 'DENOMINATION_RECOGNITION',
    questionId: `identify-${correct.id}`,
    data: { denominationId: correct.id },
    correctAnswer: correct.id,
    options,
    prompt: `Quanto vale esta ${objectLabel}?`,
    speech: `Quanto vale esta ${objectLabel}?`,
    explanation,
    hint: 'Observe o formato e leia com calma o valor que aparece no dinheiro.',
  });
}

function pairPool(category) {
  const firstGroup = category === 'note' ? BANKNOTES : COINS;
  const secondGroup = category === 'mixed' ? BANKNOTES : firstGroup;
  const pairs = [];
  for (const first of firstGroup) {
    for (const second of secondGroup) {
      if (first.id === second.id) continue;
      if (category !== 'mixed' && first.id > second.id) continue;
      pairs.push([first, second]);
    }
  }
  return pairs;
}

export function createComparisonQuestion({ category = null, direction = null, random = Math.random, excludeQuestionIds = [] } = {}) {
  const selectedCategory = category ?? ['coin', 'note', 'mixed'][randomIndex(3, random)];
  if (!['coin', 'note', 'mixed'].includes(selectedCategory)) throw new TypeError('Tipo de comparação desconhecido.');
  const selectedDirection = direction ?? (randomIndex(2, random) === 0 ? 'greater' : 'less');
  if (!['greater', 'less'].includes(selectedDirection)) throw new TypeError('Direção de comparação desconhecida.');
  const pairs = pairPool(selectedCategory);
  const firstPairIndex = randomIndex(pairs.length, random);
  let pair = pairs[firstPairIndex];
  for (let offset = 0; offset < pairs.length; offset += 1) {
    const candidate = pairs[(firstPairIndex + offset) % pairs.length];
    const candidateId = `compare-${selectedCategory}-${candidate.map(({ id }) => id).sort().join('-')}-${selectedDirection}`;
    if (!excludeQuestionIds.includes(candidateId)) {
      pair = candidate;
      break;
    }
  }
  const options = shuffled(pair, random).map(({ id }) => id);
  const [left, right] = pair;
  const correctMoney = selectedDirection === 'greater'
    ? (left.valueCents > right.valueCents ? left : right)
    : (left.valueCents < right.valueCents ? left : right);
  const otherMoney = correctMoney.id === left.id ? right : left;
  const adjective = selectedDirection === 'greater' ? 'maior' : 'menor';
  const prompt = selectedCategory === 'coin'
    ? `Qual moeda ${selectedDirection === 'greater' ? 'vale mais' : 'vale menos'}?`
    : selectedCategory === 'note'
      ? `Qual cédula ${selectedDirection === 'greater' ? 'vale mais' : 'vale menos'}?`
      : `Qual dinheiro tem o valor ${adjective}?`;
  const explanation = formatMoneyComparison(correctMoney, otherMoney, selectedDirection);
  return createQuestion({
    type: 'comparison',
    pedagogicalCategory: 'DENOMINATION_COMPARISON',
    questionId: `compare-${selectedCategory}-${[left.id, right.id].sort().join('-')}-${selectedDirection}`,
    data: { leftId: left.id, rightId: right.id, category: selectedCategory, direction: selectedDirection },
    correctAnswer: correctMoney.id,
    options,
    prompt,
    speech: `${prompt} ${left.spokenLabel} ou ${right.spokenLabel}?`,
    explanation,
    hint: 'Olhe os valores desenhados e compare qual é maior ou menor.',
  });
}

function validateEquivalenceCandidate(question) {
  if (question.pedagogicalCategory !== 'CURRENCY_EQUIVALENCE') return false;
  const { denominationIds, targetDenominationId, amountCents } = question.data ?? {};
  const target = DENOMINATION_BY_ID.get(targetDenominationId);
  if (!Array.isArray(denominationIds) || denominationIds.length < 2
    || !Number.isInteger(amountCents) || amountCents <= 0
    || amountCents > MAX_CURRENCY_COMPOSITION_REAIS * 100) return false;
  const group = denominationIds.map((id) => DENOMINATION_BY_ID.get(id));
  const represented = group.reduce((sum, denomination) => sum + (denomination?.valueCents ?? Number.NaN), 0);
  if (!Number.isFinite(represented) || represented !== amountCents
    || group.some((denomination) => !denomination || denomination.kind !== group[0]?.kind)) return false;
  const groupKind = group[0]?.kind;
  if (!['coin', 'note'].includes(groupKind)) return false;
  const centsCoins = denominationIds.filter((id) => DENOMINATION_BY_ID.get(id).valueCents < 100);
  const centsSignature = centsCoins.map((id) => DENOMINATION_BY_ID.get(id).valueCents).sort((a, b) => a - b).join(',');
  const documentedCentavoTotals = new Map([
    ['5,5', 10],
    ['5,10,10', 25],
    ['10,10,10,10,10', 50],
  ]);
  const centsTotal = centsCoins.reduce((sum, id) => sum + DENOMINATION_BY_ID.get(id).valueCents, 0);
  if (targetDenominationId) {
    if (centsCoins.length && centsTotal !== 100) return false;
    if (!target || target.kind !== 'note' || target.valueCents !== amountCents
      || !hasDistinctOptionsWithOneCorrectAnswer(question)
      || !question.options.every((id) => DENOMINATION_BY_ID.get(id)?.kind === 'note')) return false;
    const correctOptions = question.options.filter((id) => DENOMINATION_BY_ID.get(id)?.valueCents === amountCents);
    return correctOptions.length === 1 && correctOptions[0] === targetDenominationId && question.correctAnswer === targetDenominationId;
  }
  const resultUnit = amountCents % 100 === 0 ? 'reais' : 'centavos';
  const expected = resultUnit === 'reais' ? amountCents / 100 : amountCents;
  if (resultUnit === 'centavos'
    && (centsCoins.length !== denominationIds.length || documentedCentavoTotals.get(centsSignature) !== amountCents)) return false;
  if (resultUnit === 'reais' && centsCoins.length && centsTotal !== 100) return false;
  return question.data.resultUnit === resultUnit && question.correctAnswer === expected
    && hasDistinctOptionsWithOneCorrectAnswer(question)
    && question.options.every((option) => Number.isInteger(option) && option > 0
      && (resultUnit !== 'centavos' || (option < 100 && option % 5 === 0)));
}

function validateCompositionCandidate(question) {
  if (question.pedagogicalCategory !== 'CURRENCY_COMPOSITION') return false;
  const { denominationIds, amountCents, itemCount } = question.data ?? {};
  if (!Array.isArray(denominationIds) || denominationIds.length === 0
    || !Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_CURRENCY_COMPOSITION_REAIS * 100 || amountCents % 100 !== 0
    || (itemCount !== undefined && itemCount !== denominationIds.length)) return false;
  const values = denominationIds.map((id) => DENOMINATION_BY_ID.get(id)?.valueCents ?? Number.NaN);
  if (!values.every(Number.isFinite) || values.reduce((sum, value) => sum + value, 0) !== amountCents) return false;
  const centsCoins = denominationIds.filter((id) => {
    const denomination = DENOMINATION_BY_ID.get(id);
    return denomination?.kind === 'coin' && denomination.valueCents < 100;
  });
  if (centsCoins.length) {
    const centsTotal = centsCoins.reduce((sum, id) => sum + DENOMINATION_BY_ID.get(id).valueCents, 0);
    const allowedCentsGroup = centsTotal === 100;
    const remainingDenominationsAreRealCoins = denominationIds
      .filter((id) => !centsCoins.includes(id))
      .every((id) => DENOMINATION_BY_ID.get(id)?.kind === 'coin' && DENOMINATION_BY_ID.get(id).valueCents % 100 === 0);
    if (!allowedCentsGroup || !remainingDenominationsAreRealCoins) return false;
  }
  const expected = amountCents / 100;
  return question.correctAnswer === expected && hasDistinctOptionsWithOneCorrectAnswer(question)
    && question.options.every((option) => Number.isInteger(option) && option >= 0);
}

function validateShoppingCandidate(question) {
  if (question.pedagogicalCategory !== 'SHOPPING_PROBLEM' || question.activityId !== AV2_SHOPPING_ACTIVITY_ID) return false;
  if (!Array.isArray(question.options)) return false;
  const data = question.data ?? {};
  if (question.type === 'shopping-available-total') {
    const ids = data.denominationIds;
    if (!Array.isArray(ids) || ids.length < 2) return false;
    const totalCents = ids.reduce((sum, id) => sum + (DENOMINATION_BY_ID.get(id)?.valueCents ?? Number.NaN), 0);
    return Number.isFinite(totalCents) && totalCents <= MAX_SHOPPING_TOTAL * 100 && totalCents % 100 === 0
      && question.correctAnswer === totalCents / 100
      && hasDistinctOptionsWithOneCorrectAnswer(question)
      && question.options.every((option) => Number.isInteger(option) && option >= 0 && option <= MAX_SHOPPING_TOTAL);
  }
  const products = data.products;
  if (!Array.isArray(products) || products.length < 2
    || products.some((product) => !product || typeof product.id !== 'string' || typeof product.label !== 'string'
      || product.label.length === 0 || !Number.isInteger(product.priceReais) || product.priceReais <= 0 || product.priceReais > MAX_SHOPPING_PRODUCT_PRICE)
    || new Set(products.map(({ id }) => id)).size !== products.length) return false;
  if (question.type === 'shopping-affordability') {
    if (!Number.isInteger(data.availableReais) || data.availableReais <= 0 || data.availableReais > MAX_SHOPPING_TOTAL
      || !Array.isArray(question.correctAnswers)) return false;
    const expected = products.filter(({ priceReais }) => priceReais <= data.availableReais).map(({ id }) => id).sort();
    return expected.length > 0 && new Set(question.options).size === question.options.length
      && question.options.length === products.length
      && question.options.every((id) => products.some((product) => product.id === id))
      && [...question.correctAnswers].sort().join('|') === expected.join('|');
  }
  if (question.type === 'shopping-change') {
    const { availableReais, purchaseProductId } = data;
    const purchase = products.find(({ id }) => id === purchaseProductId);
    const change = availableReais - (purchase?.priceReais ?? Number.NaN);
    return Number.isInteger(availableReais) && availableReais > 0 && availableReais <= MAX_SHOPPING_TOTAL && change >= 0
      && question.correctAnswer === change && hasDistinctOptionsWithOneCorrectAnswer(question)
      && question.options.every((value) => Number.isInteger(value) && value >= 0 && value <= MAX_SHOPPING_TOTAL);
  }
  if (question.type === 'shopping-product-sum' || question.type === 'shopping-selected-total') {
    const selectedIds = data.selectedProductIds;
    if (!Array.isArray(selectedIds) || selectedIds.length < 2 || new Set(selectedIds).size !== selectedIds.length) return false;
    const selectedProducts = selectedIds.map((id) => products.find((product) => product.id === id));
    if (selectedProducts.some((product) => !product)) return false;
    const total = selectedProducts.reduce((sum, product) => sum + product.priceReais, 0);
    return total <= MAX_SHOPPING_TOTAL && question.correctAnswer === total && hasDistinctOptionsWithOneCorrectAnswer(question)
      && question.options.every((value) => Number.isInteger(value) && value >= 0 && value <= MAX_SHOPPING_TOTAL);
  }
  return false;
}

export function createCurrencyEquivalenceQuestion({ denominationIds, targetDenominationId = null, random = Math.random } = {}) {
  const ids = [...denominationIds];
  const moneyKind = getDenomination(ids[0]).kind;
  const groupName = moneyKind === 'coin' ? 'moedas' : 'cédulas';
  const totalCents = ids.reduce((sum, id) => sum + getDenomination(id).valueCents, 0);
  const target = targetDenominationId ? getDenomination(targetDenominationId) : null;
  const resultUnit = totalCents % 100 === 0 ? 'reais' : 'centavos';
  const correct = resultUnit === 'reais' ? totalCents / 100 : totalCents;
  const options = target
    ? shuffled([target, ...takeRandom(BANKNOTES.filter(({ valueCents }) => valueCents !== target.valueCents), 3, random)], random).map(({ id }) => id)
    : shuffled([...new Set(resultUnit === 'reais'
      ? [correct, correct + 1, correct + 2, correct + 3]
      : [correct, correct + 5, Math.max(5, correct - 5), correct + 10])], random);
  const amount = target?.label ?? `${correct} ${resultUnit === 'centavos' ? 'centavos' : (correct === 1 ? 'real' : 'reais')}`;
  const prompt = target ? `Qual cédula tem o mesmo valor que estas ${groupName}?`
    : `Quanto valem estas ${groupName} em ${resultUnit}?`;
  const question = {
    type: 'equivalence',
    pedagogicalCategory: 'CURRENCY_EQUIVALENCE',
    data: { denominationIds: ids, ...(target ? { targetDenominationId: target.id } : {}), amountCents: totalCents, ...(!target ? { resultUnit } : {}) },
    correctAnswer: target?.id ?? correct,
    options,
    prompt,
    speech: prompt,
    explanation: `Estas ${groupName} formam ${amount}.`,
    hint: target ? `Some o valor das ${groupName} e procure a cédula com o mesmo valor.`
      : resultUnit === 'centavos' ? 'Junte os valores das moedas em centavos.' : 'Junte os centavos para descobrir quantos reais eles formam.',
    questionId: `equivalent-${ids.join('-')}-${target?.id ?? resultUnit}`,
  };
  return assertAv2MoneyQuestionCandidate(createQuestion(question));
}

export function createCurrencyCompositionQuestion({ denominationIds, options = null, random = Math.random } = {}) {
  const ids = [...denominationIds];
  const amountCents = ids.reduce((sum, id) => sum + getDenomination(id).valueCents, 0);
  const correct = amountCents / 100;
  const answers = options ?? [...new Set([correct, correct + 1, Math.max(1, correct - 1), correct + 2])];
  const question = {
    type: 'composition',
    pedagogicalCategory: 'CURRENCY_COMPOSITION',
    data: { denominationIds: ids, amountCents, itemCount: ids.length },
    correctAnswer: correct,
    options: shuffled(answers, random),
    prompt: 'Quanto dinheiro há ao todo?',
    speech: 'Quanto dinheiro há ao todo?',
    explanation: `O grupo forma ${correct} ${correct === 1 ? 'real' : 'reais'}.`,
    hint: 'Junte os valores das moedas.',
    questionId: `composition-${ids.join('-')}`,
  };
  return assertAv2MoneyQuestionCandidate(createQuestion(question));
}

function createShoppingQuestion({ type, questionId, data, correctAnswer, correctAnswers, options, prompt, explanation, hint }) {
  const question = createQuestion({
    type,
    activityId: AV2_SHOPPING_ACTIVITY_ID,
    pedagogicalCategory: 'SHOPPING_PROBLEM',
    questionId,
    data,
    correctAnswer,
    correctAnswers,
    options,
    prompt,
    speech: prompt,
    explanation,
    hint,
  });
  return question;
}

function createAvailableTotal({ denominationIds, id, random }) {
  const totalCents = denominationIds.reduce((sum, denominationId) => sum + getDenomination(denominationId).valueCents, 0);
  const total = totalCents / 100;
  return createShoppingQuestion({
    type: 'shopping-available-total', questionId: `shopping-total-${id}`,
    data: { denominationIds }, correctAnswer: total,
    options: shuffled([...new Set([total - 2, total - 1, total, total + 1])].filter((value) => value >= 0), random),
    prompt: 'Quanto dinheiro há ao todo?',
    explanation: `As cédulas somam ${total} ${total === 1 ? 'real' : 'reais'}.`,
    hint: 'Some os valores de todas as cédulas.',
  });
}

function createAffordability({ availableReais, products, id, random }) {
  const correctAnswers = products.filter(({ priceReais }) => priceReais <= availableReais).map(({ id: productId }) => productId);
  return createShoppingQuestion({
    type: 'shopping-affordability', questionId: `shopping-afford-${id}`,
    data: { availableReais, products }, correctAnswers,
    options: shuffled(products.map(({ id: productId }) => productId), random),
    prompt: `Você tem ${availableReais} reais. Quais produtos pode comprar, um de cada vez?`,
    explanation: `Com ${availableReais} reais, você pode escolher os produtos que custam até esse valor.`,
    hint: 'Compare o preço de cada produto com o dinheiro que você tem.',
  });
}

function createChange({ availableReais, products, purchaseProductId, id, random }) {
  const product = products.find(({ id: productId }) => productId === purchaseProductId);
  const change = availableReais - product.priceReais;
  const article = product.article === 'a' ? 'a' : 'o';
  const productName = product.label.toLocaleLowerCase('pt-BR');
  return createShoppingQuestion({
    type: 'shopping-change', questionId: `shopping-change-${id}`,
    data: { availableReais, products, purchaseProductId }, correctAnswer: change,
    options: shuffled([...new Set([Math.max(0, change - 2), Math.max(0, change - 1), change, change + 1])], random),
    prompt: `Você paga com ${availableReais} reais ao comprar ${article} ${productName}. Quanto recebe de troco?`,
    explanation: `Para calcular o troco, subtraímos o preço do produto do valor pago: ${availableReais} menos ${product.priceReais} são ${change} reais.`,
    hint: 'Subtraia o preço do produto do dinheiro que você tem.',
  });
}

function createProductTotal({ type, products, selectedProductIds, id, random }) {
  const selected = selectedProductIds.map((productId) => products.find(({ id }) => id === productId));
  const total = selected.reduce((sum, product) => sum + product.priceReais, 0);
  const names = selected.map(({ label }) => label.toLocaleLowerCase('pt-BR'));
  const productList = names.length === 2
    ? names.join(' e ')
    : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  const prompt = `Quanto custam juntos ${productList}?`;
  return createShoppingQuestion({
    type, questionId: `shopping-products-${id}`,
    data: { products, selectedProductIds }, correctAnswer: total,
    options: shuffled([...new Set([total - 2, total - 1, total, total + 1])].filter((value) => value >= 0), random),
    prompt,
    explanation: `Some os preços dos produtos escolhidos: ${selected.map(({ priceReais }) => priceReais).join(' + ')} = ${total} reais.`,
    hint: 'Identifique os produtos citados e some os preços deles.',
  });
}

/** Ten child-facing Block 02 questions, including the five official formats and five varied forms. */
export function createAv2ShoppingRound(random = Math.random) {
  const exactExamples = [
    createAvailableTotal({ denominationIds: ['note-5-reais', 'note-5-reais', 'note-10-reais', 'note-2-reais', 'note-2-reais'], id: '24-oficial', random }),
    createAffordability({ availableReais: 24, products: [
      { id: 'urso-25', label: 'Urso', priceReais: 25 }, { id: 'livro-20', label: 'Livro', priceReais: 20 },
      { id: 'bola-25', label: 'Bola', priceReais: 25 }, { id: 'caderno-3', label: 'Caderno', priceReais: 3 },
    ], id: '24-oficial', random }),
    createChange({ availableReais: 24, products: [
      { id: 'brinquedo-20', label: 'Brinquedo', article: 'o', priceReais: 20 }, { id: 'livro-25', label: 'Livro', priceReais: 25 },
    ], purchaseProductId: 'brinquedo-20', id: '24-20-oficial', random }),
    createProductTotal({ type: 'shopping-product-sum', products: [
      { id: 'borracha-3', label: 'Borracha', priceReais: 3 }, { id: 'lapis-2', label: 'Lápis', priceReais: 2 },
      { id: 'tesoura-4', label: 'Tesoura', priceReais: 4 },
    ], selectedProductIds: ['borracha-3', 'lapis-2', 'tesoura-4'], id: '3-2-4-oficial', random }),
    createProductTotal({ type: 'shopping-selected-total', products: [
      { id: 'caderno-10', label: 'Caderno', priceReais: 10 }, { id: 'cola-7', label: 'Cola', priceReais: 7 },
      { id: 'tesoura-4', label: 'Tesoura', priceReais: 4 },
    ], selectedProductIds: ['caderno-10', 'cola-7'], id: '10-7-oficial', random }),
  ];
  const totalGroups = [
    ['note-10-reais', 'note-5-reais', 'note-2-reais', 'note-2-reais'],
    ['note-10-reais', 'note-5-reais', 'note-5-reais'],
    ['note-5-reais', 'note-5-reais', 'note-5-reais', 'note-2-reais', 'note-2-reais'],
    ['note-10-reais', 'note-10-reais', 'note-2-reais'],
    ['note-20-reais', 'note-2-reais', 'note-2-reais'],
    ['note-10-reais', 'note-5-reais', 'note-2-reais'],
  ];
  const availableGroupIndex = randomIndex(totalGroups.length, random);
  const budget = [15, 18, 20, 21, 22][randomIndex(5, random)];
  const changeExamples = [[18, 13], [16, 11], [20, 17], [22, 14]];
  const [cashAvailable, purchasePrice] = changeExamples[randomIndex(changeExamples.length, random)];
  const threeProductPrices = [[6, 3, 5], [4, 4, 3], [2, 7, 5], [5, 6, 3]];
  const selectedThreePrices = threeProductPrices[randomIndex(threeProductPrices.length, random)];
  const pairPrices = [[8, 4], [6, 5], [12, 3], [9, 7], [11, 4]];
  const selectedPairPrices = pairPrices[randomIndex(pairPrices.length, random)];
  const variedExamples = [
    createAvailableTotal({ denominationIds: totalGroups[availableGroupIndex], id: `total-var-${availableGroupIndex}`, random }),
    createAffordability({ availableReais: budget, products: [
      { id: `jogo-${budget + 1}`, label: 'Jogo', priceReais: budget + 1 },
      { id: `livro-${budget - 2}`, label: 'Livro', priceReais: budget - 2 },
      { id: `bola-${budget + 4}`, label: 'Bola', priceReais: budget + 4 },
      { id: `giz-${Math.min(5, budget - 2)}`, label: 'Giz de cera', priceReais: Math.min(5, budget - 2) },
    ], id: `budget-${budget}`, random }),
    createChange({ availableReais: cashAvailable, products: [
      { id: `boneca-${purchasePrice}`, label: 'Boneca', article: 'a', priceReais: purchasePrice },
      { id: `carrinho-${cashAvailable + 2}`, label: 'Carrinho', priceReais: cashAvailable + 2 },
    ], purchaseProductId: `boneca-${purchasePrice}`, id: `change-${cashAvailable}-${purchasePrice}`, random }),
    createProductTotal({ type: 'shopping-product-sum', products: [
      { id: `livro-${selectedThreePrices[0]}`, label: 'Livro', priceReais: selectedThreePrices[0] },
      { id: `lapis-${selectedThreePrices[1]}`, label: 'Lápis', priceReais: selectedThreePrices[1] },
      { id: `cola-${selectedThreePrices[2]}`, label: 'Cola', priceReais: selectedThreePrices[2] },
    ], selectedProductIds: selectedThreePrices.map((price, index) => `${['livro', 'lapis', 'cola'][index]}-${price}`), id: `sum-${selectedThreePrices.join('-')}`, random }),
    createProductTotal({ type: 'shopping-selected-total', products: [
      { id: `caderno-${selectedPairPrices[0]}`, label: 'Caderno', priceReais: selectedPairPrices[0] },
      { id: `cola-${selectedPairPrices[1]}`, label: 'Cola', priceReais: selectedPairPrices[1] },
      { id: `regua-${selectedPairPrices[0] > 4 ? 4 : 2}`, label: 'Régua', priceReais: selectedPairPrices[0] > 4 ? 4 : 2 },
    ], selectedProductIds: [`caderno-${selectedPairPrices[0]}`, `cola-${selectedPairPrices[1]}`], id: `pair-${selectedPairPrices.join('-')}`, random }),
  ];
  return Object.freeze(shuffled([...exactExamples, ...variedExamples], random));
}

export function createAv2Round(random = Math.random) {
  const selectedCoins = takeRandom(COINS, 3, random);
  const selectedNotes = takeRandom(BANKNOTES, 3, random);
  const identificationQuestions = [...selectedCoins, ...selectedNotes]
    .map((denomination) => createIdentificationQuestion({ denomination, random }));

  const categories = shuffled(['coin', 'note', 'mixed'], random);
  const directions = shuffled(['greater', 'less', randomIndex(2, random) ? 'greater' : 'less'], random);
  const usedQuestionIds = new Set();
  const comparisonQuestions = categories.map((category, index) => {
    const question = createComparisonQuestion({
      category,
      direction: directions[index],
      random,
      excludeQuestionIds: [...usedQuestionIds],
    });
    usedQuestionIds.add(question.questionId);
    return question;
  });

  const equivalenceGroups = [
    { denominationIds: ['coin-50-centavos', 'coin-50-centavos'] },
    { denominationIds: ['coin-25-centavos', 'coin-50-centavos', 'coin-25-centavos'] },
    { denominationIds: Array(5).fill('coin-1-real'), targetDenominationId: 'note-5-reais' },
    { denominationIds: ['coin-1-real', 'coin-1-real'], targetDenominationId: 'note-2-reais' },
    { denominationIds: ['coin-1-real', 'coin-50-centavos', 'coin-25-centavos', 'coin-25-centavos'], targetDenominationId: 'note-2-reais' },
  ];
  const equivalenceQuestions = [createCurrencyEquivalenceQuestion({
    ...equivalenceGroups[randomIndex(equivalenceGroups.length, random)], random,
  })];

  return Object.freeze(shuffled([...identificationQuestions, ...comparisonQuestions, ...equivalenceQuestions], random));
}

export function validateAv2Answer(question, answer) {
  if (!question || question.revisionId !== AV2_REVISION_ID
    || ![AV2_MONEY_ACTIVITY_ID, AV2_SHOPPING_ACTIVITY_ID].includes(question.activityId)) return false;
  if (!validateAv2MoneyQuestionCandidate(question)) return false;
  if (question.type === 'shopping-affordability') {
    if (!Array.isArray(answer)) return false;
    return [...answer].sort().join('|') === [...question.correctAnswers].sort().join('|');
  }
  if (!question.options.includes(answer)) return false;
  if (question.type === 'identification') {
    const denomination = DENOMINATION_BY_ID.get(question.data.denominationId);
    if (!denomination || denomination.valueCents < 0 || question.correctAnswer !== denomination.id) return false;
    return answer === question.correctAnswer && question.options.filter((id) => id === question.correctAnswer).length === 1;
  }
  if (question.type === 'comparison') {
    const left = DENOMINATION_BY_ID.get(question.data.leftId);
    const right = DENOMINATION_BY_ID.get(question.data.rightId);
    if (!left || !right || left.valueCents === right.valueCents) return false;
    const expected = question.data.direction === 'greater'
      ? (left.valueCents > right.valueCents ? left.id : right.id)
      : question.data.direction === 'less'
        ? (left.valueCents < right.valueCents ? left.id : right.id)
        : null;
    return expected !== null && answer === question.correctAnswer && answer === expected;
  }
  if (question.type === 'equivalence') return answer === question.correctAnswer;
  if (question.type === 'composition') return answer === question.correctAnswer;
  if (question.type === 'shopping-available-total'
    || question.type === 'shopping-change'
    || question.type === 'shopping-product-sum'
    || question.type === 'shopping-selected-total') return answer === question.correctAnswer;
  return false;
}
