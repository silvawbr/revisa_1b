export const AV2_ADDITION_ACTIVITY_ID = 'adicao-com-reagrupamento';

export const AV2_ADDITION_CATEGORIES = Object.freeze([
  'ADD-01',
  'ADD-02',
  'ADD-03',
  'ADD-04',
  'ADDITION_TERMS',
  'CONTEXTUAL_ADDITION',
]);

export const AV2_ADDITION_ROUND_LENGTH = 12;

const ARITHMETIC_CATEGORIES = Object.freeze(['ADD-01', 'ADD-02', 'ADD-03', 'ADD-04']);
const HINT_START = 'Comece somando as unidades, da direita para a esquerda.';

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function digitColumns(value) {
  return {
    hundreds: Math.floor(value / 100),
    tens: Math.floor(value / 10) % 10,
    units: value % 10,
  };
}

function calculateColumn(first, second, incomingCarry = 0) {
  const total = first + second + incomingCarry;
  return {
    first,
    second,
    incomingCarry,
    total,
    resultDigit: total % 10,
    carryOut: Math.floor(total / 10),
  };
}

/** Returns the units → tens → hundreds trace without depending on the old game limits. */
export function calculateAdditionTrace(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 999 || b > 999) {
    throw new RangeError('As parcelas devem ser números inteiros entre 0 e 999.');
  }

  const first = digitColumns(a);
  const second = digitColumns(b);
  const units = calculateColumn(first.units, second.units);
  const tens = calculateColumn(first.tens, second.tens, units.carryOut);
  const hundreds = calculateColumn(first.hundreds, second.hundreds, tens.carryOut);
  const result = a + b;
  const pattern = hundreds.carryOut > 0 ? 'overflow'
    : units.carryOut && tens.carryOut ? 'both'
      : units.carryOut ? 'units'
        : tens.carryOut ? 'tens' : 'none';

  return freezeDeep({
    operands: { first: a, second: b },
    columns: { units, tens, hundreds },
    carries: {
      toTens: units.carryOut,
      toHundreds: tens.carryOut,
      toThousands: hundreds.carryOut,
    },
    pattern,
    result,
  });
}

function categoryForTrace(trace) {
  if (trace.pattern === 'none') return 'ADD-01';
  if (trace.pattern === 'units') return 'ADD-02';
  if (trace.pattern === 'tens') return 'ADD-03';
  if (trace.pattern === 'both') return 'ADD-04';
  return null;
}

function randomIndex(length, random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999999) : 0;
  return Math.floor(normalized * length);
}

function randomInt(random, min, max) {
  return min + randomIndex(max - min + 1, random);
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, random);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function makeNumber(hundreds, tens, units) {
  return hundreds * 100 + tens * 10 + units;
}

function samplePair(category, digitCount, random) {
  let c1 = 0;
  let c2 = 0;
  let d1;
  let d2;
  let u1;
  let u2;

  if (category === 'ADD-01') {
    c1 = digitCount === 3 ? randomInt(random, 1, 8) : 0;
    c2 = digitCount === 3 ? randomInt(random, 1, 9 - c1) : 0;
    d1 = digitCount === 2 ? randomInt(random, 1, 9) : randomInt(random, 0, 9);
    d2 = randomInt(random, 0, 9 - d1);
    u1 = randomInt(random, 0, 9);
    u2 = randomInt(random, 0, 9 - u1);
  } else if (category === 'ADD-02') {
    u1 = randomInt(random, 1, 9);
    u2 = randomInt(random, 10 - u1, 9);
    d1 = digitCount === 2 ? randomInt(random, 1, 7) : randomInt(random, 0, 7);
    d2 = randomInt(random, 0, 8 - d1);
    if (digitCount === 3) {
      c1 = randomInt(random, 1, 8);
      c2 = randomInt(random, 1, 9 - c1);
    }
  } else if (category === 'ADD-03') {
    if (digitCount !== 3) return null;
    d1 = randomInt(random, 1, 9);
    d2 = randomInt(random, Math.max(1, 10 - d1), 9);
    u1 = randomInt(random, 0, 9);
    u2 = randomInt(random, 0, 9 - u1);
    c1 = randomInt(random, 1, 7);
    c2 = randomInt(random, 1, 9 - c1);
  } else if (category === 'ADD-04') {
    if (digitCount !== 3) return null;
    u1 = randomInt(random, 1, 9);
    u2 = randomInt(random, 10 - u1, 9);
    d1 = randomInt(random, 1, 9);
    d2 = randomInt(random, Math.max(1, 9 - d1), 9);
    c1 = randomInt(random, 1, 7);
    c2 = randomInt(random, 1, 8 - c1);
  } else {
    return null;
  }

  return [makeNumber(c1, d1, u1), makeNumber(c2, d2, u2)];
}

function matchesDigitCount(a, b, digitCount) {
  return String(a).length === digitCount && String(b).length === digitCount;
}

function isValidPairForCategory(a, b, category, digitCount, predicate = () => true) {
  if (a < 10 || b < 10 || a + b > 999 || !matchesDigitCount(a, b, digitCount) || !predicate(a, b)) return false;
  const trace = calculateAdditionTrace(a, b);
  return trace.carries.toThousands === 0 && categoryForTrace(trace) === category
    && (!(category === 'ADD-03' || category === 'ADD-04') || (a >= 100 && b >= 100 && trace.result >= 100));
}

function operationSignature(a, b) {
  return [a, b].sort((left, right) => left - right).join('+');
}

function findFallbackPair(category, digitCount, excluded, predicate) {
  const min = digitCount === 2 ? 10 : 100;
  const max = digitCount === 2 ? 99 : 999;
  for (let a = min; a <= max; a += 1) {
    for (let b = min; b <= Math.min(max, 999 - a); b += 1) {
      const signature = operationSignature(a, b);
      if (excluded.has(signature) || !isValidPairForCategory(a, b, category, digitCount, predicate)) continue;
      return [a, b];
    }
  }
  throw new Error(`Não foi possível gerar uma adição válida para ${category}.`);
}

function createOperationPair(category, digitCount, random, excluded, predicate = () => true) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const pair = samplePair(category, digitCount, random);
    if (!pair) break;
    const [a, b] = pair;
    if (!excluded.has(operationSignature(a, b)) && isValidPairForCategory(a, b, category, digitCount, predicate)) return pair;
  }
  return findFallbackPair(category, digitCount, excluded, predicate);
}

function numericAnswerOptions(correctAnswer, random) {
  const possible = shuffled([
    correctAnswer - 1,
    correctAnswer + 1,
    correctAnswer - 10,
    correctAnswer + 10,
    correctAnswer - 2,
    correctAnswer + 2,
    correctAnswer - 100,
    correctAnswer + 100,
  ], random).filter((value, index, values) => (
    Number.isInteger(value) && value >= 0 && value <= 999 && value !== correctAnswer && values.indexOf(value) === index
  ));
  return shuffled([correctAnswer, ...possible.slice(0, 3)], random);
}

function columnText(columnName, column, { incomingCarryLabel = '' } = {}) {
  const operands = `${column.first} mais ${column.second}${column.incomingCarry ? ` mais ${column.incomingCarry}${incomingCarryLabel}` : ''}`;
  const carryText = column.carryOut
    ? `, escreva ${column.resultDigit} e vai 1 ${columnName === 'unidades' ? 'dezena' : 'centena'}`
    : `, escreva ${column.resultDigit}`;
  return `${columnName}: ${operands} = ${column.total}${carryText}.`;
}

function buildAdditionExplanation(a, b, trace) {
  const steps = [columnText('Unidades', trace.columns.units)];
  if (a >= 10 || b >= 10) {
    steps.push(columnText('Dezenas', trace.columns.tens, { incomingCarryLabel: ' que veio das unidades' }));
  }
  if (a >= 100 || b >= 100 || trace.result >= 100) {
    steps.push(columnText('Centenas', trace.columns.hundreds, { incomingCarryLabel: ' que veio das dezenas' }));
  }
  steps.push(`A soma de ${a} e ${b} é ${trace.result}.`);
  return steps.join(' ');
}

function createArithmeticHints(a, b, trace) {
  const hints = [{ text: HINT_START, revealsCarries: [] }];
  const units = trace.columns.units;
  const tens = trace.columns.tens;
  const hundreds = trace.columns.hundreds;
  if (units.carryOut) {
    hints.push({
      text: `${units.first} mais ${units.second} são ${units.total}. Escreva ${units.resultDigit} ${units.resultDigit === 1 ? 'unidade' : 'unidades'} e leve 1 dezena.`,
      revealsCarries: ['toTens'],
    });
  }
  if (tens.carryOut) {
    const carryNote = tens.incomingCarry ? ', incluindo a dezena que foi levada' : '';
    hints.push({
      text: `Agora some as dezenas${carryNote}: ${tens.first} mais ${tens.second}${tens.incomingCarry ? ` mais ${tens.incomingCarry}` : ''} são ${tens.total}. Escreva ${tens.resultDigit} dezena e leve 1 centena.`,
      revealsCarries: [...(units.carryOut ? ['toTens'] : []), 'toHundreds'],
    });
  } else if (units.carryOut) {
    hints.push({
      text: `Agora some as dezenas, incluindo a dezena que foi levada: ${tens.first} mais ${tens.second} mais 1 são ${tens.total}.`,
      revealsCarries: ['toTens'],
    });
  }
  if (a >= 100 || b >= 100 || trace.result >= 100) {
    const carryNote = hundreds.incomingCarry ? ' e não esqueça a centena que foi levada' : '';
    hints.push({
      text: `Some as centenas${carryNote}: ${hundreds.first} mais ${hundreds.second}${hundreds.incomingCarry ? ' mais 1' : ''}.`,
      revealsCarries: [...(units.carryOut ? ['toTens'] : []), ...(tens.carryOut ? ['toHundreds'] : [])],
    });
  }
  return hints;
}

const CONTEXTS = Object.freeze([
  { id: 'library', item: 'livros', prompt: (a, b) => `A biblioteca tinha ${a} livros e recebeu mais ${b}. Quantos livros há agora?` },
  { id: 'stickers', item: 'figurinhas', prompt: (a, b) => `Lia juntou ${a} figurinhas e ganhou mais ${b}. Quantas figurinhas ela tem agora?` },
  { id: 'school-pencils', item: 'lápis', prompt: (a, b) => `A escola recebeu ${a} lápis e depois mais ${b}. Quantos lápis recebeu ao todo?` },
  { id: 'box-pieces', item: 'peças', prompt: (a, b) => `Em uma caixa havia ${a} peças e foram colocadas mais ${b}. Quantas peças há na caixa?` },
  { id: 'donation-books', item: 'livros', prompt: (a, b) => `Uma turma doou ${a} livros e outra doou mais ${b}. Quantos livros foram doados ao todo?` },
]);

function makeQuestion({ type, pedagogicalCategory, questionId, data, correctAnswer, options, prompt, explanation, hints, retry }) {
  const question = freezeDeep({
    revisionId: 'av2-matematica',
    activityId: AV2_ADDITION_ACTIVITY_ID,
    type,
    pedagogicalCategory,
    questionId,
    data,
    correctAnswer,
    options,
    prompt,
    speech: type === 'addition'
      ? `Resolva a adição: ${data.a} mais ${data.b}.`
      : type === 'terms' && data.term === 'ordered-addends'
        ? `Na adição ${data.a} mais ${data.b}, quais números são, nessa ordem, a primeira e a segunda parcela?`
        : type === 'terms'
          ? `Na adição ${data.a} mais ${data.b}, qual é a soma ou total?`
          : prompt,
    explanation,
    hints,
    hint: hints[0].text,
    feedback: {
      correct: `Muito bem! ${explanation}`,
      retry: retry ?? 'Tente novamente! Observe a conta e some com calma.',
    },
  });
  if (!validateAv2AdditionQuestionCandidate(question)) {
    throw new TypeError('A questão de adição viola o contrato pedagógico da AV2 Matemática.');
  }
  return question;
}

function makeArithmeticQuestion({ type = 'addition', pedagogicalCategory, a, b, random, context = null }) {
  const trace = calculateAdditionTrace(a, b);
  const hints = createArithmeticHints(a, b, trace);
  const prompt = context ? context.prompt(a, b) : `Resolva a adição: ${a} + ${b}.`;
  const explanation = `${buildAdditionExplanation(a, b, trace)}${context ? ` Há ${trace.result} ${context.item} ${trace.result === 1 ? '' : 'ao todo'}.` : ''}`;
  return makeQuestion({
    type,
    pedagogicalCategory,
    questionId: `${type}-${context?.id ?? pedagogicalCategory}-${a}-${b}`,
    data: { operation: 'addition', a, b, result: trace.result, trace, pattern: categoryForTrace(trace), context: context ? { id: context.id, item: context.item } : null },
    correctAnswer: trace.result,
    options: numericAnswerOptions(trace.result, random),
    prompt,
    explanation,
    hints,
    retry: context
      ? `Tente novamente! Revise o problema com ${a} e ${b}. Comece pelas unidades.`
      : `Tente novamente! Revise as parcelas ${a} e ${b}. Comece pelas unidades.`,
  });
}

function makeTermsQuestion({ role, a, b, random }) {
  const trace = calculateAdditionTrace(a, b);
  const hints = role === 'ordered-addends'
    ? [
      { text: 'A 1ª parcela fica na primeira linha. A 2ª parcela fica na linha com o sinal de mais.', revealsCarries: [] },
      { text: 'A ordem importa: primeiro vem o número de cima; depois, o número de baixo.', revealsCarries: [] },
    ]
    : [
      { text: 'As duas parcelas são os números que somamos.', revealsCarries: [] },
      { text: 'O resultado de uma adição se chama soma ou total.', revealsCarries: [] },
    ];
  if (role === 'ordered-addends') {
    const correct = `${a} e ${b}`;
    const options = shuffled([correct, `${b} e ${a}`, `${a} e ${trace.result}`, `${b} e ${trace.result}`], random);
    return makeQuestion({
      type: 'terms',
      pedagogicalCategory: 'ADDITION_TERMS',
      questionId: `terms-first-second-${a}-${b}`,
      data: { operation: 'addition', a, b, result: trace.result, trace, pattern: categoryForTrace(trace), term: role },
      correctAnswer: correct,
      options,
      prompt: 'Quais números são, nessa ordem, a 1ª e a 2ª parcela?',
      explanation: `A 1ª parcela é ${a} e a 2ª parcela é ${b}. O resultado, ${trace.result}, é a soma ou o total.`,
      hints,
      retry: `Tente novamente! Observe as duas linhas: ${a} é a 1ª parcela e ${b} é a 2ª parcela.`,
    });
  }

  return makeQuestion({
    type: 'terms',
    pedagogicalCategory: 'ADDITION_TERMS',
    questionId: `terms-sum-${a}-${b}`,
    data: { operation: 'addition', a, b, result: trace.result, trace, pattern: categoryForTrace(trace), term: 'sum' },
    correctAnswer: trace.result,
    options: numericAnswerOptions(trace.result, random),
    prompt: 'Qual é a soma ou total desta adição?',
    explanation: `As parcelas são ${a} e ${b}. A soma ou o total é ${trace.result}.`,
    hints,
    retry: `Tente novamente! As parcelas são ${a} e ${b}. O que encontramos ao somá-las?`,
  });
}

function chooseArithmeticCategory(random, digitCount) {
  return digitCount === 2
    ? (randomIndex(2, random) === 0 ? 'ADD-01' : 'ADD-02')
    : ARITHMETIC_CATEGORIES[randomIndex(ARITHMETIC_CATEGORIES.length, random)];
}

function chooseContext(random) {
  return CONTEXTS[randomIndex(CONTEXTS.length, random)];
}

export function createAv2AdditionQuestion({ category = 'ADD-01', digitCount = 2, random = Math.random } = {}) {
  if (!ARITHMETIC_CATEGORIES.includes(category)) throw new TypeError('Categoria de adição desconhecida.');
  if (![2, 3].includes(digitCount) || (['ADD-03', 'ADD-04'].includes(category) && digitCount !== 3)) {
    throw new RangeError('Esta categoria exige parcelas com dois ou três algarismos compatíveis com o reagrupamento.');
  }
  const pair = createOperationPair(category, digitCount, random, new Set());
  return makeArithmeticQuestion({ type: 'addition', pedagogicalCategory: category, a: pair[0], b: pair[1], random });
}

/** Build a fixed, validated operation while reusing Block 03's trace and presentation contract. */
export function createAv2AdditionQuestionForOperands({ a, b, random = Math.random } = {}) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 999 || b > 999) {
    throw new RangeError('As parcelas devem ser números inteiros entre 0 e 999.');
  }
  const trace = calculateAdditionTrace(a, b);
  if (trace.carries.toThousands > 0) throw new RangeError('A soma não pode ultrapassar 999.');
  return makeArithmeticQuestion({ type: 'addition', pedagogicalCategory: categoryForTrace(trace), a, b, random });
}

export function validateAv2AdditionQuestionCandidate(question) {
  if (!question || question.revisionId !== 'av2-matematica' || question.activityId !== AV2_ADDITION_ACTIVITY_ID) return false;
  if (!['addition', 'terms', 'context'].includes(question.type)) return false;
  if (!AV2_ADDITION_CATEGORIES.includes(question.pedagogicalCategory)) return false;
  if (typeof question.prompt !== 'string' || !question.prompt || typeof question.speech !== 'string' || !question.speech) return false;
  if (typeof question.explanation !== 'string' || !question.explanation || !question.feedback?.correct?.includes(question.explanation)) return false;
  if (typeof question.feedback?.retry !== 'string' || !question.feedback.retry) return false;

  const data = question.data;
  if (!data || data.operation !== 'addition' || !Number.isInteger(data.a) || !Number.isInteger(data.b)
    || data.a < 10 || data.a > 999 || data.b < 10 || data.b > 999 || data.a + data.b > 999) return false;
  const trace = calculateAdditionTrace(data.a, data.b);
  if (JSON.stringify(data.trace) !== JSON.stringify(trace) || data.result !== trace.result
    || trace.carries.toThousands !== 0 || data.pattern !== categoryForTrace(trace)) return false;
  if (!Array.isArray(question.options) || question.options.length < 2
    || new Set(question.options).size !== question.options.length
    || question.options.filter((option) => option === question.correctAnswer).length !== 1) return false;
  if (!Array.isArray(question.hints) || question.hints.length === 0
    || question.hint !== question.hints[0].text
    || question.hints.some((hint) => !hint || typeof hint.text !== 'string' || !hint.text
      || !Array.isArray(hint.revealsCarries) || hint.revealsCarries.some((carry) => !['toTens', 'toHundreds'].includes(carry)))) return false;

  if (question.type === 'addition') {
    if (!ARITHMETIC_CATEGORIES.includes(question.pedagogicalCategory)
      || question.pedagogicalCategory !== categoryForTrace(trace)
      || (question.pedagogicalCategory === 'ADD-03' && (data.a < 100 || data.b < 100))
      || (question.pedagogicalCategory === 'ADD-04' && (data.a < 100 || data.b < 100 || data.result < 100))) return false;
    if (!question.options.every((option) => Number.isInteger(option) && option >= 0 && option <= 999)) return false;
    if (question.correctAnswer !== trace.result || question.options.length !== 4) return false;
    if (question.explanation !== buildAdditionExplanation(data.a, data.b, trace)
      || JSON.stringify(question.hints) !== JSON.stringify(createArithmeticHints(data.a, data.b, trace))) return false;
    return question.prompt.includes(String(data.a)) && question.prompt.includes(String(data.b))
      && question.speech === `Resolva a adição: ${data.a} mais ${data.b}.`;
  }

  if (question.type === 'context') {
    if (question.pedagogicalCategory !== 'CONTEXTUAL_ADDITION' || !data.context
      || typeof data.context.id !== 'string' || typeof data.context.item !== 'string'
      || question.correctAnswer !== trace.result || !question.options.every((option) => Number.isInteger(option) && option >= 0 && option <= 999)
      || question.options.length !== 4) return false;
    const context = CONTEXTS.find(({ id }) => id === data.context.id);
    if (!context || context.item !== data.context.item || question.prompt !== context.prompt(data.a, data.b)) return false;
    const expectedExplanation = `${buildAdditionExplanation(data.a, data.b, trace)} Há ${trace.result} ${context.item} ${trace.result === 1 ? '' : 'ao todo'}.`;
    return question.explanation === expectedExplanation && question.speech === question.prompt
      && JSON.stringify(question.hints) === JSON.stringify(createArithmeticHints(data.a, data.b, trace));
  }

  if (question.pedagogicalCategory !== 'ADDITION_TERMS' || !['ordered-addends', 'sum'].includes(data.term)) return false;
  if (data.a === data.b) return false;
  if (data.term === 'ordered-addends') {
    const correct = `${data.a} e ${data.b}`;
    return question.correctAnswer === correct && question.prompt === 'Quais números são, nessa ordem, a 1ª e a 2ª parcela?'
      && question.speech === `Na adição ${data.a} mais ${data.b}, quais números são, nessa ordem, a primeira e a segunda parcela?`
      && question.options.length === 4 && question.options.every((option) => typeof option === 'string')
      && new Set(question.options).size === 4
      && JSON.stringify([...question.options].sort()) === JSON.stringify([
        `${data.a} e ${data.b}`,
        `${data.b} e ${data.a}`,
        `${data.a} e ${trace.result}`,
        `${data.b} e ${trace.result}`,
      ].sort())
      && question.options.includes(`${data.b} e ${data.a}`)
      && JSON.stringify(question.hints) === JSON.stringify([
        { text: 'A 1ª parcela fica na primeira linha. A 2ª parcela fica na linha com o sinal de mais.', revealsCarries: [] },
        { text: 'A ordem importa: primeiro vem o número de cima; depois, o número de baixo.', revealsCarries: [] },
      ])
      && question.explanation === `A 1ª parcela é ${data.a} e a 2ª parcela é ${data.b}. O resultado, ${trace.result}, é a soma ou o total.`;
  }
  return question.correctAnswer === trace.result
    && question.options.length === 4 && question.options.every((option) => Number.isInteger(option) && option >= 0 && option <= 999)
    && question.prompt === 'Qual é a soma ou total desta adição?'
    && question.speech === `Na adição ${data.a} mais ${data.b}, qual é a soma ou total?`
    && JSON.stringify(question.hints) === JSON.stringify([
      { text: 'As duas parcelas são os números que somamos.', revealsCarries: [] },
      { text: 'O resultado de uma adição se chama soma ou total.', revealsCarries: [] },
    ])
    && question.explanation === `As parcelas são ${data.a} e ${data.b}. A soma ou o total é ${trace.result}.`;
}

export function validateAv2AdditionAnswer(question, answer) {
  if (!validateAv2AdditionQuestionCandidate(question)) return false;
  const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
  return normalized === question.correctAnswer;
}

export function createAv2AdditionRound(random = Math.random) {
  const questions = [];
  const usedOperations = new Set([operationSignature(156, 195)]);
  const addArithmetic = (category, digitCount, type = 'addition', context = null) => {
    const predicate = type === 'terms' ? (a, b) => a !== b : undefined;
    const pair = createOperationPair(category, digitCount, random, usedOperations, predicate);
    usedOperations.add(operationSignature(pair[0], pair[1]));
    const question = type === 'terms'
      ? makeTermsQuestion({ role: context, a: pair[0], b: pair[1], random })
      : makeArithmeticQuestion({ type, pedagogicalCategory: type === 'context' ? 'CONTEXTUAL_ADDITION' : category, a: pair[0], b: pair[1], random, context: type === 'context' ? context : null });
    questions.push(question);
  };

  addArithmetic('ADD-01', 2);
  addArithmetic('ADD-01', 3);
  addArithmetic('ADD-02', 2);
  addArithmetic('ADD-02', 3);
  addArithmetic('ADD-03', 3);
  addArithmetic('ADD-03', 3);
  addArithmetic('ADD-04', 3);
  addArithmetic('ADD-04', 3);
  addArithmetic(chooseArithmeticCategory(random, 3), 3, 'terms', 'ordered-addends');
  addArithmetic(chooseArithmeticCategory(random, 3), 3, 'terms', 'sum');
  addArithmetic(chooseArithmeticCategory(random, 2), 2, 'context', chooseContext(random));
  if (randomIndex(3, random) === 0) {
    const libraryContext = CONTEXTS.find(({ id }) => id === 'library');
    questions.push(makeArithmeticQuestion({
      type: 'context',
      pedagogicalCategory: 'CONTEXTUAL_ADDITION',
      a: 156,
      b: 195,
      random,
      context: libraryContext,
    }));
  } else {
    addArithmetic(chooseArithmeticCategory(random, 3), 3, 'context', chooseContext(random));
  }

  const round = shuffled(questions, random);
  if (!validateAv2AdditionRound(round)) throw new TypeError('A rodada de adição viola o contrato pedagógico da AV2 Matemática.');
  return Object.freeze(round);
}

export function validateAv2AdditionRound(round) {
  if (!Array.isArray(round) || round.length !== AV2_ADDITION_ROUND_LENGTH
    || !round.every(validateAv2AdditionQuestionCandidate)
    || new Set(round.map(({ questionId }) => questionId)).size !== round.length
    || new Set(round.map(({ data }) => operationSignature(data.a, data.b))).size !== round.length) return false;
  for (const category of ARITHMETIC_CATEGORIES) {
    if (round.filter(({ type, pedagogicalCategory }) => type === 'addition' && pedagogicalCategory === category).length !== 2) return false;
  }
  const contextualQuestions = round.filter(({ type }) => type === 'context');
  if (round.filter(({ type, data }) => type === 'terms' && data.term === 'ordered-addends').length !== 1
    || round.filter(({ type, data }) => type === 'terms' && data.term === 'sum').length !== 1
    || contextualQuestions.length !== 2
    || !contextualQuestions.some(({ data }) => data.a < 100 && data.b < 100)
    || !contextualQuestions.some(({ data }) => data.a >= 100 && data.b >= 100)) return false;
  const arithmeticQuestions = round.filter(({ type }) => type === 'addition');
  if (!arithmeticQuestions.some(({ data }) => data.a < 100 && data.b < 100)
    || !arithmeticQuestions.some(({ data }) => data.a >= 100 && data.b >= 100)) return false;
  return true;
}
