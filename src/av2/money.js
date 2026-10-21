export const AV2_REVISION_ID = 'av2-matematica';
export const AV2_MONEY_ACTIVITY_ID = 'dinheiro-reconhecimento-e-comparacao';

export const MONEY_DENOMINATIONS = Object.freeze([
  { id: 'coin-5-centavos', kind: 'coin', valueCents: 5, label: '5 centavos', spokenLabel: 'moeda de 5 centavos', number: '5', unit: 'centavos', visualClass: 'coin-5-centavos', description: 'Moeda brasileira de 5 centavos.' },
  { id: 'coin-10-centavos', kind: 'coin', valueCents: 10, label: '10 centavos', spokenLabel: 'moeda de 10 centavos', number: '10', unit: 'centavos', visualClass: 'coin-10-centavos', description: 'Moeda brasileira de 10 centavos.' },
  { id: 'coin-25-centavos', kind: 'coin', valueCents: 25, label: '25 centavos', spokenLabel: 'moeda de 25 centavos', number: '25', unit: 'centavos', visualClass: 'coin-25-centavos', description: 'Moeda brasileira de 25 centavos.' },
  { id: 'coin-50-centavos', kind: 'coin', valueCents: 50, label: '50 centavos', spokenLabel: 'moeda de 50 centavos', number: '50', unit: 'centavos', visualClass: 'coin-50-centavos', description: 'Moeda brasileira de 50 centavos.' },
  { id: 'coin-1-real', kind: 'coin', valueCents: 100, label: '1 real', spokenLabel: 'moeda de 1 real', number: '1', unit: 'real', visualClass: 'coin-1-real', description: 'Moeda brasileira de 1 real.' },
  { id: 'note-2-reais', kind: 'note', valueCents: 200, label: '2 reais', spokenLabel: 'cédula de 2 reais', number: '2', unit: 'reais', visualClass: 'note-2-reais', description: 'Cédula brasileira de 2 reais.' },
  { id: 'note-5-reais', kind: 'note', valueCents: 500, label: '5 reais', spokenLabel: 'cédula de 5 reais', number: '5', unit: 'reais', visualClass: 'note-5-reais', description: 'Cédula brasileira de 5 reais.' },
  { id: 'note-10-reais', kind: 'note', valueCents: 1000, label: '10 reais', spokenLabel: 'cédula de 10 reais', number: '10', unit: 'reais', visualClass: 'note-10-reais', description: 'Cédula brasileira de 10 reais.' },
  { id: 'note-20-reais', kind: 'note', valueCents: 2000, label: '20 reais', spokenLabel: 'cédula de 20 reais', number: '20', unit: 'reais', visualClass: 'note-20-reais', description: 'Cédula brasileira de 20 reais.' },
  { id: 'note-50-reais', kind: 'note', valueCents: 5000, label: '50 reais', spokenLabel: 'cédula de 50 reais', number: '50', unit: 'reais', visualClass: 'note-50-reais', description: 'Cédula brasileira de 50 reais.' },
  { id: 'note-100-reais', kind: 'note', valueCents: 10000, label: '100 reais', spokenLabel: 'cédula de 100 reais', number: '100', unit: 'reais', visualClass: 'note-100-reais', description: 'Cédula brasileira de 100 reais.' },
  { id: 'note-200-reais', kind: 'note', valueCents: 20000, label: '200 reais', spokenLabel: 'cédula de 200 reais', number: '200', unit: 'reais', visualClass: 'note-200-reais', description: 'Cédula brasileira de 200 reais.' },
].map((money) => Object.freeze(money)));

export const COINS = Object.freeze(MONEY_DENOMINATIONS.filter(({ kind }) => kind === 'coin'));
export const BANKNOTES = Object.freeze(MONEY_DENOMINATIONS.filter(({ kind }) => kind === 'note'));

const DENOMINATION_BY_ID = new Map(MONEY_DENOMINATIONS.map((money) => [money.id, money]));

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

function createQuestion({ type, data, correctAnswer, options, prompt, speech, explanation, hint, questionId }) {
  return Object.freeze({
    revisionId: AV2_REVISION_ID,
    activityId: AV2_MONEY_ACTIVITY_ID,
    questionId,
    type,
    data: Object.freeze(data),
    correctAnswer,
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

export function createAv2Round(random = Math.random) {
  const selectedCoins = takeRandom(COINS, 3, random);
  const selectedNotes = takeRandom(BANKNOTES, 3, random);
  const identificationQuestions = [...selectedCoins, ...selectedNotes]
    .map((denomination) => createIdentificationQuestion({ denomination, random }));

  const categories = shuffled(['coin', 'note', 'mixed', 'mixed'], random);
  const directions = shuffled(['greater', 'less', randomIndex(2, random) ? 'greater' : 'less', randomIndex(2, random) ? 'greater' : 'less'], random);
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

  return Object.freeze(shuffled([...identificationQuestions, ...comparisonQuestions], random));
}

export function validateAv2Answer(question, answer) {
  if (!question || question.revisionId !== AV2_REVISION_ID || question.activityId !== AV2_MONEY_ACTIVITY_ID) return false;
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
  return false;
}
