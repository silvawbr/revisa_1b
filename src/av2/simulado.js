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
import {
  createNumberTableQuestion,
  createNumberToWordQuestion,
  createRecognitionQuestion,
  NUMBER_WORD_VALUES,
  numberToWordsPtBr,
  validateAv2SequencesQuestion,
  validateNumberTable,
} from './sequences.js';
import { validateAv2AnswerMode, withAv2AnswerMode } from './interaction-contract.js';
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
  Object.freeze({ id: 'words', label: 'Números por extenso', description: 'Leia números e escolha sua escrita ou seu correspondente.' }),
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
    ...withAv2AnswerMode(question),
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

export function createAv2SimuladoWordQuestion({ value = null, mode = null, random = Math.random, questionId = null } = {}) {
  const resolvedMode = mode ?? (randomIndex(2, random) === 0 ? 'number-to-word' : 'word-to-number');
  const resolvedValue = value ?? (resolvedMode === 'number-to-word' && randomIndex(8, random) === 0
    ? (randomIndex(2, random) === 0 ? 300 : 400)
    : 200 + randomIndex(51, random));
  const isAllowedValue = Number.isInteger(resolvedValue) && ((resolvedValue >= 200 && resolvedValue <= 250)
    || (resolvedMode === 'number-to-word' && [300, 400].includes(resolvedValue)));
  if (!isAllowedValue || !['number-to-word', 'word-to-number'].includes(resolvedMode)) {
    throw new RangeError('Número ou direção fora do domínio de números por extenso do Simulado AV2.');
  }

  const source = resolvedMode === 'number-to-word'
    ? createNumberToWordQuestion(random, { value: resolvedValue })
    : createRecognitionQuestion(random, { value: resolvedValue });
  if (!validateAv2SequencesQuestion(source)) {
    throw new TypeError('A questão de números por extenso do Block 05 não passou pelo contrato de alternativas.');
  }

  const options = source.options.map((optionValue, index) => ({
    value: optionValue,
    label: resolvedMode === 'number-to-word' ? source.optionLabels[index] : String(optionValue),
  }));
  const word = numberToWordsPtBr(resolvedValue);
  const prompt = resolvedMode === 'number-to-word'
    ? source.prompt
    : `Qual número corresponde a “${word}”?`;
  const speech = resolvedMode === 'number-to-word'
    ? source.speech
    : `Qual número corresponde à escrita ${word}?`;
  const candidate = attachSubject({
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_WORDS',
    questionId: questionId ?? `word-${resolvedMode}-${resolvedValue}`,
    type: 'simulado-word',
    data: { value: resolvedValue, mode: resolvedMode, options },
    correctAnswer: resolvedValue,
    options,
    prompt,
    speech,
    explanation: `${word} corresponde ao número ${resolvedValue}.`,
    hint: source.hint,
    feedback: { correct: 'Muito bem! Você encontrou a resposta correta.', retry: 'Leia as alternativas com atenção e tente outra vez.' },
  }, 'words');
  if (!validateAv2SimuladoQuestionCandidate(candidate)) {
    throw new TypeError('A questão de números por extenso do Simulado AV2 não passou pela validação.');
  }
  return candidate;
}

function createWordQuestion(random, requestedValue = null, requestedMode = null) {
  return createAv2SimuladoWordQuestion({ value: requestedValue, mode: requestedMode, random });
}

export function upgradeLegacyAv2SimuladoQuestion(question, random = Math.random) {
  if (question?.type !== 'simulado-word-write') {
    return validateAv2SimuladoQuestionCandidate(question) ? question : null;
  }
  const value = question.data?.value;
  if (!NUMBER_WORD_VALUES.includes(value)
    || !((value >= 200 && value <= 250) || [300, 400].includes(value))) return null;
  const legacyQuestionId = String(question.simulado?.questionId ?? question.questionId ?? `legacy-word-${value}`);
  const replacement = createAv2SimuladoWordQuestion({
    value,
    mode: 'number-to-word',
    random,
    questionId: String(question.questionId ?? `word-number-to-word-${value}`),
  });
  return freezeDeep({
    ...replacement,
    simulado: {
      ...replacement.simulado,
      questionId: legacyQuestionId,
      ...(question.simulado?.reviewTargetKey ? { reviewTargetKey: question.simulado.reviewTargetKey } : {}),
    },
  });
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

const OFFICIAL_TOY_PRODUCTS = Object.freeze([
  Object.freeze({ id: 'teddy-bear', label: 'Urso', article: 'o', illustrationId: 'teddy-bear' }),
  Object.freeze({ id: 'truck', label: 'Caminhão', article: 'o', illustrationId: 'truck' }),
  Object.freeze({ id: 'blocks', label: 'Blocos', article: 'os', illustrationId: 'building-blocks' }),
  Object.freeze({ id: 'dinosaur', label: 'Dinossauro', article: 'o', illustrationId: 'dinosaur' }),
  Object.freeze({ id: 'ball', label: 'Bola', article: 'a', illustrationId: 'ball' }),
  Object.freeze({ id: 'doll', label: 'Boneca', article: 'a', illustrationId: 'doll' }),
  Object.freeze({ id: 'toy-car', label: 'Carrinho', article: 'o', illustrationId: 'toy-car' }),
  Object.freeze({ id: 'board-game', label: 'Jogo', article: 'o', illustrationId: 'board-game' }),
  Object.freeze({ id: 'toy', label: 'Brinquedo', article: 'o', illustrationId: 'toy' }),
]);

const SCHOOL_SUPPLIES = Object.freeze([
  Object.freeze({ id: 'eraser', label: 'Borracha', article: 'a', illustrationId: 'eraser' }),
  Object.freeze({ id: 'pencil', label: 'Lápis', article: 'o', illustrationId: 'pencil' }),
  Object.freeze({ id: 'glue', label: 'Cola', article: 'a', illustrationId: 'glue' }),
  Object.freeze({ id: 'scissors', label: 'Tesoura', article: 'a', illustrationId: 'scissors' }),
  Object.freeze({ id: 'notebook', label: 'Caderno', article: 'o', illustrationId: 'notebook' }),
  Object.freeze({ id: 'book', label: 'Livro', article: 'o', illustrationId: 'book' }),
  Object.freeze({ id: 'ruler', label: 'Régua', article: 'a', illustrationId: 'ruler' }),
  Object.freeze({ id: 'crayon', label: 'Giz de cera', article: 'o', illustrationId: 'crayon' }),
]);

const SCENARIO_CASH_OPTIONS = Object.freeze([
  Object.freeze({ totalReais: 20, denominationIds: ['note-10-reais', 'note-5-reais', 'note-5-reais'] }),
  Object.freeze({ totalReais: 25, denominationIds: ['note-20-reais', 'note-5-reais'] }),
  Object.freeze({ totalReais: 25, denominationIds: ['note-10-reais', 'note-5-reais', 'note-5-reais', 'note-5-reais'] }),
  Object.freeze({ totalReais: 30, denominationIds: ['note-10-reais', 'note-10-reais', 'note-10-reais'] }),
  Object.freeze({ totalReais: 30, denominationIds: ['note-20-reais', 'note-5-reais', 'note-5-reais'] }),
  Object.freeze({ totalReais: 35, denominationIds: ['note-20-reais', 'note-10-reais', 'note-5-reais'] }),
  Object.freeze({ totalReais: 40, denominationIds: ['note-20-reais', 'note-20-reais'] }),
]);

function createOfficialMoneyProductMatchingQuestion(random) {
  const pairOptions = [
    ['note-2-reais', 'note-2-reais'], ['note-2-reais', 'note-5-reais'],
    ['note-2-reais', 'note-10-reais'], ['note-2-reais', 'note-20-reais'],
    ['note-5-reais', 'note-5-reais'], ['note-5-reais', 'note-10-reais'],
    ['note-5-reais', 'note-20-reais'], ['note-10-reais', 'note-10-reais'],
    ['note-10-reais', 'note-20-reais'], ['note-20-reais', 'note-20-reais'],
  ];
  const pairs = shuffled(pairOptions, random).slice(0, 4).map((denominationIds) => ({
    denominationIds,
    totalCents: denominationIds.reduce((sum, id) => sum + moneyValue(id), 0),
  }));
  const products = shuffled(OFFICIAL_TOY_PRODUCTS, random).slice(0, 4).map((product, index) => ({
    ...product,
    id: `${product.id}-${pairs[index].totalCents / 100}`,
    priceReais: pairs[index].totalCents / 100,
  }));
  const groups = shuffled(pairs.map((pair, index) => ({
    id: `group-${pair.totalCents / 100}`,
    denominationIds: pair.denominationIds,
    totalCents: pair.totalCents,
    matchingProductId: products.find(({ priceReais }) => priceReais * 100 === pair.totalCents)?.id,
  })), random);
  const correctMatches = Object.fromEntries(groups.map(({ id, matchingProductId }) => [id, matchingProductId]));
  const question = {
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'BANKNOTE_PRODUCT_MATCHING',
    questionId: `banknote-product-matching-${groups.map(({ id }) => id).join('-')}-${products.map(({ id }) => id).join('-')}`,
    type: 'simulado-money-product-match',
    data: { groups: groups.map(({ id, denominationIds, totalCents }) => ({ id, denominationIds, totalCents })), products, correctMatches },
    correctAnswer: correctMatches,
    options: products.map(({ id }) => id),
    prompt: 'Associe cada grupo de cédulas ao brinquedo com o mesmo preço.',
    speech: 'Associe cada grupo de cédulas ao brinquedo com o mesmo preço.',
    explanation: 'Cada grupo de cédulas forma o preço de um brinquedo.',
    hint: 'Some as cédulas de cada grupo e compare com os preços dos brinquedos.',
    feedback: { correct: 'Muito bem! Você encontrou todos os preços correspondentes.', retry: 'Confira os grupos destacados e tente outra vez.' },
  };
  return attachSubject(question, 'money');
}

function createOfficialEquivalenceQuestion(random) {
  const options = [
    { targetDenominationId: 'note-2-reais', denominationIds: ['coin-1-real', 'coin-1-real'] },
    { targetDenominationId: 'note-2-reais', denominationIds: ['coin-1-real', 'coin-50-centavos', 'coin-50-centavos'] },
    { targetDenominationId: 'note-2-reais', denominationIds: ['coin-1-real', 'coin-25-centavos', 'coin-25-centavos', 'coin-50-centavos'] },
    { targetDenominationId: 'note-5-reais', denominationIds: Array(5).fill('coin-1-real') },
    { targetDenominationId: 'note-5-reais', denominationIds: ['coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-1-real', 'coin-50-centavos', 'coin-50-centavos'] },
    { targetDenominationId: 'note-10-reais', denominationIds: Array(10).fill('coin-1-real') },
  ];
  return createCurrencyEquivalenceQuestion({ ...shuffled(options, random)[0], random });
}

function moneyValue(id) {
  return MONEY_DENOMINATIONS.find(({ id: denominationId }) => denominationId === id)?.valueCents ?? Number.NaN;
}

function getAffordableToyPairs(products, availableReais) {
  const pairs = [];
  for (let firstIndex = 0; firstIndex < products.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < products.length; secondIndex += 1) {
      const pair = [products[firstIndex], products[secondIndex]];
      const total = pair.reduce((sum, product) => sum + product.priceReais, 0);
      if (total <= availableReais) pairs.push({ products: pair, total });
    }
  }
  return pairs;
}

function createShoppingToyPrices(availableReais, random) {
  const minimumFirstPrice = Math.ceil(availableReais / 3);
  const maximumFirstPrice = Math.floor((availableReais - 3) / 2);
  const firstPrice = minimumFirstPrice + randomIndex(maximumFirstPrice - minimumFirstPrice + 1, random);
  const maximumSlack = Math.min(5, availableReais - (2 * firstPrice) - 1);
  const slack = 1 + randomIndex(maximumSlack, random);
  const secondPrice = availableReais - firstPrice - slack;
  const minimumOtherPrice = availableReais - firstPrice + 1;
  const otherPrices = shuffled(Array.from(
    { length: 48 - minimumOtherPrice },
    (_, index) => minimumOtherPrice + index,
  ), random).slice(0, 2);
  return shuffled([firstPrice, secondPrice, ...otherPrices], random);
}

function createOfficialShoppingScenarioQuestions(random) {
  const cash = shuffled(SCENARIO_CASH_OPTIONS, random)[0];
  const availableReais = cash.totalReais;
  const availableCents = availableReais * 100;
  const prices = createShoppingToyPrices(availableReais, random);
  const products = shuffled(OFFICIAL_TOY_PRODUCTS, random).slice(0, 4).map((product, index) => ({
    ...product,
    id: `${product.id}-${prices[index]}`,
    priceReais: prices[index],
  }));
  const affordablePairs = getAffordableToyPairs(products, availableReais);
  if (affordablePairs.length !== 1) throw new Error('O cenário deve ter um único conjunto de dois brinquedos que caiba no orçamento.');
  const bundle = affordablePairs[0];
  const bundleProductIds = bundle.products.map(({ id }) => id);
  const bundlePriceReais = bundle.total;
  const scenarioId = `rael-${availableReais}-${products.map(({ id }) => id).join('-')}`;
  const baseData = {
    scenarioId,
    moneyDenominationIds: [...cash.denominationIds],
    products,
    availableCents,
    availableReais,
    purchaseUnit: 'two-toy-set',
    bundleProductIds,
    bundlePriceReais,
  };
  const common = {
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'CONNECTED_SHOPPING_SCENARIO',
    hint: 'Observe o dinheiro de Rael e compare os valores com calma.',
  };
  const questions = [
    {
      ...common, questionId: `${scenarioId}-money-total`, type: 'simulado-shopping-total',
      data: { ...baseData, task: 'available-total' }, correctAnswer: availableReais,
      prompt: 'Quanto dinheiro Rael tem ao todo?',
      explanation: `O dinheiro de Rael soma ${availableReais} reais.`,
    },
    {
      ...common, questionId: `${scenarioId}-affordability`, type: 'simulado-shopping-affordability',
      data: { ...baseData, task: 'affordability', availableReais },
      correctAnswers: bundleProductIds,
      options: products.map(({ id }) => id),
      prompt: 'Marque os dois brinquedos que Rael pode comprar juntos com o dinheiro que juntou.',
      explanation: `Os dois brinquedos do conjunto custam ${bundlePriceReais} reais ao todo, dentro dos ${availableReais} reais de Rael.`,
      hint: 'Some os preços dos dois brinquedos escolhidos e compare o total com o dinheiro de Rael.',
    },
    {
      ...common, questionId: `${scenarioId}-change`, type: 'simulado-shopping-change',
      data: { ...baseData, task: 'change', availableReais },
      correctAnswer: availableReais - bundlePriceReais,
      prompt: `Rael comprou ${joinProductNames(bundle.products)} juntos por ${bundlePriceReais} reais. Quanto recebeu de troco?`,
      explanation: `O conjunto custou ${bundlePriceReais} reais. ${availableReais} reais menos ${bundlePriceReais} reais são ${availableReais - bundlePriceReais} reais de troco.`,
      hint: 'Some o preço dos dois brinquedos. Depois subtraia esse total do dinheiro de Rael.',
    },
  ];
  return questions.map((question) => attachSubject({
    ...question,
    speech: `Rael está escolhendo brinquedos. ${question.prompt}`,
    feedback: {
      correct: question.type === 'simulado-shopping-affordability'
        ? 'Muito bem! Você encontrou o conjunto que cabe no dinheiro de Rael.'
        : 'Muito bem! Você resolveu esta parte da compra.',
      retry: question.type === 'simulado-shopping-affordability'
        ? 'Some os preços dos dois brinquedos e compare o total com o dinheiro de Rael.'
        : 'Observe o dinheiro e os preços. Tente novamente.',
    },
  }, 'money'));
}

function joinProductNames(products) {
  const names = products.map(({ article, label }) => `${article} ${label.toLocaleLowerCase('pt-BR')}`);
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

function createOfficialProductBoardQuestions(random) {
  const priceValues = shuffled(Array.from({ length: 19 }, (_, index) => index + 2), random).slice(0, 5);
  const products = shuffled(SCHOOL_SUPPLIES, random).slice(0, 5).map((product, index) => ({
    ...product,
    priceReais: priceValues[index],
  }));
  const boardId = `school-supplies-${products.map(({ id, priceReais }) => `${id}-${priceReais}`).join('-')}`;
  const answerOptions = products.map(({ id, label }) => ({ value: id, label }));
  const cheapest = [...products].sort((left, right) => left.priceReais - right.priceReais)[0];
  const mostExpensive = [...products].sort((left, right) => right.priceReais - left.priceReais)[0];
  const triple = shuffled(products, random).slice(0, 3);
  const pair = shuffled(products, random).slice(0, 2);
  const tasks = [
    { id: 'cheapest', prompt: 'Qual item é o mais barato?', correctAnswer: cheapest.id, mode: 'choice' },
    { id: 'most-expensive', prompt: 'Qual item é o mais caro?', correctAnswer: mostExpensive.id, mode: 'choice' },
    { id: 'pencil-eraser-scissors', prompt: `Quanto custam juntos ${joinProductNames(triple)}?`, productIds: triple.map(({ id }) => id), mode: 'number' },
    { id: 'notebook-glue', prompt: `Quanto custam juntos ${joinProductNames(pair)}?`, productIds: pair.map(({ id }) => id), mode: 'number' },
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
      questionId: `${boardId}-${task.id}`, type: 'simulado-product-board',
      data: { boardId, products, taskId: task.id, productIds: task.productIds ?? [] },
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
  const start = 200 + randomIndex(12, random);
  const base = createNumberTableQuestion(random, { start, length: 40, columns: 10, blankCount: 40 });
  const givenIndexes = new Set([0, 5, 10, 19, 20, 25, 30, 38]);
  const gaps = base.gaps.filter((index) => !givenIndexes.has(index)).slice(0, 12);
  gaps.sort((left, right) => left - right);
  const table = { ...base, gaps, answers: gaps.map((index) => base.values[index]) };
  return attachSubject({
    revisionId: 'av2-matematica', activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'NUMBER_TABLE_COMPLETION', questionId: `full-coverage-number-table-${start}-${gaps.join('-')}`,
    type: 'simulado-number-table', data: { table },
    prompt: 'Complete os espaços vazios da tabela.',
    speech: 'Complete a tabela crescente, contando de um em um.',
    explanation: 'A tabela segue a contagem de um em um, da esquerda para a direita e de cima para baixo.',
    hint: 'Leia cada linha da esquerda para a direita. Depois continue na linha seguinte.',
    feedback: { correct: 'Muito bem! Você completou a tabela.', retry: 'Confira a ordem dos números e tente novamente.' },
  }, 'sequences');
}

function createTwoStepLibraryQuestion(random = Math.random, { varied = false } = {}) {
  let initialAmount = 156;
  let donatedAmount = 195;
  let removedAmount = 147;
  let additionQuestion;
  let subtractionQuestion;

  if (varied) {
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const initial = 100 + randomIndex(400, random);
      const donation = 100 + randomIndex(500, random);
      const intermediate = initial + donation;
      if (intermediate > 999) continue;

      const maximumRemoval = intermediate - 100;
      if (maximumRemoval < 100) continue;
      const removed = 100 + randomIndex(maximumRemoval - 99, random);

      try {
        const addition = createAv2AdditionQuestionForOperands({ a: initial, b: donation, random });
        if (!addition.data.trace.carries.toTens && !addition.data.trace.carries.toHundreds) continue;
        const subtraction = createSubtractionQuestion({ a: intermediate, b: removed, random });
        if (!subtraction.data.trace.events.length) continue;
        initialAmount = initial;
        donatedAmount = donation;
        removedAmount = removed;
        additionQuestion = addition;
        subtractionQuestion = subtraction;
        break;
      } catch {
        // Keep sampling if a candidate falls outside the subtraction contract.
      }
    }
  }

  const intermediate = initialAmount + donatedAmount;
  const finalAmount = intermediate - removedAmount;
  additionQuestion ??= createAv2AdditionQuestionForOperands({ a: initialAmount, b: donatedAmount, random });
  subtractionQuestion ??= createSubtractionQuestion({ a: intermediate, b: removedAmount, random });
  const steps = [
    { kind: 'operation', operation: 'addition', subjectId: 'addition', question: additionQuestion, result: intermediate },
    { kind: 'terms', operation: 'addition', subjectId: 'addition', question: additionQuestion,
      expectedRoles: { a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' } },
    { kind: 'operation', operation: 'subtraction', subjectId: 'subtraction', question: subtractionQuestion, result: finalAmount },
    { kind: 'terms', operation: 'subtraction', subjectId: 'subtraction', question: subtractionQuestion,
      expectedRoles: { a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' } },
  ];
  return freezeDeep({
    revisionId: 'av2-matematica',
    activityId: AV2_SIMULADO_ACTIVITY_ID,
    pedagogicalCategory: 'CONTEXTUAL_TWO_STEP_PROBLEM',
    questionId: `two-step-library-${initialAmount}-${donatedAmount}-${removedAmount}`,
    type: 'simulado-two-step',
    answerMode: 'composite',
    data: {
      context: 'biblioteca',
      item: 'livros',
      initialAmount,
      donatedAmount,
      removedAmount,
      intermediate,
      finalAmount,
      steps,
    },
    correctAnswer: finalAmount,
    options: [],
    prompt: `A biblioteca tinha ${initialAmount} livros e recebeu mais ${donatedAmount}. Depois, ${removedAmount} livros foram retirados. Resolva uma etapa de cada vez.`,
    speech: `A biblioteca tinha ${initialAmount} livros e recebeu mais ${donatedAmount}. Depois, ${removedAmount} livros foram retirados. Resolva uma etapa de cada vez.`,
    explanation: `A 1ª parcela é ${initialAmount}, a 2ª parcela é ${donatedAmount} e a soma é ${intermediate}. Depois, ${intermediate} é o minuendo, ${removedAmount} é o subtraendo e ${finalAmount} é o resto ou diferença.`,
    hint: 'Alinhe centenas, dezenas e unidades. Resolva a adição antes de começar a subtração.',
    feedback: { correct: 'Muito bem! Você resolveu as duas operações e identificou seus termos.', retry: 'Resolva uma etapa de cada vez e confira os nomes dos termos.' },
    simulado: {
      questionId: `two-step-library-${initialAmount}-${donatedAmount}-${removedAmount}`,
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
    const selected = count > 1 ? [createAssociationQuestion(random)] : [];
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
  const word = numberToPortuguese(value);
  return options.length === 4
    && new Set(options.map(({ value: optionValue }) => optionValue)).size === 4
    && new Set(options.map(({ label }) => label)).size === 4
    && options.filter(({ value: optionValue }) => optionValue === value).length === 1
    && options.every(({ value: optionValue, label }) => Number.isInteger(optionValue)
      && (optionValue >= 0 && optionValue <= 250 || [300, 400].includes(optionValue) && mode === 'number-to-word')
      && typeof label === 'string' && label === (mode === 'number-to-word' ? numberToPortuguese(optionValue) : String(optionValue)))
    && question.correctAnswer === value
    && question.answerMode === 'single-choice'
    && question.prompt === (mode === 'number-to-word' ? `Como se escreve o número ${value} por extenso?` : `Qual número corresponde a “${word}”?`)
    && question.speech === (mode === 'number-to-word' ? `Observe o número ${value} e escolha como ele é escrito.` : `Qual número corresponde à escrita ${word}?`)
    && (mode !== 'number-to-word' || (!question.speech.includes(word) && !question.hint.includes(word)));
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
  const {
    scenarioId, moneyDenominationIds, products, task, availableCents, availableReais,
    purchaseUnit, bundleProductIds, bundlePriceReais,
  } = question.data ?? {};
  if (!Number.isInteger(availableCents) || availableCents <= 0 || availableCents % 100 !== 0
    || availableReais * 100 !== availableCents || !Array.isArray(moneyDenominationIds) || moneyDenominationIds.length < 2
    || moneyDenominationIds.some((id) => !MONEY_DENOMINATIONS.some((money) => money.id === id && money.kind === 'note'))
    || moneyDenominationIds.reduce((sum, id) => sum + moneyValue(id), 0) !== availableCents
    || !Array.isArray(products) || products.length !== 4
    || new Set(products.map(({ id }) => id)).size !== products.length
    || new Set(products.map(({ priceReais }) => priceReais)).size !== products.length
    || products.some((product) => {
      const prototype = OFFICIAL_TOY_PRODUCTS.find(({ id }) => product.id?.startsWith(`${id}-`));
      return !prototype || product.id !== `${prototype.id}-${product.priceReais}`
        || product.label !== prototype.label || product.article !== prototype.article
        || product.illustrationId !== prototype.illustrationId
        || !Number.isInteger(product.priceReais) || product.priceReais < 1 || product.priceReais > 47;
    })) return false;
  const affordablePairs = getAffordableToyPairs(products, availableReais);
  const bundleProducts = products.filter(({ id }) => Array.isArray(bundleProductIds) && bundleProductIds.includes(id));
  const expectedBundleIds = affordablePairs[0]?.products.map(({ id }) => id) ?? [];
  if (purchaseUnit !== 'two-toy-set' || !Array.isArray(bundleProductIds) || bundleProductIds.length !== 2
    || new Set(bundleProductIds).size !== 2 || bundleProducts.length !== 2
    || affordablePairs.length !== 1 || bundlePriceReais !== affordablePairs[0].total
    || JSON.stringify([...bundleProductIds].sort()) !== JSON.stringify([...expectedBundleIds].sort())) return false;
  const expectedScenarioId = `rael-${availableReais}-${products.map(({ id }) => id).join('-')}`;
  if (scenarioId !== expectedScenarioId || question.speech !== `Rael está escolhendo brinquedos. ${question.prompt}`) return false;
  if (question.type === 'simulado-shopping-total') return task === 'available-total'
    && question.correctAnswer * 100 === availableCents && question.prompt === 'Quanto dinheiro Rael tem ao todo?'
    && question.explanation === `O dinheiro de Rael soma ${availableReais} reais.`;
  if (question.type === 'simulado-shopping-affordability') return task === 'affordability'
    && availableReais * 100 === availableCents && Array.isArray(question.correctAnswers)
    && JSON.stringify([...question.correctAnswers].sort()) === JSON.stringify([...bundleProductIds].sort())
    && JSON.stringify([...question.options].sort()) === JSON.stringify(products.map(({ id }) => id).sort())
    && question.prompt === 'Marque os dois brinquedos que Rael pode comprar juntos com o dinheiro que juntou.'
    && question.explanation === `Os dois brinquedos do conjunto custam ${bundlePriceReais} reais ao todo, dentro dos ${availableReais} reais de Rael.`
    && question.hint === 'Some os preços dos dois brinquedos escolhidos e compare o total com o dinheiro de Rael.';
  if (question.type === 'simulado-shopping-change') {
    return task === 'change' && bundlePriceReais < availableReais
      && question.correctAnswer === availableReais - bundlePriceReais
      && question.prompt === `Rael comprou ${joinProductNames(bundleProducts)} juntos por ${bundlePriceReais} reais. Quanto recebeu de troco?`
      && question.explanation === `O conjunto custou ${bundlePriceReais} reais. ${availableReais} reais menos ${bundlePriceReais} reais são ${question.correctAnswer} reais de troco.`
      && question.hint === 'Some o preço dos dois brinquedos. Depois subtraia esse total do dinheiro de Rael.';
  }
  return false;
}

function validateProductBoardQuestion(question) {
  const { boardId, products, taskId, productIds } = question.data ?? {};
  if (!Array.isArray(products) || products.length !== 5 || !Array.isArray(productIds)
    || new Set(products.map(({ id }) => id)).size !== products.length
    || new Set(products.map(({ priceReais }) => priceReais)).size !== products.length
    || products.some((product) => {
      const prototype = SCHOOL_SUPPLIES.find(({ id }) => id === product.id);
      return !prototype || product.label !== prototype.label || product.article !== prototype.article
        || product.illustrationId !== prototype.illustrationId
        || !Number.isInteger(product.priceReais) || product.priceReais < 2 || product.priceReais > 20;
    }) || boardId !== `school-supplies-${products.map(({ id, priceReais }) => `${id}-${priceReais}`).join('-')}`) return false;
  if (taskId === 'cheapest' || taskId === 'most-expensive') {
    const ordered = [...products].sort((a, b) => taskId === 'cheapest' ? a.priceReais - b.priceReais : b.priceReais - a.priceReais);
    const expectedExplanation = `${ordered[0].label} é o item ${taskId === 'cheapest' ? 'mais barato' : 'mais caro'}.`;
    return ordered[0].priceReais !== ordered[1].priceReais
      && question.correctAnswer === ordered[0].id
      && JSON.stringify(question.options) === JSON.stringify(products.map(({ id, label }) => ({ value: id, label })))
      && question.prompt === (taskId === 'cheapest' ? 'Qual item é o mais barato?' : 'Qual item é o mais caro?')
      && question.explanation === expectedExplanation;
  }
  const expectedCount = taskId === 'pencil-eraser-scissors' ? 3 : taskId === 'notebook-glue' ? 2 : 0;
  if (!expectedCount || productIds.length !== expectedCount || new Set(productIds).size !== expectedCount
    || productIds.some((id) => !products.some((product) => product.id === id)) || question.options.length !== 0) return false;
  const selected = productIds.map((id) => products.find((product) => product.id === id));
  const totalCents = selected.reduce((sum, product) => sum + product.priceReais * 100, 0);
  return question.correctAnswer * 100 === totalCents
    && question.prompt === `Quanto custam juntos ${joinProductNames(selected)}?`
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
  if (question.questionId.startsWith('full-coverage-number-table-')) {
    return table.values[0] >= 200 && table.values[0] <= 211 && table.values.length === 40 && table.columns === 10
      && table.gaps.length === 12
      && [0, 5, 10, 19, 20, 25, 30, 38].every((index) => !table.gaps.includes(index))
      && question.speech === 'Complete a tabela crescente, contando de um em um.';
  }
  return question.prompt === 'Complete os espaços vazios da tabela.';
}

function validateTwoStepQuestion(question) {
  const data = question.data;
  const [addition, additionTerms, subtraction, subtractionTerms] = data?.steps ?? [];
  const addQuestion = addition?.question;
  const subtractQuestion = subtraction?.question;
  return data?.steps?.length === 4 && typeof question.prompt === 'string' && data?.context === 'biblioteca'
    && [data.initialAmount, data.donatedAmount, data.removedAmount, data.intermediate, data.finalAmount]
      .every((value) => Number.isInteger(value) && value >= 100 && value <= 999)
    && data.intermediate === data.initialAmount + data.donatedAmount
    && data.finalAmount === data.intermediate - data.removedAmount
    && data.finalAmount >= 100
    && addition?.kind === 'operation' && addition.operation === 'addition' && addition.subjectId === 'addition'
    && validateAv2AdditionQuestionCandidate(addQuestion)
    && addQuestion.data.a === data.initialAmount && addQuestion.data.b === data.donatedAmount
    && addQuestion.data.result === data.intermediate && addition.result === data.intermediate
    && (addQuestion.data.trace.carries.toTens > 0 || addQuestion.data.trace.carries.toHundreds > 0)
    && additionTerms?.kind === 'terms' && additionTerms.question?.questionId === addQuestion.questionId
    && JSON.stringify(additionTerms.expectedRoles) === JSON.stringify({ a: '1ª parcela', b: '2ª parcela', result: 'soma ou total' })
    && subtraction?.kind === 'operation' && subtraction.operation === 'subtraction' && subtraction.subjectId === 'subtraction'
    && validateAv2SubtractionQuestionCandidate(subtractQuestion)
    && subtractQuestion.data.a === addQuestion.data.result && subtractQuestion.data.b === data.removedAmount
    && subtractQuestion.data.result === data.finalAmount && subtraction.result === data.finalAmount
    && subtractQuestion.data.trace.events.length > 0
    && subtractionTerms?.kind === 'terms' && subtractionTerms.question?.questionId === subtractQuestion.questionId
    && JSON.stringify(subtractionTerms.expectedRoles) === JSON.stringify({ a: 'minuendo', b: 'subtraendo', result: 'resto ou diferença' })
    && question.correctAnswer === data.finalAmount
    && question.questionId === `two-step-library-${data.initialAmount}-${data.donatedAmount}-${data.removedAmount}`
    && question.prompt === `A biblioteca tinha ${data.initialAmount} livros e recebeu mais ${data.donatedAmount}. Depois, ${data.removedAmount} livros foram retirados. Resolva uma etapa de cada vez.`
    && question.speech === question.prompt;
}

export function validateAv2SimuladoQuestionCandidate(question) {
  if (!validateAv2AnswerMode(question, { requireDeclared: true })
    || question.revisionId !== 'av2-matematica' || !question.simulado
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
  if (includesTwoStep) questions.push(createTwoStepLibraryQuestion(random, { varied: true }));

  const round = shuffled(questions, random);
  if (!validateAv2SimuladoRound(round, normalizedCounts)) {
    const invalid = round.filter((question) => !validateAv2SimuladoQuestionCandidate(question));
    throw new TypeError(`A rodada viola o contrato do Simulado AV2: ${invalid.map(({ type, questionId, simulado }) => `${type}:${questionId}:${simulado?.questionId}`).join(',') || round.map(({ questionId, simulado }) => `${questionId}:${simulado.questionId}`).join(',')}.`);
  }
  return freezeDeep(round);
}

export function createAv2SimuladoFullCoverageRound(random = Math.random) {
  const banknoteMatch = createOfficialEquivalenceQuestion(random);
  const fullTable = createOfficialNumberTableQuestion(random);
  const compositionChallenges = shuffled([
    'equiv-1-from-50', 'equiv-5-from-1', 'equiv-10-from-5', 'equiv-20-from-10',
  ].map((id) => getAv2MoneyCompositionChallenge(id)), random).slice(0, 2);
  const numberToWordValues = shuffled([...Array.from({ length: 51 }, (_, index) => 200 + index), 300, 400], random);
  const wordToNumberValues = shuffled(Array.from({ length: 51 }, (_, index) => 200 + index)
    .filter((value) => value !== numberToWordValues[0]), random);
  const reviewGroups = [
    [attachSubject(banknoteMatch, 'money')],
    [createOfficialMoneyProductMatchingQuestion(random)],
    createOfficialShoppingScenarioQuestions(random),
    compositionChallenges.map((challenge) => attachSubject(challenge, 'money')),
    createOfficialProductBoardQuestions(random),
    [fullTable],
    [
      createWordQuestion(random, numberToWordValues[0], 'number-to-word'),
      createWordQuestion(random, wordToNumberValues[0], 'word-to-number'),
    ],
    [createTwoStepLibraryQuestion(random, { varied: true })],
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
    && ['note-2-reais', 'note-5-reais', 'note-10-reais'].includes(question.data?.targetDenominationId));
  const compositionQuestions = round.filter((question) => question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID);
  const compositionIds = new Set(compositionQuestions.map(({ challengeId }) => challengeId));
  const shoppingTypes = ['simulado-shopping-total', 'simulado-shopping-affordability', 'simulado-shopping-change'];
  const boardTasks = new Set(types('simulado-product-board').map(({ data }) => data.taskId));
  const wordQuestions = types('simulado-word');
  const numberToWordQuestions = wordQuestions.filter(({ data }) => data.mode === 'number-to-word');
  const wordToNumberQuestions = wordQuestions.filter(({ data }) => data.mode === 'word-to-number');
  const table = types('simulado-number-table')[0]?.data.table;
  const library = types('simulado-two-step')[0];
  return Boolean(equivalence && types('simulado-money-product-match').length === 1
    && shoppingTypes.every((type) => types(type).length === 1)
    && compositionQuestions.length === 2 && compositionIds.size === 2
    && compositionQuestions.every(({ pedagogicalCategory }) => pedagogicalCategory === 'COMP-04')
    && boardTasks.size === 4 && ['cheapest', 'most-expensive', 'pencil-eraser-scissors', 'notebook-glue'].every((id) => boardTasks.has(id))
    && types('simulado-number-table').length === 1 && table.values.length === 40 && table.columns === 10 && table.gaps.length === 12
    && wordQuestions.length === 2 && numberToWordQuestions.length === 1 && wordToNumberQuestions.length === 1
    && new Set(wordQuestions.map(({ data }) => data.value)).size === 2
    && library?.data.steps.length === 4
    && round.filter(({ simulado }) => simulado.subjectId === 'money').length === 11
    && round.filter(({ simulado }) => simulado.subjectId === 'words').length === 2
    && round.filter(({ simulado }) => simulado.subjectId === 'sequences').length === 1);
}
