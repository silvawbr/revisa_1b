export const ACTIVITY_NAMES = [
  'Figuras planas',
  'Figuras espaciais',
  'Antecessor e sucessor',
  'Números por extenso',
  'Adição com reserva',
  'Soma com número desconhecido',
];

export const FLAT_SHAPES = [
  { key: 'circle', name: 'Círculo', spoken: 'círculo' },
  { key: 'triangle', name: 'Triângulo', spoken: 'triângulo' },
  { key: 'rectangle', name: 'Retângulo', spoken: 'retângulo' },
  { key: 'square', name: 'Quadrado', spoken: 'quadrado' },
];

export const SPATIAL_SHAPES = [
  { key: 'cube', name: 'Cubo', spoken: 'cubo' },
  { key: 'rectangular-block', name: 'Bloco retangular', spoken: 'bloco retangular' },
  { key: 'cylinder', name: 'Cilindro', spoken: 'cilindro' },
  { key: 'cone', name: 'Cone', spoken: 'cone' },
  { key: 'sphere', name: 'Esfera', spoken: 'esfera' },
];

const UNITS = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
];

const TEENS = {
  10: 'dez',
  11: 'onze',
  12: 'doze',
  13: 'treze',
  14: 'quatorze',
  15: 'quinze',
  16: 'dezesseis',
  17: 'dezessete',
  18: 'dezoito',
  19: 'dezenove',
};

const TENS = {
  20: 'vinte',
  30: 'trinta',
  40: 'quarenta',
  50: 'cinquenta',
  60: 'sessenta',
  70: 'setenta',
  80: 'oitenta',
  90: 'noventa',
};

export function numberToPortuguese(value) {
  if (!Number.isInteger(value) || value < 0 || value > 140) {
    throw new RangeError('O número deve ser inteiro entre 0 e 140.');
  }

  if (value < 10) return UNITS[value];
  if (value < 20) return TEENS[value];
  if (value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const units = value % 10;
    return units === 0 ? TENS[tens] : `${TENS[tens]} e ${UNITS[units]}`;
  }
  if (value === 100) return 'cem';

  return `cento e ${numberToPortuguese(value - 100)}`;
}

export function numberToDigits(value) {
  if (!Number.isInteger(value) || value < 0 || value > 140) {
    throw new RangeError('O número deve ser inteiro entre 0 e 140.');
  }
  return String(value).padStart(3, '0').split('').map(Number);
}

export function calculateCarries(a, b) {
  const unitsCarry = a % 10 + (b % 10) >= 10;
  const tensCarry = Math.floor(a / 10) + Math.floor(b / 10) + (unitsCarry ? 1 : 0) >= 10;
  return {
    toTens: unitsCarry ? 1 : null,
    toHundreds: tensCarry ? 1 : null,
  };
}

export function additionRequiresCarry(a, b) {
  const carries = calculateCarries(a, b);
  return carries.toTens === 1 || carries.toHundreds === 1;
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick(random, values) {
  return values[randomInt(random, 0, values.length - 1)];
}

function shuffle(random, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const ADDITION_CANDIDATES = (() => {
  const candidates = [];
  for (let a = 10; a <= 99; a += 1) {
    for (let b = 10; b <= 99; b += 1) {
      const result = a + b;
      if (result <= 140 && additionRequiresCarry(a, b)) {
        candidates.push({ a, b, result, carries: calculateCarries(a, b) });
      }
    }
  }
  return candidates;
})();

export function createFlatQuestion(random = Math.random) {
  const shape = pick(random, FLAT_SHAPES);
  const representation = random() < 0.5 ? 'pure' : 'object';
  return {
    type: 'flat',
    shapeKey: shape.key,
    shapeName: shape.name,
    spokenShapeName: shape.spoken,
    representation,
    optionKeys: shuffle(random, FLAT_SHAPES.map(({ key }) => key)),
    prompt: `Selecione a figura plana correta: ${shape.name}`,
    promptLabel: 'Selecione a figura plana correta:',
    speech: `Selecione a figura plana correta: ${shape.spoken}.`,
    explanation: `Esta é a figura ${shape.spoken}. Ela é uma figura plana.`,
  };
}

export function createSpatialQuestion(random = Math.random) {
  const shape = pick(random, SPATIAL_SHAPES);
  const representation = random() < 0.5 ? 'solid' : 'object';
  return {
    type: 'spatial',
    shapeKey: shape.key,
    shapeName: shape.name,
    spokenShapeName: shape.spoken,
    representation,
    optionKeys: shuffle(random, SPATIAL_SHAPES.map(({ key }) => key)),
    prompt: `Selecione a figura geométrica espacial correta: ${shape.name}`,
    promptLabel: 'Selecione a figura geométrica espacial correta:',
    speech: `Selecione a figura geométrica espacial correta: ${shape.spoken}.`,
    explanation: `Muito bem! O ${shape.spoken} é uma forma geométrica espacial, com volume.`,
  };
}

export function createAdditionQuestion(random = Math.random) {
  const candidate = pick(random, ADDITION_CANDIDATES);
  const digits = numberToDigits(candidate.result);
  return {
    type: 'addition',
    a: candidate.a,
    b: candidate.b,
    result: candidate.result,
    resultDigits: digits,
    carries: candidate.carries,
    prompt: 'Resolva a adição. Não esqueça de observar se é preciso fazer uma reserva.',
    speech: `Resolva a adição. Não esqueça de observar se é preciso fazer uma reserva. ${numberToPortuguese(candidate.a)} mais ${numberToPortuguese(candidate.b)}.`,
    explanation: `A soma de ${numberToPortuguese(candidate.a)} e ${numberToPortuguese(candidate.b)} é ${numberToPortuguese(candidate.result)}.`,
  };
}

export function createNeighborQuestion(random = Math.random) {
  const center = randomInt(random, 1, 139);
  const mode = pick(random, ['bracketing', 'middle', 'before']);
  const before = center - 1;
  const after = center + 1;

  let speech;
  if (mode === 'middle') {
    speech = `Qual número está entre ${numberToPortuguese(before)} e ${numberToPortuguese(after)}?`;
  } else if (mode === 'before') {
    speech = `Qual número vem antes de ${numberToPortuguese(center)}?`;
  } else {
    speech = `Qual número vem antes e qual número vem depois de ${numberToPortuguese(center)}?`;
  }

  return {
    type: 'neighbor',
    center,
    before,
    after,
    mode,
    prompt: 'Qual número vem antes e qual vem depois?',
    speech,
    explanation: `Isso mesmo: ${numberToPortuguese(before)} vem antes de ${numberToPortuguese(center)}, e ${numberToPortuguese(after)} vem depois!`,
  };
}

function wordDistractors(random, value) {
  const candidates = [value - 1, value + 1, value - 10, value + 10, value - 2, value + 2]
    .filter((candidate) => candidate >= 0 && candidate <= 140 && candidate !== value);
  const unique = [...new Set(candidates)];
  return shuffle(random, [value, ...unique.slice(0, 2)]);
}

export function createWordQuestion(random = Math.random) {
  const value = randomInt(random, 0, 140);
  const mode = random() < 0.5 ? 'number-to-word' : 'word-to-number';
  const options = wordDistractors(random, value).map((option) => ({
    value: option,
    label: mode === 'number-to-word' ? numberToPortuguese(option) : String(option),
  }));
  const correctIndex = options.findIndex((option) => option.value === value);

  return {
    type: 'word',
    value,
    mode,
    options,
    correctIndex,
    prompt: mode === 'number-to-word'
      ? `Observe o número ${value} e escolha como ele é escrito.`
      : 'Observe o número escrito por extenso e escolha o número correspondente.',
    speech: mode === 'number-to-word'
      ? `Observe o número ${value} e escolha como ele é escrito.`
      : 'Observe o número escrito por extenso e escolha o número correspondente.',
    explanation: mode === 'number-to-word'
      ? `${numberToPortuguese(value)} é escrito com os algarismos ${String(value).split('').join(', ')}: ${value}.`
      : `${numberToPortuguese(value)} corresponde ao número ${value}.`,
  };
}

export function createUnknownQuestion(random = Math.random) {
  const a = randomInt(random, 1, 8);
  let b = randomInt(random, 1, 9 - a);
  const format = pick(random, ['missing-right', 'missing-left', 'missing-result']);
  if (a === b && format !== 'missing-result') {
    const alternate = b < 9 - a ? b + 1 : b - 1;
    if (alternate >= 1 && alternate <= 9 - a) b = alternate;
  }
  const result = a + b;
  const missingValue = format === 'missing-right' ? b : format === 'missing-left' ? a : result;
  const missingText = 'número que está faltando';
  const leftText = format === 'missing-left' ? missingText : numberToPortuguese(a);
  const rightText = format === 'missing-right' ? missingText : numberToPortuguese(b);
  const resultText = format === 'missing-result' ? missingText : numberToPortuguese(result);

  return {
    type: 'unknown',
    a,
    b,
    result,
    format,
    missingValue,
    prompt: 'Descubra o número que está faltando.',
    speech: `Descubra o número que está faltando. ${leftText} mais ${rightText} é igual a ${resultText}.`,
    inverse: { minuend: result, subtrahend: b, difference: a },
    explanation: `Olha só! Se ${numberToPortuguese(a)} mais ${numberToPortuguese(b)} é igual a ${numberToPortuguese(result)}, então ${numberToPortuguese(result)} menos ${numberToPortuguese(b)} é igual a ${numberToPortuguese(a)}.`,
  };
}

export function createRound(random = Math.random) {
  return [
    createFlatQuestion(random),
    createSpatialQuestion(random),
    createNeighborQuestion(random),
    createWordQuestion(random),
    createAdditionQuestion(random),
    createUnknownQuestion(random),
  ];
}

export function validateAdditionAnswer(question, answer) {
  if (!question || question.type !== 'addition') return false;
  const resultMatches = ['hundreds', 'tens', 'units'].every((key, index) => Number(answer?.[key]) === question.resultDigits[index]);
  const carryValue = (value) => Number(value ?? 0);
  const unitsCarryMatches = carryValue(answer?.toTens) === (question.carries.toTens ?? 0);
  const tensCarryMatches = carryValue(answer?.toHundreds) === (question.carries.toHundreds ?? 0);
  return resultMatches && unitsCarryMatches && tensCarryMatches;
}

export function validateQuestionAnswer(question, answer) {
  if (!question) return false;
  if (question.type === 'flat' || question.type === 'spatial') {
    return answer === question.shapeKey;
  }
  if (question.type === 'addition') return validateAdditionAnswer(question, answer);
  if (question.type === 'neighbor') {
    if (question.mode === 'middle') return Number(answer?.middle) === question.center;
    if (question.mode === 'before') return Number(answer?.before) === question.before;
    return Number(answer?.before) === question.before && Number(answer?.after) === question.after;
  }
  if (question.type === 'word') {
    const selectedOption = answer && typeof answer === 'object' ? answer.option : answer;
    return Number(selectedOption) === question.correctIndex;
  }
  if (question.type === 'unknown') return Number(answer) === question.missingValue;
  return false;
}

export function canAdvance(isCorrect) {
  return isCorrect === true;
}

export function buildInverseSentence(question) {
  if (!question || question.type !== 'unknown') return '';
  const { minuend, subtrahend, difference } = question.inverse;
  return `${numberToPortuguese(minuend)} menos ${numberToPortuguese(subtrahend)} é igual a ${numberToPortuguese(difference)}.`;
}

export function answerForNeighbor(question) {
  return question.mode === 'middle'
    ? { middle: question.center }
    : question.mode === 'before'
      ? { before: question.before }
      : { before: question.before, after: question.after };
}
