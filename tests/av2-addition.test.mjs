import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AV2_ADDITION_CATEGORIES,
  AV2_ADDITION_ROUND_LENGTH,
  calculateAdditionTrace,
  createAv2AdditionQuestion,
  createAv2AdditionRound,
  validateAv2AdditionAnswer,
  validateAv2AdditionQuestionCandidate,
  validateAv2AdditionRound,
} from '../src/av2/addition.js';
import { renderCduLayout, renderCduLegend } from '../src/av2/cdu-layout.js';

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('a trilha C/D/U calcula as referências escolares e conserva cada reserva na ordem certa', () => {
  const references = [
    [236, 227, 463, 'ADD-02'],
    [119, 218, 337, 'ADD-02'],
    [157, 323, 480, 'ADD-02'],
    [593, 324, 917, 'ADD-03'],
    [156, 195, 351, 'ADD-04'],
    [27, 15, 42, 'ADD-02'],
    [38, 17, 55, 'ADD-02'],
    [23, 14, 37, 'ADD-01'],
    [124, 253, 377, 'ADD-01'],
  ];
  for (const [a, b, expected, category] of references) {
    const trace = calculateAdditionTrace(a, b);
    assert.equal(trace.result, expected, `${a} + ${b}`);
    const generated = createAv2AdditionQuestion({ category, digitCount: String(a).length, random: seededRandom(a + b) });
    assert.equal(generated.pedagogicalCategory, category);
  }

  const unitsCarry = calculateAdditionTrace(236, 227);
  assert.equal(unitsCarry.columns.units.total, 13);
  assert.equal(unitsCarry.columns.units.resultDigit, 3);
  assert.equal(unitsCarry.carries.toTens, 1);
  assert.equal(unitsCarry.columns.tens.incomingCarry, 1);
  assert.equal(unitsCarry.columns.tens.total, 6);
  assert.equal(unitsCarry.carries.toHundreds, 0, 'ADD-02 não cria uma segunda reserva');
  assert.equal(unitsCarry.columns.hundreds.total, 4);

  const tensCarry = calculateAdditionTrace(593, 324);
  assert.equal(tensCarry.carries.toTens, 0);
  assert.equal(tensCarry.columns.tens.total, 11);
  assert.equal(tensCarry.columns.tens.resultDigit, 1);
  assert.equal(tensCarry.carries.toHundreds, 1);
  assert.equal(tensCarry.columns.hundreds.incomingCarry, 1);
  assert.equal(tensCarry.columns.hundreds.total, 9);

  const bothCarries = calculateAdditionTrace(156, 195);
  assert.equal(bothCarries.columns.units.total, 11);
  assert.equal(bothCarries.columns.units.carryOut, 1);
  assert.equal(bothCarries.columns.tens.incomingCarry, 1);
  assert.equal(bothCarries.columns.tens.total, 15);
  assert.equal(bothCarries.columns.tens.carryOut, 1);
  assert.equal(bothCarries.columns.hundreds.incomingCarry, 1);
  assert.equal(bothCarries.columns.hundreds.total, 3, 'a reserva das dezenas entra uma única vez');
  assert.equal(bothCarries.result, 351);
});

test('a base visual C/D/U mantém duas e três casas alinhadas e aceita indicadores de vai um por coluna', () => {
  const markup = `${renderCduLegend()}${renderCduLayout({
    firstOperand: 156,
    secondOperand: 195,
    markers: {
      hundreds: { value: '1', ariaLabel: 'vai um para as centenas' },
      tens: { value: '1', ariaLabel: 'vai um para as dezenas' },
    },
    resultCells: ['<span role="cell"></span>', '<span role="cell"></span>', '<span role="cell"></span>'],
    ariaLabel: 'Adição vertical de 156 mais 195.',
  })}`;
  assert.match(markup, /role="columnheader">C<\/b>.*role="columnheader">D<\/b>.*role="columnheader">U<\/b>/s);
  assert.match(markup, /1ª parcela: 156/);
  assert.match(markup, /Mais 2ª parcela: 195/);
  assert.ok(markup.indexOf('data-cdu-marker="hundreds"') < markup.indexOf('data-cdu-marker="tens"'));
  assert.ok(markup.indexOf('data-cdu-marker="tens"') < markup.indexOf('data-cdu-marker="units"'));

  const twoDigits = renderCduLayout({
    firstOperand: 27,
    secondOperand: 15,
    markers: {},
    resultCells: ['<span role="cell" aria-label="sem centena"></span>', '<input role="cell" aria-label="dezena">', '<input role="cell" aria-label="unidade">'],
    ariaLabel: 'Adição vertical de 27 mais 15.',
  });
  assert.match(twoDigits, /1ª parcela: 27/);
  assert.match(twoDigits, /Mais 2ª parcela: 15/);
  assert.equal((twoDigits.match(/role="columnheader"/g) ?? []).length, 3);
  assert.throws(() => renderCduLayout({ firstOperand: 1000, secondOperand: 15, resultCells: ['', '', ''] }), RangeError);
});

test('duas mil rodadas reproduzíveis preservam limites, categorias, alternativas e explicações', () => {
  const roundSignatures = new Set();
  const orderSignatures = new Set();
  const answerPositions = new Set();

  for (let seed = 1; seed <= 2000; seed += 1) {
    const round = createAv2AdditionRound(seededRandom(seed));
    assert.equal(round.length, AV2_ADDITION_ROUND_LENGTH);
    assert.equal(validateAv2AdditionRound(round), true, `rodada ${seed}`);
    assert.equal(new Set(round.map(({ questionId }) => questionId)).size, 12);
    assert.equal(new Set(round.map(({ data }) => [data.a, data.b].sort((a, b) => a - b).join('+'))).size, 12);
    assert.deepEqual(AV2_ADDITION_CATEGORIES.slice(0, 4).map((category) => (
      round.filter(({ type, pedagogicalCategory }) => type === 'addition' && pedagogicalCategory === category).length
    )), [2, 2, 2, 2]);
    assert.ok(round.some(({ type, data }) => type === 'addition' && data.a < 100 && data.b < 100));
    assert.ok(round.some(({ type, data }) => type === 'addition' && data.a >= 100 && data.b >= 100));

    for (const question of round) {
      assert.equal(validateAv2AdditionQuestionCandidate(question), true, question.questionId);
      const { a, b, result, trace, pattern } = question.data;
      assert.ok(a >= 10 && a <= 999);
      assert.ok(b >= 10 && b <= 999);
      assert.ok(result >= 0 && result <= 999);
      assert.equal(a + b, result);
      assert.deepEqual(trace, calculateAdditionTrace(a, b));
      assert.equal(trace.carries.toThousands, 0);
      assert.equal(pattern, trace.pattern === 'none' ? 'ADD-01'
        : trace.pattern === 'units' ? 'ADD-02'
          : trace.pattern === 'tens' ? 'ADD-03'
            : trace.pattern === 'both' ? 'ADD-04' : null);
      assert.equal(new Set(question.options).size, question.options.length);
      assert.equal(question.options.filter((option) => option === question.correctAnswer).length, 1);
      assert.equal(validateAv2AdditionAnswer(question, question.correctAnswer), true);
      assert.equal(validateAv2AdditionAnswer(question, ` ${question.correctAnswer} `), typeof question.correctAnswer === 'number');
      assert.equal(validateAv2AdditionAnswer(question, question.options.find((option) => option !== question.correctAnswer)), false);
      assert.ok(question.explanation.includes(String(a)) && question.explanation.includes(String(b)));
      for (const option of question.options) answerPositions.add(question.options.indexOf(option));
    }

    roundSignatures.add(round.map(({ questionId, options }) => `${questionId}:${options.join(',')}`).join('|'));
    orderSignatures.add(round.map(({ questionId }) => questionId).join('|'));
  }

  assert.ok(roundSignatures.size > 1000, 'operand and alternative choices vary across seeds');
  assert.ok(orderSignatures.size > 1000, 'question order varies across seeds');
  assert.equal(answerPositions.size, 4);

  const fallbackRound = createAv2AdditionRound(() => 0);
  assert.equal(validateAv2AdditionRound(fallbackRound), true, 'a geração limitada tem fallback para sorteios repetidos');
  assert.equal(new Set(fallbackRound.map(({ data }) => [data.a, data.b].sort((a, b) => a - b).join('+'))).size, 12);
});

test('ADD-01 a ADD-04 só geram a trilha declarada e dão dicas compatíveis com a conta', () => {
  const expected = new Map([
    ['ADD-01', ['ADD-01', 'none', 0, 0]],
    ['ADD-02', ['ADD-02', 'units', 1, 0]],
    ['ADD-03', ['ADD-03', 'tens', 0, 1]],
    ['ADD-04', ['ADD-04', 'both', 1, 1]],
  ]);
  for (const [category, [classification, tracePattern, toTens, toHundreds]] of expected) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const question = createAv2AdditionQuestion({ category, digitCount: category === 'ADD-03' || category === 'ADD-04' ? 3 : (seed % 2 ? 2 : 3), random: seededRandom(seed) });
      assert.equal(question.data.pattern, classification);
      assert.equal(question.data.trace.pattern, tracePattern);
      assert.equal(question.data.trace.carries.toTens, toTens);
      assert.equal(question.data.trace.carries.toHundreds, toHundreds);
      assert.equal(validateAv2AdditionQuestionCandidate(question), true);
      assert.equal(question.hints[0].text, 'Comece somando as unidades, da direita para a esquerda.');
      if (!toTens) assert.ok(question.hints.every(({ text }) => !/leve 1 dezena/.test(text)));
      if (!toHundreds) assert.ok(question.hints.every(({ text }) => !/leve 1 centena/.test(text)));
      if (category === 'ADD-04') {
        assert.ok(question.hints.find(({ revealsCarries }) => revealsCarries.includes('toTens')));
        assert.ok(question.hints.find(({ revealsCarries }) => revealsCarries.includes('toHundreds')));
        assert.ok(question.explanation.indexOf('Unidades') < question.explanation.indexOf('Dezenas'));
        assert.ok(question.explanation.indexOf('Dezenas') < question.explanation.indexOf('Centenas'));
      }
      if (category === 'ADD-03') {
        assert.ok(question.hints.some(({ text }) => text.includes('Agora some as dezenas') || text.includes('são')));
      }
    }
  }
  assert.throws(() => createAv2AdditionQuestion({ category: 'ADD-03', digitCount: 2 }), RangeError);
  assert.throws(() => createAv2AdditionQuestion({ category: 'OTHER' }), TypeError);
});

test('termos da adição preservam a posição das parcelas e identificam soma/total sem ambiguidade', () => {
  for (let seed = 1; seed <= 400; seed += 1) {
    const round = createAv2AdditionRound(seededRandom(seed));
    const ordered = round.find(({ type, data }) => type === 'terms' && data.term === 'ordered-addends');
    const sum = round.find(({ type, data }) => type === 'terms' && data.term === 'sum');
    assert.notEqual(ordered.data.a, ordered.data.b);
    assert.equal(ordered.correctAnswer, `${ordered.data.a} e ${ordered.data.b}`);
    assert.ok(ordered.options.includes(`${ordered.data.b} e ${ordered.data.a}`));
    assert.notEqual(ordered.correctAnswer, `${ordered.data.b} e ${ordered.data.a}`);
    assert.equal(ordered.options.filter((option) => option === ordered.correctAnswer).length, 1);
    assert.equal(sum.correctAnswer, sum.data.a + sum.data.b);
    assert.equal(sum.explanation, `As parcelas são ${sum.data.a} e ${sum.data.b}. A soma ou o total é ${sum.data.result}.`);
    assert.equal(sum.options.filter((option) => option === sum.data.result).length, 1);
  }
});

test('problemas curtos usam uma adição contextual sem dinheiro nem operação extra', () => {
  let sawLibraryAddition = false;
  for (let seed = 1; seed <= 400; seed += 1) {
    const round = createAv2AdditionRound(seededRandom(seed));
    const contexts = round.filter(({ type }) => type === 'context');
    assert.equal(contexts.length, 2);
    assert.equal(new Set(contexts.map(({ data }) => String(data.a).length)).size, 2);
    for (const question of contexts) {
      assert.equal(question.data.result, question.data.a + question.data.b);
      assert.equal(question.pedagogicalCategory, 'CONTEXTUAL_ADDITION');
      assert.ok(question.prompt.includes(String(question.data.a)));
      assert.ok(question.prompt.includes(String(question.data.b)));
      assert.doesNotMatch(question.prompt, /R\$|centavos| vezes | dividido/);
      assert.equal(question.options.filter((option) => option === question.correctAnswer).length, 1);
    }
    sawLibraryAddition ||= contexts.some(({ prompt, data }) => (
      prompt === 'A biblioteca tinha 156 livros e recebeu mais 195. Quantos livros há agora?'
      && data.result === 351
    ));
  }
  assert.equal(sawLibraryAddition, true, 'a rodada pode trazer somente a adição da questão oficial da biblioteca');
});

test('o validador barra candidatos com aritmética, categoria, reserva, alternativa ou explicação incorretas', () => {
  const valid = createAv2AdditionQuestion({ category: 'ADD-04', digitCount: 3, random: seededRandom(156195) });
  const mutations = [
    (candidate) => { candidate.data.result += 1; },
    (candidate) => { candidate.data.pattern = 'units'; },
    (candidate) => { candidate.data.trace.carries.toTens = 0; },
    (candidate) => { candidate.pedagogicalCategory = 'ADD-02'; },
    (candidate) => { candidate.correctAnswer += 1; },
    (candidate) => { candidate.options[0] = candidate.options[1]; },
    (candidate) => { candidate.explanation = 'A soma está certa.'; candidate.feedback.correct = 'A soma está certa.'; },
    (candidate) => { candidate.data.a = 1000; },
    (candidate) => { candidate.hints[1].text = 'A resposta é 351.'; },
  ];
  for (const mutate of mutations) {
    const candidate = clone(valid);
    mutate(candidate);
    assert.equal(validateAv2AdditionQuestionCandidate(candidate), false);
  }

  const termsRound = createAv2AdditionRound(seededRandom(32));
  const ordered = clone(termsRound.find(({ type, data }) => type === 'terms' && data.term === 'ordered-addends'));
  ordered.correctAnswer = `${ordered.data.b} e ${ordered.data.a}`;
  assert.equal(validateAv2AdditionQuestionCandidate(ordered), false, 'não aceita parcelas trocadas');
  assert.equal(validateAv2AdditionRound([...termsRound.slice(0, 11), { ...termsRound[11], correctAnswer: -1 }]), false);
});
