import {
  AV2_MONEY_ACTIVITY_ID,
  AV2_SHOPPING_ACTIVITY_ID,
  createAv2Round,
  createAv2ShoppingRound,
  validateAv2Answer,
  validateAv2MoneyQuestionCandidate,
} from './money.js';
import {
  AV2_MONEY_COMPOSITION_ACTIVITY_ID,
  createAv2MoneyCompositionRound,
  validateAv2MoneyCompositionChallenge,
  validateAv2MoneyCompositionSelection,
} from './money-composition.js';
import {
  AV2_ADDITION_ACTIVITY_ID,
  createAv2AdditionRound,
  validateAv2AdditionAnswer,
  validateAv2AdditionQuestionCandidate,
} from './addition.js';
import {
  AV2_SUBTRACTION_ACTIVITY_ID,
  createAv2SubtractionRound,
  validateAv2SubtractionAnswer,
  validateAv2SubtractionQuestionCandidate,
} from './subtraction.js';
import { numberToPortuguese } from '../game.js';

export const AV2_SIMULADO_ACTIVITY_ID = 'av2-simulado-block-07';
export const AV2_SIMULADO_PROGRESS_STORAGE_KEY = 'av2-matematica.block-07.simulado.progress.v1';
export const AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT = 3;
export const AV2_SIMULADO_QUESTION_COUNTS = Object.freeze([1, 2, 3, 4, 5]);
export const AV2_SIMULADO_SUBJECTS = Object.freeze([
  Object.freeze({ id: 'money', label: 'Sistema monetário', description: 'Moedas, cédulas, compras e troco.' }),
  Object.freeze({ id: 'addition', label: 'Adição', description: 'Contas e problemas de adição.' }),
  Object.freeze({ id: 'subtraction', label: 'Subtração', description: 'Contas e problemas de subtração.' }),
  Object.freeze({ id: 'sequences', label: 'Sequências', description: 'Complete sequências que aumentam de um em um.' }),
  Object.freeze({ id: 'words', label: 'Números por extenso', description: 'Relacione números e suas escritas.' }),
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
      contextual: question.type === 'context' || question.type.startsWith('shopping-'),
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
  const selected = shuffled([value, ...distractorValues].slice(0, 4), random);
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

function createTwoStepLibraryQuestion() {
  const step1 = { operation: 'addition', a: 156, b: 195, result: 351, subjectId: 'addition', options: [351, 341, 361, 251] };
  const step2 = { operation: 'subtraction', a: step1.result, b: 147, result: 204, subjectId: 'subtraction', options: [204, 214, 194, 304] };
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
      intermediate: step1.result,
      finalAmount: step2.result,
      steps: [step1, step2],
    },
    correctAnswer: step2.result,
    options: step2.options,
    prompt: 'A biblioteca tinha 156 livros e recebeu mais 195. Depois, 147 livros foram retirados. Quantos livros havia após a doação e quantos restaram?',
    speech: 'A biblioteca tinha 156 livros e recebeu mais 195. Depois, 147 livros foram retirados. Quantos livros havia após a doação e quantos restaram?',
    explanation: 'Primeiro, 156 mais 195 são 351 livros. Depois, 351 menos 147 são 204 livros. Os 351 da primeira etapa são usados na segunda operação.',
    hint: 'Na primeira etapa, some os livros que havia aos livros recebidos. Na segunda, use esse resultado e retire 147.',
    feedback: { correct: 'Muito bem! Você resolveu as duas etapas usando o resultado intermediário.', retry: 'Resolva uma etapa de cada vez e confira a resposta anterior.' },
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
      .filter((challenge) => challenge.requiredDistinctSolutions === 1);
    const compositionQuestion = attachSubject(
      compositionChallenges[randomIndex(compositionChallenges.length, random)],
      'money',
    );
    const candidates = [
      ...moneyQuestions.map((question) => attachSubject(question, 'money')),
      ...shoppingQuestions.map((question) => attachSubject(question, 'money')),
    ];
    const affordability = candidates.find(({ type }) => type === 'shopping-affordability');
    const selected = affordability && count > 0 ? [affordability] : [];
    if (count > 1) selected.push(compositionQuestion);
    const remaining = shuffled(candidates.filter((question) => !selected.includes(question)), random);
    for (const candidate of remaining) {
      if (selected.length >= count) break;
      if (!selected.some(({ questionId }) => questionId === candidate.questionId)) selected.push(candidate);
    }
    return selected;
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
    return shuffled(patterns, random).slice(0, count).map(([start, missingIndex]) => createSequenceQuestion(random, start, missingIndex));
  }
  if (subjectId === 'words') {
    const selected = count > 0 ? [createAssociationQuestion(random)] : [];
    const wordCases = [];
    for (let value = 200; value <= 250; value += 1) {
      wordCases.push([value, 'number-to-word'], [value, 'word-to-number']);
    }
    wordCases.push([300, 'number-to-word'], [400, 'number-to-word']);
    for (const [value, mode] of shuffled(wordCases, random)) {
      if (selected.length >= count) break;
      selected.push(createWordQuestion(random, value, mode));
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

function validateTwoStepQuestion(question) {
  const data = question.data;
  const [first, second] = data?.steps ?? [];
  return typeof question.prompt === 'string' && data?.context === 'biblioteca'
    && data.initialAmount === 156 && data.donatedAmount === 195
    && data.removedAmount === 147 && data.intermediate === 351 && data.finalAmount === 204
    && first?.operation === 'addition' && first.subjectId === 'addition' && first.a === data.initialAmount
    && first.b === data.donatedAmount && first.result === first.a + first.b && first.result === data.intermediate
    && second?.operation === 'subtraction' && second.subjectId === 'subtraction' && second.a === first.result
    && second.b === data.removedAmount && second.result === second.a - second.b && second.result === data.finalAmount
    && first.options?.length === 4 && new Set(first.options).size === 4 && first.options.filter((value) => value === first.result).length === 1
    && first.options.every((value) => Number.isInteger(value) && value >= 0 && value <= 999)
    && second.options?.length === 4 && new Set(second.options).size === 4 && second.options.filter((value) => value === second.result).length === 1
    && second.options.every((value) => Number.isInteger(value) && value >= 0 && value <= 999)
    && JSON.stringify(question.options) === JSON.stringify(second.options)
    && question.correctAnswer === second.result
    && question.prompt.includes('156') && question.prompt.includes('195') && question.prompt.includes('147');
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
  if (question.type === 'simulado-sequence' || question.type === 'simulado-word') {
    const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
    const offered = question.options.some((option) => typeof option === 'object' ? option.value === normalized : option === normalized);
    return normalized === question.correctAnswer && offered;
  }
  if (question.type === 'simulado-association') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
    const { pairs } = question.data;
    const selectedWords = pairs.map(({ value }) => answer[String(value)]);
    return Object.keys(answer).length === pairs.length
      && pairs.every(({ value, word }) => answer[String(value)] === word)
      && new Set(selectedWords).size === pairs.length;
  }
  if (question.type === 'simulado-two-step') {
    const step = question.data.steps[stage - 1];
    if (!step) return false;
    const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
    return normalized === step.result && step.options.filter((option) => option === step.result).length === 1;
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
  if (includesTwoStep) questions.push(createTwoStepLibraryQuestion());

  const round = shuffled(questions, random);
  if (!validateAv2SimuladoRound(round, normalizedCounts)) throw new TypeError('A rodada viola o contrato do Simulado AV2.');
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
      const question = candidates.find((candidate) => !used.has(candidate.simulado.questionId)
        && candidate.simulado.questionId !== target.sourceQuestionId);
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
