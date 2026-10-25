export const AV2_ALLOWED_ANSWER_MODES = Object.freeze([
  'single-choice',
  'multiple-choice',
  'matching',
  'numeric-input',
  'money-selection',
  'numeric-table',
  'composite',
]);

const ALLOWED_MODE_SET = new Set(AV2_ALLOWED_ANSWER_MODES);

/**
 * Resolve the child's required interaction from a validated question type.
 * Alphabetic input is named only so legacy questions can be rejected clearly.
 */
export function getAv2AnswerMode(question) {
  if (!question || typeof question.type !== 'string') return null;
  if (question.type === 'simulado-word-write') return 'alphabetic-input';

  if (['word', 'flat', 'spatial', 'identification', 'comparison', 'equivalence', 'operation', 'composition',
    'shopping-available-total', 'shopping-change', 'shopping-product-sum', 'shopping-selected-total', 'simulado-sequence', 'simulado-word'].includes(question.type)) {
    return 'single-choice';
  }
  if (['terms'].includes(question.type)) return 'multiple-choice';
  if (['shopping-affordability', 'simulado-shopping-affordability'].includes(question.type)) return 'multiple-choice';
  if (['sequence', 'neighbor', 'addition', 'subtraction', 'context', 'unknown', 'simulado-shopping-total', 'simulado-shopping-change'].includes(question.type)) {
    return 'numeric-input';
  }
  if (question.type === 'number-choice') return ['NUM-05', 'NUM-06'].includes(question.category) ? 'single-choice' : 'numeric-input';
  if (['number-table', 'simulado-number-table'].includes(question.type)) return 'numeric-table';
  if (['money-composition'].includes(question.type)) return 'money-selection';
  if (['simulado-money-product-match', 'simulado-association'].includes(question.type)) return 'matching';
  if (question.type === 'simulado-product-board') return question.options?.length ? 'single-choice' : 'numeric-input';
  if (question.type === 'simulado-two-step') return 'composite';
  return null;
}

export function withAv2AnswerMode(question) {
  const answerMode = getAv2AnswerMode(question);
  if (!answerMode || !ALLOWED_MODE_SET.has(answerMode)) {
    throw new TypeError(`Tipo de interação AV2 não permitido: ${question?.type ?? 'desconhecido'}.`);
  }
  return { ...question, answerMode };
}

export function validateAv2AnswerMode(question, { requireDeclared = false } = {}) {
  const answerMode = getAv2AnswerMode(question);
  if (!answerMode || !ALLOWED_MODE_SET.has(answerMode)) return false;
  if (requireDeclared && question.answerMode !== answerMode) return false;
  if (question.answerMode !== undefined && question.answerMode !== answerMode) return false;

  const isNumberWord = ['NUM-05', 'NUM-06'].includes(question.category)
    || ['NUMBER_WORDS', 'NUMBER_WORD_ASSOCIATION', 'NUMBER_WORD_WRITING'].includes(question.pedagogicalCategory);
  return !isNumberWord || ['single-choice', 'matching'].includes(answerMode);
}
