import {
  AV2_MONEY_ACTIVITY_ID,
  AV2_SHOPPING_ACTIVITY_ID,
  createAv2Round,
  createAv2ShoppingRound,
  createCurrencyEquivalenceQuestion,
  MONEY_DENOMINATIONS,
  validateAv2Answer,
  validateAv2MoneyQuestionCandidate,
} from './money.js';
import {
  AV2_MONEY_COMPOSITION_ACTIVITY_ID,
  createAv2MoneyCompositionRound,
  getAv2MoneyCompositionChallenge,
  validateAv2MoneyCompositionChallenge,
  validateAv2MoneyCompositionSelection,
} from './money-composition.js';
import {
  AV2_ADDITION_ACTIVITY_ID,
  createAv2AdditionRound,
  validateAv2AdditionAnswer,
  validateAv2AdditionQuestionCandidate,
  createAv2AdditionQuestionForOperands,
} from './addition.js';
import {
  AV2_SUBTRACTION_ACTIVITY_ID,
  createAv2SubtractionRound,
  validateAv2SubtractionAnswer,
  validateAv2SubtractionQuestionCandidate,
  createSubtractionQuestion,
} from './subtraction.js';
import { numberToPortuguese } from '../game.js';
import { createNumberTableQuestion, NUMBER_WORD_VALUES, numberToWordsPtBr, validateNumberTable } from './sequences.js';
import { getAv2ProductIllustrationId } from './product-illustrations.js';

export const AV2_SIMULADO_ACTIVITY_ID = 'av2-simulado-block-07';
export const AV2_SIMULADO_PROGRESS_STORAGE_KEY = 'av2-matematica.block-07.simulado.progress.v1';
export const AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT = 1;
export const AV2_SIMULADO_QUESTION_COUNTS = Object.freeze([1, 2, 3, 4, 5]);
export const AV2_SIMULADO_FULL_COVERAGE_PRESET_ID = 'official-revision';
export const AV2_SIMULADO_SUBJECTS = Object.freeze([
  Object.freeze({ id: 'money', label: 'Sistema monetário', description: 'Equivalências, compras, moedas e preços.' }),
  Object.freeze({ id: 'addition', label: 'Adição', description: 'Contas e problemas de adição.' }),
  Object.freeze({ id: 'subtraction', label: 'Subtração', description: 'Contas e problemas de subtração.' }),
  Object.freeze({ id: 'sequences', label: 'Sequências e tabelas', description: 'Complete sequências e tabelas numéricas.' }),
  Object.freeze({ id: 'words', label: 'Números por extenso', description: 'Leia, escreva e relacione números.' }),
]);

const SUBJECT_IDS = new Set(AV2_SIMULADO_SUBJECTS.map(({ id }) => id));
const WHOLE_NUMBER_LIMIT = 250;

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function randomIndex(length, random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(value, 0.999999999999)) : 0;
  return Math.floor(normalized * length);
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomIndex(index + 1, random);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function attachSubject(question, subjectId, questionId = question.questionId) {
  return freezeDeep({
    ...question,
    simulado: {
      questionId: String(questionId),
      subjectIds: [subjectId],
      subjectId,
      sourceType: question.type,
      contextual: question.type === 'context' || question.type.startsWith('shopping-')
        || question.type.startsWith('simulado-shopping-') || question.type === 'simulado-product-board',
    },
  });
}

function createSequenceQuestion(random, requestedStart = null, requestedMissingIndex = null) {
  const start = requestedStart ?? 200 + randomIndex(47, random);
  const missingIndex = requestedMissingIndex ?? 1 + randomIndex(2, random);
  const sequence = Array.from({ length: 4 }, (_, index) => index === missingIndex ? null : start + index);
  const answer = start + missingIndex;
  const options = shuffled([...new Set([answer, answer + 1, answer - 1, answer + 2])], random);
  const shownSequence = sequence.map((value) => value ?? '___').join(' · ');
  const question = {
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'INCREASING_SEQUENCE_BY_ONE',
    questionId: `sequence-${start}-${missingIndex}`,
    type: 'simulado-sequence',
    data: { sequence, start, missingIndex, increment: 1 },
    correctAnswer: answer,
    options,
    prompt: `Complete a sequência que aumenta de um em um: ${shownSequence}.`,
    speech: `Complete a sequência que aumenta de um em um. ${sequence.map((value) => value ?? 'qual número falta?').join(', ')}.`,
    explanation: `Cada número aumenta um. A sequência fica ${Array.from({ length: 4 }, (_, index) => start + index).join(', ')}.`,
    hint: 'Conte um número de cada vez, da esquerda para a direita.',
    feedback: { correct: 'Muito bem! Você descobriu o próximo número da sequência.', retry: 'Tente mais uma vez. Conte de um em um.' },
  };
  return attachSubject(question, 'sequences');
}

function createWordQuestion(random, requestedValue = null, requestedMode = null) {
  const mode = requestedMode ?? (randomIndex(2, random) === 0 ? 'number-to-word' : 'word-to-number');
  const value = requestedValue ?? (mode === 'number-to-word' && randomIndex(8, random) === 0
    ? (randomIndex(2, random) === 0 ? 300 : 400)
    : 200 + randomIndex(51, random));
  const distractorValues = [300, 400].includes(value)
    ? [300, 400, 200, 250].filter((candidate) => candidate !== value)
    : [...new Set([value - 1, value + 1, value - 10, value + 10, value - 2, value + 2])]
      .filter((candidate) => candidate >= 200 && candidate <= 250 && candidate !== value);
  const selected = shuffled([value, ...distractorValues].slice(0, 3), random);
  const options = selected.map((option) => ({
    value: option,
    label: mode === 'number-to-word' ? numberToPortuguese(option) : String(option),
  }));
  const word = numberToPortuguese(value);
  const question = {
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_WORDS',
    questionId: `word-${mode}-${value}`,
    type: 'simulado-word',
    data: { value, mode, options },
    correctAnswer: value,
    options,
    prompt: mode === 'number-to-word'
      ? `Como se escreve o número ${value} por extenso?`
      : `Qual número corresponde a ${word}?`,
    speech: mode === 'number-to-word'
      ? `Como se escreve o número ${value} por extenso?`
      : `Qual número corresponde a ${word}?`,
    explanation: `${word} corresponde ao número ${value}.`,
    hint: 'Leia cada parte do número e procure a escrita que corresponde a todas elas.',
    feedback: { correct: 'Muito bem! Você encontrou a escrita correta.', retry: 'Leia as opções com calma e tente outra vez.' },
  };
  return attachSubject(question, 'words');
}

function createAssociationQuestion(random) {
  const values = [208, 215, shuffled([221, 230, 237, 244, 250], random)[0]];
  const pairs = values.map((value) => ({ value, word: numberToPortuguese(value) }));
  const options = shuffled(pairs.map(({ word }) => word), random);
  const question = {
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_WORD_ASSOCIATION',
    questionId: `word-association-${values.join('-')}`,
    type: 'simulado-association',
    data: { pairs, options },
    correctAnswer: Object.fromEntries(pairs.map(({ value, word }) => [String(value), word])),
    options,
    prompt: 'Associe cada número à sua escrita por extenso. Use cada opção uma vez.',
    speech: `Associe cada número à sua escrita por extenso: ${values.join(', ')}.`,
    explanation: pairs.map(({ value, word }) => `${value} é ${word}`).join('; ') + '.',
    hint: 'Leia cada número e compare as centenas, dezenas e unidades com as palavras.',
    feedback: { correct: 'Muito bem! Todas as associações estão corretas.', retry: 'Confira cada par e use cada escrita uma só vez.' },
  };
  return attachSubject(question, 'words');
}

const OFFICIAL_SCENARIO_MONEY = Object.freeze([
  'note-5-reais', 'note-5-reais', 'note-10-reais', 'note-2-reais', 'note-2-reais',
]);

const OFFICIAL_TOY_PRODUCTS = Object.freeze([
  Object.freeze({ id: 'teddy-bear-25', label: 'Urso', illustrationId: 'teddy-bear', priceReais: 25 }),
  Object.freeze({ id: 'truck-20', label: 'Caminhão', illustrationId: 'truck', priceReais: 20 }),
  Object.freeze({ id: 'blocks-25', label: 'Blocos', illustrationId: 'building-blocks', priceReais: 25 }),
  Object.freeze({ id: 'dinosaur-3', label: 'Dinossauro', illustrationId: 'dinosaur', priceReais: 3 }),
]);

const SCHOOL_SUPPLIES = Object.freeze([
  Object.freeze({ id: 'eraser', label: 'Borracha', illustrationId: 'eraser', priceReais: 3 }),
  Object.freeze({ id: 'pencil', label: 'Lápis', illustrationId: 'pencil', priceReais: 2 }),
  Object.freeze({ id: 'glue', label: 'Cola', illustrationId: 'glue', priceReais: 7 }),
  Object.freeze({ id: 'scissors', label: 'Tesoura', illustrationId: 'scissors', priceReais: 4 }),
  Object.freeze({ id: 'notebook', label: 'Caderno', illustrationId: 'notebook', priceReais: 10 }),
]);

function createOfficialMoneyProductMatchingQuestion(random) {
  const groups = shuffled([
    { id: 'group-12', denominationIds: ['note-10-reais', 'note-2-reais'] },
    { id: 'group-7', denominationIds: ['note-5-reais', 'note-2-reais'] },
    { id: 'group-25', denominationIds: ['note-20-reais', 'note-5-reais'] },
    { id: 'group-22', denominationIds: ['note-20-reais', 'note-2-reais'] },
  ].map((group) => ({ ...group, totalCents: group.denominationIds.reduce((sum, id) => sum + moneyValue(id), 0) })), random);
  const products = shuffled([
    { id: 'teddy-bear-12', label: 'Urso', illustrationId: 'teddy-bear', priceReais: 12 },
    { id: 'truck-7', label: 'Caminhão', illustrationId: 'truck', priceReais: 7 },
    { id: 'blocks-25', label: 'Blocos', illustrationId: 'building-blocks', priceReais: 25 },
    { id: 'dinosaur-22', label: 'Dinossauro', illustrationId: 'dinosaur', priceReais: 22 },
  ], random);
  const question = {
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'BANKNOTE_PRODUCT_MATCHING',
    questionId: `official-banknote-product-matching-${groups.map(({ id }) => id).join('-')}-${products.map(({ id }) => id).join('-')}`,
    type: 'simulado-money-product-match',
    data: { groups, products, correctMatches: Object.fromEntries(groups.map((group) => [group.id, products.find((product) => product.priceReais * 100 === group.totalCents).id])) },
    correctAnswer: Object.fromEntries(groups.map((group) => [group.id, products.find((product) => product.priceReais * 100 === group.totalCents).id])),
    options: products.map(({ id }) => id),
    prompt: 'Associe cada grupo de cédulas ao brinquedo com o mesmo preço.',
    speech: 'Associe cada grupo de cédulas ao brinquedo com o mesmo preço.',
    explanation: 'Cada grupo de cédulas forma o preço de um brinquedo.',
    hint: 'Some as cédulas de cada grupo e compare com os preços dos brinquedos.',
    feedback: { correct: 'Muito bem! Você encontrou todos os preços correspondentes.', retry: 'Confira os grupos destacados e tente outra vez.' },
  };
  return attachSubject(question, 'money');
}

function moneyValue(id) {
  return MONEY_DENOMINATIONS.find(({ id: denominationId }) => denominationId === id)?.valueCents ?? Number.NaN;
}

function createOfficialShoppingScenarioQuestions() {
  const products = OFFICIAL_TOY_PRODUCTS.map((product) => ({ ...product }));
  const availableCents = OFFICIAL_SCENARIO_MONEY.reduce((sum, id) => sum + moneyValue(id), 0);
  const availableReais = availableCents / 100;
  const baseData = { scenarioId: 'rael-available-24', moneyDenominationIds: [...OFFICIAL_SCENARIO_MONEY], products, availableCents };
  const common = {
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'CONNECTED_SHOPPING_SCENARIO',
    speech: 'Rael tem moedas e cédulas para comprar brinquedos. Observe o dinheiro e os preços.',
    hint: 'Observe o dinheiro de Rael e compare os valores com calma.',
  };
  const questions = [
    {
      ...common, questionId: 'official-rael-money-total', type: 'simulado-shopping-total',
      data: { ...baseData, task: 'available-total' }, correctAnswer: availableReais,
      prompt: 'Quanto dinheiro Rael tem ao todo?',
      explanation: 'As cédulas de Rael somam 24 reais.',
    },
    {
      ...common, questionId: 'official-rael-affordability', type: 'simulado-shopping-affordability',
      data: { ...baseData, task: 'affordability', availableReais },
      correctAnswers: ['truck-20', 'dinosaur-3'],
      options: products.map(({ id }) => id),
      prompt: 'Marque todos os brinquedos que Rael pode comprar, um de cada vez.',
      explanation: 'Rael pode comprar o caminhão de 20 reais e o dinossauro de 3 reais.',
    },
    {
      ...common, questionId: 'official-rael-truck-change', type: 'simulado-shopping-change',
      data: { ...baseData, task: 'change', availableReais, purchaseProductId: 'truck-20' },
      correctAnswer: (availableCents - products.find(({ id }) => id === 'truck-20').priceReais * 100) / 100,
      prompt: 'Rael comprou o caminhão. Quanto recebeu de troco?',
      explanation: '24 reais menos 20 reais são 4 reais de troco.',
    },
  ];
  return questions.map((question) => attachSubject({
    ...question,
    feedback: { correct: 'Muito bem! Você resolveu esta parte da compra.', retry: 'Observe o dinheiro e os preços. Tente novamente.' },
  }, 'money'));
}

function createOfficialProductBoardQuestions() {
  const products = SCHOOL_SUPPLIES.map((product) => ({ ...product }));
  const answerOptions = products.map(({ id, label }) => ({ value: id, label }));
  const tasks = [
    { id: 'cheapest', prompt: 'Qual item é o mais barato?', correctAnswer: 'pencil', mode: 'choice' },
    { id: 'most-expensive', prompt: 'Qual item é o mais caro?', correctAnswer: 'notebook', mode: 'choice' },
    { id: 'pencil-eraser-scissors', prompt: 'Quanto custam juntos o lápis, a borracha e a tesoura?', productIds: ['pencil', 'eraser', 'scissors'], correctAnswer: 9, mode: 'number' },
    { id: 'notebook-glue', prompt: 'Quanto custam juntos o caderno e a cola?', productIds: ['notebook', 'glue'], correctAnswer: 17, mode: 'number' },
  ];
  return tasks.map((task) => {
    const priceTotalCents = (task.productIds ?? []).reduce((sum, id) => {
      const product = products.find((item) => item.id === id);
      return sum + (product?.priceReais ?? 0) * 100;
    }, 0);
    const correctAnswer = task.mode === 'number' ? priceTotalCents / 100 : task.correctAnswer;
    return attachSubject({
      revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
      pedagogicalCategory: 'PRODUCT_PRICE_BOARD',
      questionId: `official-school-supplies-${task.id}`, type: 'simulado-product-board',
      data: { boardId: 'school-supplies-3-2-7-4-10', products, taskId: task.id, productIds: task.productIds ?? [] },
      correctAnswer,
      options: task.mode === 'choice' ? answerOptions : [],
      prompt: task.prompt, speech: task.prompt,
      explanation: task.mode === 'choice'
        ? `${products.find(({ id }) => id === task.correctAnswer).label} é o item ${task.id === 'cheapest' ? 'mais barato' : 'mais caro'}.`
        : `Os preços dos itens pedidos somam ${correctAnswer} reais.`,
      hint: task.mode === 'choice' ? 'Compare os preços dos cinco materiais.' : 'Encontre os produtos citados no quadro e some apenas os preços deles.',
      feedback: { correct: 'Muito bem! Você leu os preços com atenção.', retry: 'Confira os produtos e os preços no quadro e tente outra vez.' },
    }, 'money');
  });
}

function createOfficialNumberTableQuestion(random) {
  const base = createNumberTableQuestion(random, { start: 200, length: 40, columns: 10, blankCount: 40 });
  const givenValues = new Set([200, 205, 210, 219, 220, 225, 230, 238]);
  const gaps = base.gaps.filter((index) => !givenValues.has(base.values[index])).slice(0, 12);
  for (let index = 0; gaps.length < 12 && index < base.values.length; index += 1) {
    if (!givenValues.has(base.values[index]) && !gaps.includes(index)) gaps.push(index);
  }
  gaps.sort((left, right) => left - right);
  const table = { ...base, gaps, answers: gaps.map((index) => base.values[index]) };
  return attachSubject({
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_TABLE_COMPLETION', questionId: 'official-number-table-200-239',
    type: 'simulado-number-table', data: { table },
    prompt: 'Complete os espaços vazios da tabela.',
    speech: 'Complete a tabela dos números de duzentos até duzentos e trinta e nove.',
    explanation: 'A tabela segue a contagem de um em um, da esquerda para a direita e de cima para baixo.',
    hint: 'Leia cada linha da esquerda para a direita. Depois continue na linha seguinte.',
    feedback: { correct: 'Muito bem! Você completou a tabela.', retry: 'Confira a ordem dos números e tente novamente.' },
  }, 'sequences');
}

function createWordWritingQuestion(value) {
  const expectedWord = numberToWordsPtBr(value);
  return attachSubject({
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_WORD_WRITING', questionId: `word-writing-${value}`,
    type: 'simulado-word-write', data: { value }, correctAnswer: expectedWord, options: [],
    prompt: `Escreva o número ${value} por extenso.`,
    speech: `Escreva o número ${value} por extenso.`,
    explanation: `${value} se escreve ${expectedWord}.`,
    hint: 'Pense nas centenas, dezenas e unidades. Escreva as palavras que representam cada parte.',
    feedback: { correct: 'Muito bem! Você escreveu o número por extenso.', retry: 'Leia o número em partes e tente escrever novamente.' },
  }, 'words');
}

function createTwoStepLibraryQuestion(random = Math.random) {
  const additionQuestion = createAv2AdditionQuestionForOperands({ a: 156, b: 195, random });
  const subtractionQuestion = createSubtractionQuestion({ a: 351, b: 147, random });
  const steps = [
    { kind: 'operation', operation: 'addition', subjectId: 'addition', question: additionQuestion, result: 351 },
    { kind: 'terms', operation: 'addition', subjectId: 'addition', question: additionQuestion,
      expectedRoles: { a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' } },
    { kind: 'operation', operation: 'subtraction', subjectId: 'subtraction', question: subtractionQuestion, result: 204 },
    { kind: 'terms', operation: 'subtraction', subjectId: 'subtraction', question: subtractionQuestion,
      expectedRoles: { a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' } },
  ];
  return freezeDeep({
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'CONTEXTUAL_TWO_STEP_PROBLEM',
    questionId: 'two-step-library-156-195-147',
    type: 'simulado-two-step',
    data: {
      context: 'biblioteca',
      item: 'livros',
      initialAmount: 156,
      donatedAmount: 195,
      removedAmount: 147,
      intermediate: 351,
      finalAmount: 204,
      steps,
    },
    correctAnswer: 204,
    options: [],
    prompt: 'A biblioteca tinha 156 livros e recebeu mais 195. Depois, 147 livros foram retirados. Resolva uma etapa de cada vez.',
    speech: 'A biblioteca tinha 156 livros e recebeu mais 195. Depois, 147 livros foram retirados. Resolva uma etapa de cada vez.',
    explanation: 'A 1ª parcela é 156, a 2ª parcela é 195 e a soma é 351. Depois, 351 é o minuendo, 147 é o subtraendo e 204 é o resto ou diferença.',
    hint: 'Alinhe centenas, dezenas e unidades. Resolva a adição antes de começar a subtração.',
    feedback: { correct: 'Muito bem! Você resolveu as duas operações e identificou seus termos.', retry: 'Resolva uma etapa de cada vez e confira os nomes dos termos.' },
    simulado: {
      questionId: 'two-step-library-156-195-147',
      subjectIds: ['addition', 'subtraction'],
      sourceType: 'context',
      contextual: true,
      composite: true,
    },
  });
}

export function normalizeAv2SimuladoCounts(counts = {}) {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return Object.freeze({});
  const normalized = {};
  for (const { id } of AV2_SIMULADO_SUBJECTS) {
    if (counts[id] === false || counts[id] === 0 || counts[id] === null) continue;
    if (counts[id] === true) {
      normalized[id] = AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT;
      continue;
    }
    const raw = typeof counts[id] === 'object' ? counts[id].count : counts[id];
    if (AV2_SIMULADO_QUESTION_COUNTS.includes(Number(raw))) normalized[id] = Number(raw);
  }
  return Object.freeze(normalized);
}

function topicCandidates(subjectId, count, random, { preferContext = false } = {}) {
  if (subjectId === 'money') {
    const moneyQuestions = createAv2Round(random);
    const shoppingQuestions = createAv2ShoppingRound(random);
    const compositionChallenges = createAv2MoneyCompositionRound(random)
      .filter((challenge) => challenge.requiredDistinctSolutions === 1)
      .map((question) => attachSubject(question, 'money'));
    const allCandidates = [
      ...moneyQuestions.map((question) => attachSubject(question, 'money')),
      ...shoppingQuestions.map((question) => attachSubject(question, 'money')),
      ...compositionChallenges,
      createOfficialMoneyProductMatchingQuestion(random),
    ];
    const equivalence = allCandidates.find(({ type }) => type === 'equivalence');
    const affordability = allCandidates.find(({ type }) => type === 'shopping-affordability');
    const productSum = allCandidates.find(({ type }) => type === 'shopping-product-sum');
    const change = allCandidates.find(({ type }) => type === 'shopping-change');
    const composition = shuffled(compositionChallenges, random)[0];
    const productMatching = allCandidates.find(({ type }) => type === 'simulado-money-product-match');
    const priority = [affordability, equivalence, productSum, change, composition, productMatching].filter(Boolean);
    if (count === 1) return [shuffled(priority.slice(0, 4), random)[0]];
    const selected = priority.slice(0, Math.min(count, priority.length));
    return fillUnique(selected, shuffled(allCandidates, random), count);
  }

  if (subjectId === 'addition') {
    const candidates = createAv2AdditionRound(random).map((question) => attachSubject(question, 'addition'));
    const contextual = candidates.filter(({ type }) => type === 'context');
    const selected = preferContext && count > 0 && contextual.length ? [contextual[0]] : [];
    return fillUnique(selected, shuffled(candidates, random), count);
  }

  if (subjectId === 'subtraction') {
    const candidates = createAv2SubtractionRound(random).map((question) => attachSubject(question, 'subtraction'));
    const contextual = candidates.filter(({ type }) => type === 'context');
    const selected = preferContext && count > 0 && contextual.length ? [contextual[0]] : [];
    return fillUnique(selected, shuffled(candidates, random), count);
  }

  if (subjectId === 'sequences') {
    const patterns = [];
    for (let start = 200; start <= 246; start += 1) patterns.push([start, 1], [start, 2]);
    const tableBase = createNumberTableQuestion(random, { start: 200, length: 20, columns: 5, blankCount: 4 });
    const table = attachSubject({
      ...tableBase,
      revisionId: 'av2-matematica',
      activityId: AV2_SIMULADO_ACTIVITY_ID,
      pedagogicalCategory: 'NUMBER_TABLE_COMPLETION',
      type: 'simulado-number-table',
      questionId: `table-${tableBase.values[0]}-${tableBase.values.at(-1)}`,
      data: { table: tableBase },
      speech: `Complete a tabela dos números de ${numberToPortuguese(tableBase.values[0])} até ${numberToPortuguese(tableBase.values.at(-1))}.`,
      feedback: { correct: 'Muito bem! Você completou a tabela.', retry: 'Confira a ordem dos números e tente novamente.' },
    }, 'sequences');
    const sequenceCandidates = shuffled(patterns, random).map(([start, missingIndex]) => createSequenceQuestion(random, start, missingIndex));
    if (count === 1) return [randomIndex(2, random) === 0 ? table : sequenceCandidates[0]];
    return fillUnique([table], sequenceCandidates, count);
  }
  if (subjectId === 'words') {
    const writingValues = shuffled([208, 215, 220, 235, 250, 300, 400], random);
    const selected = count > 0 ? [createWordWritingQuestion(writingValues[0])] : [];
    if (count > 1) selected.push(createAssociationQuestion(random));
    const wordCases = [];
    for (let value = 200; value <= 250; value += 1) {
      wordCases.push([value, 'number-to-word'], [value, 'word-to-number']);
    }
    wordCases.push([300, 'number-to-word'], [400, 'number-to-word']);
    for (const [value, mode] of shuffled(wordCases, random)) {
      if (selected.length >= count) break;
      const candidate = createWordQuestion(random, value, mode);
      if (selected.some(({ questionId }) => questionId === candidate.questionId)) continue;
      selected.push(candidate);
    }
    return selected;
  }
  return [];
}

function fillUnique(selected, candidates, count) {
  const ids = new Set(selected.map(({ questionId }) => questionId));
  for (const candidate of candidates) {
    if (selected.length >= count) break;
    if (ids.has(candidate.questionId)) continue;
    ids.add(candidate.questionId);
    selected.push(candidate);
  }
  return selected;
}

function validateSequenceQuestion(question) {
  const { sequence, start, missingIndex, increment } = question.data ?? {};
  if (!Array.isArray(sequence) || sequence.length !== 4 || !Number.isInteger(start)
    || start < 200 || start > 246 || ![1, 2].includes(missingIndex) || increment !== 1) return false;
  const expected = Array.from({ length: 4 }, (_, index) => start + index);
  if (sequence.some((value, index) => index === missingIndex ? value !== null : value !== expected[index])) return false;
  const shown = sequence.map((value) => value ?? '___').join(' · ');
  return question.correctAnswer === expected[missingIndex]
    && question.prompt === `Complete a sequência que aumenta de um em um: ${shown}.`
    && Array.isArray(question.options) && question.options.length >= 3
    && new Set(question.options).size === question.options.length
    && question.options.filter((value) => value === question.correctAnswer).length === 1
    && question.options.every((value) => Number.isInteger(value) && value >= 200 && value <= WHOLE_NUMBER_LIMIT);
}

function validateWordQuestion(question) {
  const { value, mode, options } = question.data ?? {};
  if (!Number.isInteger(value) || (value < 200 || value > 250) && !([300, 400].includes(value) && mode === 'number-to-word')
    || !['number-to-word', 'word-to-number'].includes(mode) || !Array.isArray(options) || options.length !== question.options?.length
    || JSON.stringify(options) !== JSON.stringify(question.options)) return false;
  const uniqueValues = new Set(options.map(({ value: optionValue }) => optionValue));
  return uniqueValues.size === options.length && options.some(({ value: optionValue }) => optionValue === value)
    && options.every(({ value: optionValue, label }) => Number.isInteger(optionValue)
      && (optionValue >= 200 && optionValue <= 250 || [300, 400].includes(optionValue) && mode === 'number-to-word')
      && typeof label === 'string' && label === (mode === 'number-to-word' ? numberToPortuguese(optionValue) : String(optionValue)))
    && question.correctAnswer === value
    && question.prompt === (mode === 'number-to-word' ? `Como se escreve o número ${value} por extenso?` : `Qual número corresponde a ${numberToPortuguese(value)}?`)
    && question.speech === question.prompt;
}

function validateAssociationQuestion(question) {
  const { pairs, options } = question.data ?? {};
  if (!Array.isArray(pairs) || pairs.length !== 3 || !Array.isArray(options) || options.length !== pairs.length
    || new Set(options).size !== options.length || new Set(pairs.map(({ value }) => value)).size !== pairs.length) return false;
  const expected = Object.fromEntries(pairs.map(({ value, word }) => [String(value), word]));
  return pairs.every(({ value, word }) => Number.isInteger(value) && value >= 200 && value <= 250 && word === numberToPortuguese(value))
    && [...options].sort().join('|') === pairs.map(({ word }) => word).sort().join('|')
    && JSON.stringify(options) === JSON.stringify(question.options)
    && JSON.stringify(expected) === JSON.stringify(question.correctAnswer)
    && question.prompt === 'Associe cada número à sua escrita por extenso. Use cada opção uma vez.';
}

function validateMoneyProductMatching(question) {
  const { groups, products, correctMatches } = question.data ?? {};
  if (!Array.isArray(groups) || groups.length !== 4 || !Array.isArray(products) || products.length !== 4
    || new Set(groups.map(({ id }) => id)).size !== 4 || new Set(products.map(({ id }) => id)).size !== 4
    || products.some((product) => !product || typeof product.id !== 'string' || !Number.isInteger(product.priceReais)
      || product.priceReais <= 0 || getAv2ProductIllustrationId(product.label) !== product.illustrationId)) return false;
  const expected = {};
  for (const group of groups) {
    if (!Array.isArray(group.denominationIds) || group.denominationIds.length < 2
      || group.denominationIds.some((id) => !MONEY_DENOMINATIONS.some((money) => money.id === id && money.kind === 'note'))) return false;
    const totalCents = group.denominationIds.reduce((sum, id) => sum + moneyValue(id), 0);
    const matchingProducts = products.filter(({ priceReais }) => priceReais * 100 === totalCents);
    if (group.totalCents !== totalCents || matchingProducts.length !== 1) return false;
    expected[group.id] = matchingProducts[0].id;
  }
  return new Set(products.map(({ priceReais }) => priceReais)).size === products.length
    && JSON.stringify(question.options) === JSON.stringify(products.map(({ id }) => id))
    && JSON.stringify(correctMatches) === JSON.stringify(expected)
    && JSON.stringify(question.correctAnswer) === JSON.stringify(expected)
    && question.prompt === 'Associe cada grupo de cédulas ao brinquedo com o mesmo preço.'
    && question.speech === question.prompt;
}

function validateOfficialScenarioQuestion(question) {
  const { scenarioId, moneyDenominationIds, products, task, availableCents, availableReais, purchaseProductId } = question.data ?? {};
  if (scenarioId !== 'rael-available-24' || JSON.stringify(moneyDenominationIds) !== JSON.stringify(OFFICIAL_SCENARIO_MONEY)
    || availableCents !== 2400 || moneyDenominationIds.reduce((sum, id) => sum + moneyValue(id), 0) !== availableCents
    || JSON.stringify(products) !== JSON.stringify(OFFICIAL_TOY_PRODUCTS)) return false;
  const expectedAffordable = products.filter(({ priceReais }) => priceReais * 100 <= availableCents).map(({ id }) => id);
  if (question.type === 'simulado-shopping-total') return task === 'available-total'
    && question.correctAnswer * 100 === availableCents && question.prompt === 'Quanto dinheiro Rael tem ao todo?'
    && question.speech === 'Rael tem moedas e cédulas para comprar brinquedos. Observe o dinheiro e os preços.';
  if (question.type === 'simulado-shopping-affordability') return task === 'affordability'
    && availableReais * 100 === availableCents && JSON.stringify([...question.correctAnswers].sort()) === JSON.stringify([...expectedAffordable].sort())
    && JSON.stringify([...question.options].sort()) === JSON.stringify(products.map(({ id }) => id).sort())
    && question.prompt === 'Marque todos os brinquedos que Rael pode comprar, um de cada vez.';
  if (question.type === 'simulado-shopping-change') return task === 'change'
    && availableReais * 100 === availableCents && purchaseProductId === 'truck-20'
    && question.correctAnswer * 100 === availableCents - products.find(({ id }) => id === purchaseProductId).priceReais * 100
    && question.correctAnswer === 4 && question.prompt === 'Rael comprou o caminhão. Quanto recebeu de troco?';
  return false;
}

function validateProductBoardQuestion(question) {
  const { boardId, products, taskId, productIds } = question.data ?? {};
  if (boardId !== 'school-supplies-3-2-7-4-10' || JSON.stringify(products) !== JSON.stringify(SCHOOL_SUPPLIES)
    || !Array.isArray(productIds)) return false;
  if (taskId === 'cheapest' || taskId === 'most-expensive') {
    const ordered = [...products].sort((a, b) => taskId === 'cheapest' ? a.priceReais - b.priceReais : b.priceReais - a.priceReais);
    return ordered[0].priceReais !== ordered[1].priceReais
      && question.correctAnswer === ordered[0].id
      && JSON.stringify(question.options) === JSON.stringify(products.map(({ id, label }) => ({ value: id, label })))
      && question.prompt === (taskId === 'cheapest' ? 'Qual item é o mais barato?' : 'Qual item é o mais caro?');
  }
  const expectedIds = taskId === 'pencil-eraser-scissors' ? ['pencil', 'eraser', 'scissors']
    : taskId === 'notebook-glue' ? ['notebook', 'glue'] : null;
  if (!expectedIds || JSON.stringify(productIds) !== JSON.stringify(expectedIds) || question.options.length !== 0) return false;
  const selected = expectedIds.map((id) => products.find((product) => product.id === id));
  const totalCents = selected.reduce((sum, product) => sum + product.priceReais * 100, 0);
  const names = taskId === 'pencil-eraser-scissors' ? 'o lápis, a borracha e a tesoura' : 'o caderno e a cola';
  return question.correctAnswer * 100 === totalCents
    && question.prompt === `Quanto custam juntos ${names}?`
    && question.speech === question.prompt;
}

function validateNumberTableQuestion(question) {
  const table = question.data?.table;
  if (question.type !== 'simulado-number-table' || table?.type !== 'number-table'
    || !Array.isArray(table.values) || table.values.length < 2 || table.values.length > 40
    || !Number.isInteger(table.columns) || table.columns < 1
    || table.values.some((value, index) => !Number.isInteger(value) || value < 0 || value > WHOLE_NUMBER_LIMIT
      || (index > 0 && value !== table.values[index - 1] + 1))
    || !Array.isArray(table.gaps) || table.gaps.length < 2 || new Set(table.gaps).size !== table.gaps.length
    || table.gaps.some((index) => !Number.isInteger(index) || index < 0 || index >= table.values.length)
    || !Array.isArray(table.answers) || table.answers.length !== table.gaps.length
    || table.gaps.some((index, answerIndex) => table.answers[answerIndex] !== table.values[index])) return false;
  if (question.questionId === 'official-number-table-200-239') {
    return table.values[0] === 200 && table.values.length === 40 && table.columns === 10
      && table.gaps.length === 12
      && [200, 205, 210, 219, 220, 225, 230, 238].every((value) => !table.gaps.includes(value - 200));
  }
  return question.prompt === 'Complete os espaços vazios da tabela.';
}

function validateWordWritingQuestion(question) {
  const value = question.data?.value;
  if (!NUMBER_WORD_VALUES.includes(value) || question.type !== 'simulado-word-write') return false;
  const word = numberToWordsPtBr(value);
  return question.correctAnswer === word
    && question.prompt === `Escreva o número ${value} por extenso.`
    && question.speech === question.prompt
    && !question.hint.toLocaleLowerCase('pt-BR').includes(word.toLocaleLowerCase('pt-BR'));
}

function validateTwoStepQuestion(question) {
  const data = question.data;
  const [addition, additionTerms, subtraction, subtractionTerms] = data?.steps ?? [];
  const addQuestion = addition?.question;
  const subtractQuestion = subtraction?.question;
  return data?.steps?.length === 4 && typeof question.prompt === 'string' && data?.context === 'biblioteca'
    && data.initialAmount === 156 && data.donatedAmount === 195
    && data.removedAmount === 147 && data.intermediate === 351 && data.finalAmount === 204
    && addition?.kind === 'operation' && addition.operation === 'addition' && addition.subjectId === 'addition'
    && validateAv2AdditionQuestionCandidate(addQuestion)
    && addQuestion.data.a === data.initialAmount && addQuestion.data.b === data.donatedAmount
    && addQuestion.data.result === data.intermediate && addition.result === data.intermediate
    && additionTerms?.kind === 'terms' && additionTerms.question?.questionId === addQuestion.questionId
    && JSON.stringify(additionTerms.expectedRoles) === JSON.stringify({ a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' })
    && subtraction?.kind === 'operation' && subtraction.operation === 'subtraction' && subtraction.subjectId === 'subtraction'
    && validateAv2SubtractionQuestionCandidate(subtractQuestion)
    && subtractQuestion.data.a === addQuestion.data.result && subtractQuestion.data.b === data.removedAmount
    && subtractQuestion.data.result === data.finalAmount && subtraction.result === data.finalAmount
    && subtractionTerms?.kind === 'terms' && subtractionTerms.question?.questionId === subtractQuestion.questionId
    && JSON.stringify(subtractionTerms.expectedRoles) === JSON.stringify({ a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' })
    && question.correctAnswer === data.finalAmount
    && question.prompt.includes('156') && question.prompt.includes('195') && question.prompt.includes('147')
    && !question.prompt.includes('351') && !question.prompt.includes('204') && question.speech === question.prompt;
}

export function validateAv2SimuladoQuestionCandidate(question) {
  if (!question || question.revisionId !== 'av2-matematica' || !question.simulado
    || typeof question.simulado.questionId !== 'string' || !question.simulado.questionId
    || !Array.isArray(question.simulado.subjectIds) || question.simulado.subjectIds.length === 0
    || new Set(question.simulado.subjectIds).size !== question.simulado.subjectIds.length
    || !question.simulado.subjectIds.every((subjectId) => SUBJECT_IDS.has(subjectId))) return false;

  if (question.type === 'simulado-sequence') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'INCREASING_SEQUENCE_BY_ONE'
    && question.simulado.subjectId === 'sequences' && question.simulado.subjectIds.join('|') === 'sequences'
    && validateSequenceQuestion(question);
  if (question.type === 'simulado-word') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'NUMBER_WORDS'
    && question.simulado.subjectId === 'words' && question.simulado.subjectIds.join('|') === 'words'
    && validateWordQuestion(question);
  if (question.type === 'simulado-word-write') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'NUMBER_WORD_WRITING'
    && question.simulado.subjectId === 'words' && question.simulado.subjectIds.join('|') === 'words'
    && validateWordWritingQuestion(question);
  if (question.type === 'simulado-number-table') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'NUMBER_TABLE_COMPLETION'
    && question.simulado.subjectId === 'sequences' && question.simulado.subjectIds.join('|') === 'sequences'
    && validateNumberTableQuestion(question);
  if (question.type === 'simulado-money-product-match') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'BANKNOTE_PRODUCT_MATCHING'
    && question.simulado.subjectId === 'money' && question.simulado.subjectIds.join('|') === 'money'
    && validateMoneyProductMatching(question);
  if (question.type.startsWith('simulado-shopping-')) return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'CONNECTED_SHOPPING_SCENARIO'
    && question.simulado.subjectId === 'money' && question.simulado.subjectIds.join('|') === 'money'
    && validateOfficialScenarioQuestion(question);
  if (question.type === 'simulado-product-board') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'PRODUCT_PRICE_BOARD'
    && question.simulado.subjectId === 'money' && question.simulado.subjectIds.join('|') === 'money'
    && validateProductBoardQuestion(question);
  if (question.type === 'simulado-association') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'NUMBER_WORD_ASSOCIATION'
    && question.simulado.subjectId === 'words' && question.simulado.subjectIds.join('|') === 'words'
    && validateAssociationQuestion(question);
  if (question.type === 'simulado-two-step') return question.activityId === AV2_SIMULADO_ACTIVITY_ID
    && question.pedagogicalCategory === 'CONTEXTUAL_TWO_STEP_PROBLEM'
    && question.simulado.composite === true && question.simulado.subjectIds.join('|') === 'addition|subtraction'
    && validateTwoStepQuestion(question);

  if (question.simulado.subjectIds.length !== 1 || question.simulado.subjectId !== question.simulado.subjectIds[0]) return false;
  if (question.activityId === AV2_MONEY_ACTIVITY_ID || question.activityId === AV2_SHOPPING_ACTIVITY_ID) {
    return question.simulado.subjectId === 'money' && validateAv2MoneyQuestionCandidate(question);
  }
  if (question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID) {
    return question.simulado.subjectId === 'money'
      && question.simulado.subjectIds.join('|') === 'money'
      && question.requiredDistinctSolutions === 1
      && validateAv2MoneyCompositionChallenge(question);
  }
  if (question.activityId === AV2_ADDITION_ACTIVITY_ID) {
    return question.simulado.subjectId === 'addition' && validateAv2AdditionQuestionCandidate(question);
  }
  if (question.activityId === AV2_SUBTRACTION_ACTIVITY_ID) {
    return question.simulado.subjectId === 'subtraction' && validateAv2SubtractionQuestionCandidate(question);
  }
  return false;
}

export function validateAv2SimuladoAnswer(question, answer, stage = 1) {
  if (!validateAv2SimuladoQuestionCandidate(question)) return false;
  if (question.type === 'simulado-word-write') {
    const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    return normalize(answer) === normalize(question.correctAnswer);
  }
  if (question.type === 'simulado-number-table') return validateNumberTable(question.data.table, answer);
  if (question.type === 'simulado-money-product-match') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
    const expected = question.correctAnswer;
    const groupIds = question.data.groups.map(({ id }) => id);
    const selectedProducts = groupIds.map((id) => answer[id]);
    return Object.keys(answer).length === groupIds.length
      && groupIds.every((id) => answer[id] === expected[id])
      && selectedProducts.every(Boolean) && new Set(selectedProducts).size === selectedProducts.length;
  }
  if (question.type === 'simulado-shopping-affordability') {
    return Array.isArray(answer) && new Set(answer).size === answer.length
      && [...answer].sort().join('|') === [...question.correctAnswers].sort().join('|');
  }
  if (question.type === 'simulado-shopping-total' || question.type === 'simulado-shopping-change') {
    const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
    return Number.isInteger(normalized) && normalized === question.correctAnswer;
  }
  if (question.type === 'simulado-product-board') {
    if (question.options.length) return question.options.some(({ value }) => value === answer)
      && answer === question.correctAnswer;
    const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
    return Number.isInteger(normalized) && normalized === question.correctAnswer;
  }
  if (question.type === 'simulado-sequence' || question.type === 'simulado-word') {
    const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
    const offered = question.options.some((option) => typeof option === 'object' ? option.value === normalized : option === normalized);
    return normalized === question.correctAnswer && offered;
  }
  if (question.type === 'simulado-two-step') {
    const step = question.data.steps[stage - 1];
    if (!step || !Number.isInteger(stage) || stage < 1 || stage > question.data.steps.length) return false;
    if (step.kind === 'terms') {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
      const keys = Object.keys(step.expectedRoles);
      const selected = keys.map((key) => answer[key]);
      return Object.keys(answer).length === keys.length
        && keys.every((key) => answer[key] === step.expectedRoles[key])
        && new Set(selected).size === keys.length;
    }
    return step.operation === 'addition'
      ? validateAv2AdditionAnswer(step.question, answer)
      : validateAv2SubtractionAnswer(step.question, answer);
  }
  if (question.activityId === AV2_ADDITION_ACTIVITY_ID) return validateAv2AdditionAnswer(question, answer);
  if (question.activityId === AV2_SUBTRACTION_ACTIVITY_ID) return validateAv2SubtractionAnswer(question, answer);
  if (question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID) {
    return validateAv2MoneyCompositionSelection(question, answer).correct;
  }
  return validateAv2Answer(question, answer);
}

function normalizeTarget(target, index) {
  const subjectId = typeof target === 'string' ? target : target?.subjectId;
  if (!SUBJECT_IDS.has(subjectId)) throw new TypeError('Assunto de revisão de erro desconhecido.');
  return {
    subjectId,
    key: typeof target === 'string' ? `${subjectId}-${index}` : target.key ?? `${subjectId}-${index}`,
    contextual: typeof target === 'object' && target?.contextual === true,
    sourceQuestionId: typeof target === 'object' ? target?.sourceQuestionId : null,
    sourceType: typeof target === 'object' ? target?.sourceType : null,
  };
}

export function createAv2SimuladoRound(counts = {}, random = Math.random) {
  const normalizedCounts = normalizeAv2SimuladoCounts(counts);
  const active = Object.keys(normalizedCounts);
  if (!active.length) throw new RangeError('Selecione pelo menos um assunto para o simulado.');
  const includesTwoStep = normalizedCounts.addition > 0 && normalizedCounts.subtraction > 0;
  const questions = [];

  for (const subjectId of active) {
    const count = normalizedCounts[subjectId] - (includesTwoStep && ['addition', 'subtraction'].includes(subjectId) ? 1 : 0);
    if (count > 0) {
      questions.push(...topicCandidates(subjectId, count, random, {
        preferContext: !includesTwoStep && ['addition', 'subtraction'].includes(subjectId),
      }));
    }
  }
  if (includesTwoStep) questions.push(createTwoStepLibraryQuestion(random));

  const round = shuffled(questions, random);
  if (!validateAv2SimuladoRound(round, normalizedCounts)) {
    const invalid = round.filter((question) => !validateAv2SimuladoQuestionCandidate(question));
    throw new TypeError(`A rodada viola o contrato do Simulado AV2: ${invalid.map(({ type, questionId, simulado }) => `${type}:${questionId}:${simulado?.questionId}`).join(',') || round.map(({ questionId, simulado }) => `${questionId}:${simulado.questionId}`).join(',')}.`);
  }
  return freezeDeep(round);
}

export function createAv2SimuladoFullCoverageRound(random = Math.random) {
  const banknoteMatch = createCurrencyEquivalenceQuestion({
    denominationIds: ['coin-1-real', 'coin-50-centavos', 'coin-25-centavos', 'coin-25-centavos'],
    targetDenominationId: 'note-2-reais', random,
  });
  const fullTable = createOfficialNumberTableQuestion(random);
  const reviewGroups = [
    [attachSubject(banknoteMatch, 'money')],
    [createOfficialMoneyProductMatchingQuestion(random)],
    createOfficialShoppingScenarioQuestions(),
    ['equiv-1-from-50', 'equiv-5-from-1'].map((id) => attachSubject(getAv2MoneyCompositionChallenge(id), 'money')),
    createOfficialProductBoardQuestions(),
    [fullTable],
    [createWordWritingQuestion(208), createWordWritingQuestion(215)],
    [createTwoStepLibraryQuestion(random)],
  ];
  const round = shuffled(reviewGroups, random).flat();
  if (!validateAv2SimuladoFullCoverageRound(round)) {
    const invalid = round.filter((question) => !validateAv2SimuladoQuestionCandidate(question));
    throw new TypeError(`A revisão completa não cobre corretamente o contrato oficial da AV2: ${invalid.map(({ type, questionId }) => `${type}:${questionId}`).join(',') || 'cobertura incompleta'}.`);
  }
  return freezeDeep(round);
}

export function createAv2SimuladoFocusRound(targets = [], random = Math.random) {
  if (!Array.isArray(targets) || targets.length === 0) throw new RangeError('Não há questões para a rodada focada nos erros.');
  const normalizedTargets = targets.map(normalizeTarget);
  const counts = Object.fromEntries(AV2_SIMULADO_SUBJECTS.map(({ id }) => [id, normalizedTargets.filter(({ subjectId }) => subjectId === id).length]).filter(([, count]) => count > 0));
  const selected = [];
  const used = new Set();
  for (const subject of AV2_SIMULADO_SUBJECTS) {
    const subjectTargets = normalizedTargets.filter(({ subjectId }) => subjectId === subject.id);
    if (!subjectTargets.length) continue;
    const candidates = topicCandidates(subject.id, subjectTargets.length + 5, random, {
      preferContext: subjectTargets.some(({ contextual }) => contextual) && ['addition', 'subtraction'].includes(subject.id),
    });
    subjectTargets.forEach((target, index) => {
      const unused = candidates.filter((candidate) => !used.has(candidate.simulado.questionId));
      const matchingType = target.sourceType ? unused.find((candidate) => candidate.type === target.sourceType
        && (candidate.simulado.questionId !== target.sourceQuestionId || target.sourceType === 'simulado-money-product-match')) : null;
      const question = matchingType ?? unused.find((candidate) => candidate.simulado.questionId !== target.sourceQuestionId);
      if (!question) throw new Error(`Não foi possível gerar uma nova questão de ${subject.label.toLocaleLowerCase('pt-BR')}.`);
      used.add(question.simulado.questionId);
      selected.push(freezeDeep({ ...question, simulado: { ...question.simulado, reviewTargetKey: target.key } }));
    });
  }
  const round = shuffled(selected, random);
  if (!validateAv2SimuladoRound(round, counts)) throw new TypeError('A rodada de reforço viola o contrato do Simulado AV2.');
  return freezeDeep(round);
}

export function validateAv2SimuladoRound(round, counts = null) {
  if (!Array.isArray(round) || round.length === 0 || !round.every(validateAv2SimuladoQuestionCandidate)) return false;
  const ids = round.map(({ simulado }) => simulado.questionId);
  if (new Set(ids).size !== ids.length) return false;
  if (!counts) return true;
  const normalizedCounts = normalizeAv2SimuladoCounts(counts);
  const actual = Object.fromEntries(AV2_SIMULADO_SUBJECTS.map(({ id }) => [id, 0]));
  for (const question of round) for (const subjectId of question.simulado.subjectIds) actual[subjectId] += 1;
  return AV2_SIMULADO_SUBJECTS.every(({ id }) => actual[id] === (normalizedCounts[id] ?? 0));
}

export function validateAv2SimuladoFullCoverageRound(round) {
  if (!validateAv2SimuladoRound(round) || round.length !== 15) return false;
  const types = (type) => round.filter((question) => question.type === type);
  const equivalence = round.find((question) => question.type === 'equivalence'
    && question.data?.targetDenominationId === 'note-2-reais');
  const compositionIds = new Set(round.filter((question) => question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID)
    .map(({ challengeId }) => challengeId));
  const shoppingTypes = ['simulado-shopping-total', 'simulado-shopping-affordability', 'simulado-shopping-change'];
  const boardTasks = new Set(types('simulado-product-board').map(({ data }) => data.taskId));
  const writingValues = new Set(types('simulado-word-write').map(({ data }) => data.value));
  const library = types('simulado-two-step')[0];
  return Boolean(equivalence && types('simulado-money-product-match').length === 1
    && shoppingTypes.every((type) => types(type).length === 1)
    && compositionIds.size === 2 && compositionIds.has('equiv-1-from-50') && compositionIds.has('equiv-5-from-1')
    && boardTasks.size === 4 && ['cheapest', 'most-expensive', 'pencil-eraser-scissors', 'notebook-glue'].every((id) => boardTasks.has(id))
    && types('simulado-number-table').length === 1 && types('simulado-number-table')[0].data.table.values.length === 40
    && writingValues.size === 2 && writingValues.has(208) && writingValues.has(215)
    && library?.data.steps.length === 4
    && round.filter(({ simulado }) => simulado.subjectId === 'money').length === 11
    && round.filter(({ simulado }) => simulado.subjectId === 'words').length === 2
    && round.filter(({ simulado }) => simulado.subjectId === 'sequences').length === 1);
}
