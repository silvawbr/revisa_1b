export const AV2_SUBTRACTION_ACTIVITY_ID = 'subtracao-com-reagrupamento';
export const AV2_SUBTRACTION_ROUND_LENGTH = 12;
export const AV2_SUBTRACTION_CATEGORIES = Object.freeze(['SUB-01', 'SUB-02', 'SUB-03', 'SUB-04', 'SUBTRACTION_TERMS', 'CONTEXTUAL_SUBTRACTION']);
const columns = ['units', 'tens', 'hundreds'];
const names = { units: 'unidades', tens: 'dezenas', hundreds: 'centenas' };
const digits = (n) => ({ hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, units: n % 10 });
const quantity = (s) => s.hundreds * 100 + s.tens * 10 + s.units;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Pure ordered exchanges. Zero bridges are calculated, then excluded by the curriculum validator. */
export function calculateSubtractionTrace(a, b) {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 999) || b > a) throw new RangeError('Subtração exige inteiros de 0 a 999 e resultado não negativo.');
  const original = digits(a);
  const subtrahend = digits(b);
  const state = { ...original };
  const events = [];
  let zeroBridge = false;
  const exchange = (index) => {
    const toColumn = columns[index];
    const fromColumn = columns[index + 1];
    if (!fromColumn) throw new RangeError('Não há ordem disponível para a troca.');
    if (state[fromColumn] === 0) { zeroBridge = true; exchange(index + 1); }
    const stateBefore = { ...state };
    state[fromColumn] -= 1;
    state[toColumn] += 10;
    const stateAfter = { ...state };
    if (quantity(stateBefore) !== a || quantity(stateAfter) !== a || Object.values(stateAfter).some((n) => n < 0)) throw new Error('Troca inválida.');
    events.push({ fromColumn, toColumn, stateBefore, stateAfter, exchangedAmount: 10 });
  };
  const calculations = {};
  for (let i = 0; i < columns.length; i += 1) {
    const column = columns[i];
    if (state[column] < subtrahend[column]) exchange(i);
    calculations[column] = { adjusted: state[column], subtract: subtrahend[column], resultDigit: state[column] - subtrahend[column] };
  }
  const pattern = zeroBridge ? 'zero-bridge' : events.length === 2 ? 'both' : events[0]?.toColumn ?? 'none';
  return freeze({ operands: { minuend: a, subtrahend: b }, original, subtrahend, events, adjusted: { ...state }, columns: calculations, pattern, zeroBridge, result: a - b });
}

export function subtractionCategory(trace) {
  return ({ none: 'SUB-01', units: 'SUB-02', tens: 'SUB-03', both: 'SUB-04' })[trace.pattern] ?? null;
}

export function validateSubtractionOperation(a, b, category) {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 10 && n <= 999) || b > a) return false;
  const trace = calculateSubtractionTrace(a, b);
  return !trace.zeroBridge && subtractionCategory(trace) === category
    && (!['SUB-03', 'SUB-04'].includes(category) || (a >= 100 && b >= 100));
}

function exchangeText(event) {
  const { fromColumn: from, toColumn: to, stateBefore: before, stateAfter: after } = event;
  const order = from === 'tens' ? 'dezena' : 'centena';
  return `Troque uma ${order} por dez ${names[to]}. ${names[from]}: ${before[from]} → ${after[from]}; ${names[to]}: ${before[to]} → ${after[to]}.`;
}

export function subtractionHints(trace) {
  const hints = [{ text: 'Comece pelas unidades, da direita para a esquerda.', revealedEvents: 0 }];
  trace.events.forEach((event, index) => {
    const { toColumn, stateBefore, stateAfter } = event;
    hints.push({ text: `Temos ${stateBefore[toColumn]} ${names[toColumn]} e precisamos tirar ${trace.subtrahend[toColumn]}. ${exchangeText(event)}`, revealedEvents: index + 1 });
    hints.push({ text: `Agora temos ${stateAfter[toColumn]} ${names[toColumn]}. Quanto é ${stateAfter[toColumn]} menos ${trace.subtrahend[toColumn]}?`, revealedEvents: index + 1 });
  });
  if (!trace.events.length) hints.push({ text: `Nas unidades, quanto é ${trace.original.units} menos ${trace.subtrahend.units}? Depois continue pelas dezenas${trace.operands.minuend >= 100 ? ' e centenas' : ''}.`, revealedEvents: 0 });
  return hints;
}

export function subtractionExplanation(trace) {
  const steps = [];
  for (const column of columns) {
    trace.events.filter((e) => e.toColumn === column).forEach((e) => steps.push(exchangeText(e)));
    if (column === 'hundreds' && trace.operands.minuend < 100) continue;
    const c = trace.columns[column];
    steps.push(`${names[column]}: ${c.adjusted} menos ${c.subtract} = ${c.resultDigit}.`);
  }
  return `${steps.join(' ')} ${trace.operands.minuend} menos ${trace.operands.subtrahend} = ${trace.result}.`;
}

const contexts = [
  { id: 'books', item: 'livros', prompt: (a, b) => `A biblioteca tinha ${a} livros. Foram retirados ${b}. Quantos livros ficaram?` },
  { id: 'toys', item: 'brinquedos', prompt: (a, b) => `Uma loja tinha ${a} brinquedos e vendeu ${b}. Quantos sobraram?` },
  { id: 'stickers', item: 'figurinhas', prompt: (a, b) => `Marina tinha ${a} figurinhas e deu ${b}. Com quantas ficou?` },
];
const terms = {
  minuend: { prompt: 'Qual é o minuendo?', answer: (t) => t.operands.minuend },
  subtrahend: { prompt: 'Qual é o subtraendo?', answer: (t) => t.operands.subtrahend },
  difference: { prompt: 'Qual é a diferença?', answer: (t) => t.result },
  name: { prompt: 'Como chamamos o resultado da subtração?', answer: () => 'Resto ou diferença' },
  removed: { prompt: 'Qual número está sendo subtraído?', answer: (t) => t.operands.subtrahend },
};

function presentation(type, trace, term, contextId) {
  const { minuend: a, subtrahend: b } = trace.operands;
  if (type === 'terms') {
    if (!terms[term]) return null;
    const explanation = `${a} é o minuendo; ${b} é o subtraendo; ${trace.result} é o resto ou diferença.`;
    return { prompt: terms[term].prompt, speech: `Na subtração ${a} menos ${b}, igual a ${trace.result}. ${terms[term].prompt}`, explanation,
      hints: [{ text: 'O minuendo fica em cima; o subtraendo fica na linha do sinal de menos. O resultado é o resto ou diferença.', revealedEvents: 0 }], correctAnswer: terms[term].answer(trace) };
  }
  const context = type === 'context' ? contexts.find((c) => c.id === contextId) : null;
  if (type === 'context' && !context) return null;
  const prompt = context ? context.prompt(a, b) : `Resolva a subtração: ${a} − ${b}.`;
  return { prompt, speech: context ? prompt : `Resolva a subtração: ${a} menos ${b}.`,
    explanation: `${context ? 'Usamos a subtração porque uma quantidade foi retirada. ' : ''}${subtractionExplanation(trace)}${context ? ` Ficaram ${trace.result} ${context.item}.` : ''}`,
    hints: subtractionHints(trace), correctAnswer: trace.result };
}

function index(length, random) {
  const n = Number(random());
  return Math.floor((Number.isFinite(n) ? Math.max(0, Math.min(n, 0.999999999)) : 0) * length);
}
function shuffle(values, random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = index(i + 1, random); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function createSubtractionQuestion({ a, b, type = 'subtraction', term = null, contextId = null, random = Math.random }) {
  const trace = calculateSubtractionTrace(a, b);
  const display = presentation(type, trace, term, contextId);
  if (!display) throw new TypeError('Questão desconhecida.');
  const { correctAnswer } = display;
  const options = type === 'terms' && term === 'name' ? ['Resto ou diferença', 'Minuendo', 'Subtraendo', 'Parcela']
    : [...new Set([correctAnswer, a, b, trace.result, correctAnswer + 1, correctAnswer + 10, Math.max(0, correctAnswer - 1)])].filter((n) => n <= 999).slice(0, 4);
  const question = {
    revisionId: 'av2-matematica', activityId: AV2_SUBTRACTION_ACTIVITY_ID, type,
    pedagogicalCategory: type === 'terms' ? 'SUBTRACTION_TERMS' : type === 'context' ? 'CONTEXTUAL_SUBTRACTION' : subtractionCategory(trace),
    questionId: `${type}-${term ?? contextId ?? trace.pattern}-${a}-${b}`,
    data: { operation: 'subtraction', a, b, result: trace.result, trace, pattern: subtractionCategory(trace), term, contextId },
    ...display, options: shuffle(options, random), hint: display.hints[0].text,
    feedback: { correct: `Muito bem! ${display.explanation}`, retry: 'Tente novamente! Confira as colunas e peça uma dica para ver cada passo.' },
  };
  if (!validateAv2SubtractionQuestionCandidate(question)) throw new TypeError('A questão viola o contrato pedagógico de subtração.');
  return freeze(question);
}

export function validateAv2SubtractionQuestionCandidate(q) {
  if (!q || q.revisionId !== 'av2-matematica' || q.activityId !== AV2_SUBTRACTION_ACTIVITY_ID || !['subtraction', 'terms', 'context'].includes(q.type)) return false;
  const d = q.data;
  if (!d || d.operation !== 'subtraction' || !validateSubtractionOperation(d.a, d.b, d.pattern)) return false;
  const trace = calculateSubtractionTrace(d.a, d.b);
  if (d.result !== trace.result || !equal(d.trace, trace)) return false;
  const category = q.type === 'terms' ? 'SUBTRACTION_TERMS' : q.type === 'context' ? 'CONTEXTUAL_SUBTRACTION' : subtractionCategory(trace);
  if (q.pedagogicalCategory !== category || (q.type !== 'terms' && d.term !== null) || (q.type !== 'context' && d.contextId !== null)) return false;
  const expected = presentation(q.type, trace, d.term, d.contextId);
  if (!expected || Object.entries(expected).some(([key, value]) => !equal(q[key], value)) || q.hint !== expected.hints[0].text) return false;
  if (!equal(q.feedback, { correct: `Muito bem! ${expected.explanation}`, retry: 'Tente novamente! Confira as colunas e peça uma dica para ver cada passo.' })) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4 || q.options.filter((n) => n === q.correctAnswer).length !== 1) return false;
  if (q.type === 'terms' && d.term === 'name') return equal([...q.options].sort(), ['Resto ou diferença', 'Minuendo', 'Subtraendo', 'Parcela'].sort());
  return q.options.every((n) => Number.isInteger(n) && n >= 0 && n <= 999);
}

export function validateAv2SubtractionAnswer(question, answer) {
  if (!validateAv2SubtractionQuestionCandidate(question)) return false;
  const normalized = typeof answer === 'string' && /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : answer;
  return normalized === question.correctAnswer;
}

function pair(category, count, random, used) {
  const min = count === 2 ? 10 : 100;
  const size = count === 2 ? 90 : 900;
  const valid = (a, b) => a > b && a - b !== b && !used.has(`${a}-${b}`) && validateSubtractionOperation(a, b, category);
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const a = min + index(size, random); const b = min + index(size, random);
    if (valid(a, b)) return [a, b];
  }
  // Finite verified fallback also keeps rounds usable with constant or broken RNGs.
  for (let a = min; a < min + size; a += 1) for (let b = min; b < a; b += 1) if (valid(a, b)) return [a, b];
  throw new Error('Não foi possível montar uma subtração válida.');
}

export function createAv2SubtractionQuestion({ category = 'SUB-01', digitCount = 2, random = Math.random } = {}) {
  if (!AV2_SUBTRACTION_CATEGORIES.slice(0, 4).includes(category) || ![2, 3].includes(digitCount) || (['SUB-03', 'SUB-04'].includes(category) && digitCount !== 3)) throw new RangeError('Categoria ou quantidade de algarismos inválida.');
  const [a, b] = pair(category, digitCount, random, new Set());
  return createSubtractionQuestion({ a, b, random });
}

export function createAv2SubtractionRound(random = Math.random) {
  const questions = []; const used = new Set();
  function add(category, count, extra = {}) {
    const [a, b] = pair(category, count, random, used); used.add(`${a}-${b}`);
    questions.push(createSubtractionQuestion({ a, b, random, ...extra }));
  }
  for (const category of AV2_SUBTRACTION_CATEGORIES.slice(0, 4)) {
    add(category, ['SUB-01', 'SUB-02'].includes(category) ? 2 : 3); add(category, 3);
  }
  add('SUB-02', 3, { type: 'terms', term: ['minuend', 'subtrahend', 'removed'][index(3, random)] });
  add('SUB-01', 3, { type: 'terms', term: ['difference', 'name'][index(2, random)] });
  add('SUB-02', 2, { type: 'context', contextId: contexts[index(contexts.length, random)].id });
  add('SUB-04', 3, { type: 'context', contextId: contexts[index(contexts.length, random)].id });
  const round = shuffle(questions, random);
  if (!validateAv2SubtractionRound(round)) throw new TypeError('Rodada de subtração inválida.');
  return freeze(round);
}

export function validateAv2SubtractionRound(round) {
  return Array.isArray(round) && round.length === 12 && round.every(validateAv2SubtractionQuestionCandidate)
    && new Set(round.map((q) => `${q.data.a}-${q.data.b}`)).size === 12
    && AV2_SUBTRACTION_CATEGORIES.every((c) => round.filter((q) => q.pedagogicalCategory === c).length === 2)
    && round.some((q) => q.data.a < 100 && q.data.b < 100) && round.some((q) => q.data.a >= 100 && q.data.b >= 100);
}
