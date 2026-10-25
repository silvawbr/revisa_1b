import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FLAT_SHAPES,
  SPATIAL_SHAPES,
  createAdditionQuestion,
  createFlatQuestion,
  createNeighborQuestion,
  createRound,
  createSpatialQuestion,
  createUnknownQuestion,
  createWordQuestion,
  additionRequiresCarry,
  answerForNeighbor,
  buildInverseSentence,
  calculateCarries,
  canAdvance,
  numberToDigits,
  numberToPortuguese,
  validateAdditionAnswer,
  validateQuestionAnswer,
} from '../src/game.js';
import { AV2_ALLOWED_ANSWER_MODES, validateAv2AnswerMode } from '../src/av2/interaction-contract.js';

const constantRandom = (value) => () => value;

test('escreve corretamente todos os números de 0 a 140', () => {
  const expected = new Map([
    [0, 'zero'], [10, 'dez'], [11, 'onze'], [12, 'doze'], [13, 'treze'], [14, 'quatorze'],
    [15, 'quinze'], [16, 'dezesseis'], [17, 'dezessete'], [18, 'dezoito'], [19, 'dezenove'],
    [20, 'vinte'], [21, 'vinte e um'], [99, 'noventa e nove'], [100, 'cem'],
    [101, 'cento e um'], [110, 'cento e dez'], [123, 'cento e vinte e três'], [140, 'cento e quarenta'],
  ]);
  for (let value = 0; value <= 140; value += 1) {
    const word = numberToPortuguese(value);
    assert.ok(word.length > 0);
    assert.ok(!/[0-9]/.test(word));
    if (expected.has(value)) assert.equal(word, expected.get(value));
  }
  for (let value = 101; value <= 140; value += 1) assert.match(numberToPortuguese(value), /^cento e /);
});

test('as figuras planas e espaciais pertencem a conjuntos sem ambiguidade', () => {
  const flatKeys = new Set(FLAT_SHAPES.map((shape) => shape.key));
  const spatialKeys = new Set(SPATIAL_SHAPES.map((shape) => shape.key));
  assert.equal([...flatKeys].some((key) => spatialKeys.has(key)), false);
  for (let index = 0; index < 20; index += 1) {
    const flat = createFlatQuestion(() => (index % 2) / 2 + 0.01);
    const spatial = createSpatialQuestion(() => (index % 2) / 2 + 0.01);
    assert.ok(flatKeys.has(flat.shapeKey));
    assert.ok(spatialKeys.has(spatial.shapeKey));
    assert.ok(['pure', 'object'].includes(flat.representation));
    assert.ok(['solid', 'object'].includes(spatial.representation));
    assert.equal(flat.optionKeys.length, 4);
    assert.equal(spatial.optionKeys.length, 5);
    assert.deepEqual(new Set(flat.optionKeys), flatKeys);
    assert.deepEqual(new Set(spatial.optionKeys), spatialKeys);
    assert.equal(new Set(flat.optionKeys).size, 4);
    assert.equal(new Set(spatial.optionKeys).size, 5);
    assert.equal(flat.optionKeys.includes(flat.shapeKey), true);
    assert.equal(spatial.optionKeys.includes(spatial.shapeKey), true);
    assert.equal(flat.prompt, `Selecione a figura plana correta: ${flat.shapeName}`);
    assert.equal(spatial.prompt, `Selecione a figura geométrica espacial correta: ${spatial.shapeName}`);
    assert.equal(validateQuestionAnswer(flat, flat.shapeKey), true);
    assert.equal(validateQuestionAnswer(spatial, spatial.shapeKey), true);
    assert.equal(validateQuestionAnswer(flat, flat.optionKeys.find((key) => key !== flat.shapeKey)), false);
    assert.equal(validateQuestionAnswer(spatial, spatial.optionKeys.find((key) => key !== spatial.shapeKey)), false);
  }
});

test('as alternativas das figuras mudam de posição entre rodadas', () => {
  const flatOrders = new Set();
  const spatialOrders = new Set();
  const flatCorrectPositions = new Set();
  const spatialCorrectPositions = new Set();
  for (let index = 0; index < 24; index += 1) {
    let seed = index + 1;
    const random = () => {
      seed = (seed * 73 + 41) % 997;
      return seed / 997;
    };
    const flat = createFlatQuestion(random);
    const spatial = createSpatialQuestion(random);
    flatOrders.add(flat.optionKeys.join(','));
    spatialOrders.add(spatial.optionKeys.join(','));
    flatCorrectPositions.add(flat.optionKeys.indexOf(flat.shapeKey));
    spatialCorrectPositions.add(spatial.optionKeys.indexOf(spatial.shapeKey));
  }
  assert.ok(flatOrders.size > 1);
  assert.ok(spatialOrders.size > 1);
  assert.ok(flatCorrectPositions.size > 1);
  assert.ok(spatialCorrectPositions.size > 1);
});

test('toda adição gerada tem reserva e resultado até 140', () => {
  for (let index = 0; index < 100; index += 1) {
    const question = createAdditionQuestion(() => ((index * 37) % 100) / 100);
    assert.ok(question.result <= 140);
    assert.ok(question.a >= 10 && question.a <= 99);
    assert.ok(question.b >= 10 && question.b <= 99);
    assert.equal(additionRequiresCarry(question.a, question.b), true);
    assert.equal(question.result, question.a + question.b);
    assert.deepEqual(question.resultDigits, numberToDigits(question.result));
    assert.deepEqual(question.carries, calculateCarries(question.a, question.b));
    assert.ok(question.carries.toTens === 1 || question.carries.toHundreds === 1);
  }
});

test('as respostas de adição exigem resultado e reservas corretos', () => {
  const question = createAdditionQuestion(constantRandom(0));
  const answer = {
    hundreds: String(question.resultDigits[0]),
    tens: String(question.resultDigits[1]),
    units: String(question.resultDigits[2]),
    toTens: question.carries.toTens === null ? undefined : String(question.carries.toTens),
    toHundreds: question.carries.toHundreds === null ? undefined : String(question.carries.toHundreds),
  };
  assert.equal(validateAdditionAnswer(question, answer), true);
  assert.equal(validateAdditionAnswer(question, { ...answer, units: String((question.resultDigits[2] + 1) % 10) }), false);
  if (question.carries.toTens === 1) assert.equal(validateAdditionAnswer(question, { ...answer, toTens: '0' }), false);
  if (question.carries.toHundreds === 1) assert.equal(validateAdditionAnswer(question, { ...answer, toHundreds: '0' }), false);
});

test('reserva sem carry aceita zero e a tela mantém as duas opções disponíveis', () => {
  const question = createAdditionQuestion(constantRandom(0.05));
  const answer = {
    hundreds: String(question.resultDigits[0]),
    tens: String(question.resultDigits[1]),
    units: String(question.resultDigits[2]),
    toTens: question.carries.toTens === 1 ? '1' : '',
    toHundreds: question.carries.toHundreds === 1 ? '1' : '0',
  };

  assert.equal(validateAdditionAnswer(question, answer), true);

  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /const carryFields = `\$\{field\('toHundreds', 'Reserva para a centena', 'carry-input'\)\}\$\{field\('toTens', 'Reserva para a dezena', 'carry-input'\)\}`/);
  assert.doesNotMatch(app, /question\.carries\.toHundreds === 1 \? field/);
  assert.doesNotMatch(app, /question\.carries\.toTens === 1 \? field/);
});

test('antecessor e sucessor ficam dentro de 0 e 140 em todos os modos', () => {
  for (let index = 0; index < 80; index += 1) {
    const question = createNeighborQuestion(() => ((index * 13) % 99) / 100 + 0.005);
    assert.ok(question.before >= 0 && question.before <= 140);
    assert.ok(question.center >= 1 && question.center <= 139);
    assert.ok(question.after >= 0 && question.after <= 140);
    assert.deepEqual(answerForNeighbor(question), question.mode === 'middle'
      ? { middle: question.center }
      : question.mode === 'before'
        ? { before: question.before }
        : { before: question.before, after: question.after });
    assert.equal(validateQuestionAnswer(question, answerForNeighbor(question)), true);
  }
});

test('questões de escrita têm uma única opção correta', () => {
  for (let index = 0; index < 150; index += 1) {
    const question = createWordQuestion(() => ((index * 17) % 97) / 100 + 0.01);
    assert.equal(question.options.length, 3);
    assert.equal(question.options.filter((option) => option.value === question.value).length, 1);
    if (question.mode === 'number-to-word') {
      assert.equal(question.options.filter((option) => option.label === numberToPortuguese(question.value)).length, 1);
    } else {
      assert.equal(question.options.filter((option) => option.label === String(question.value)).length, 1);
    }
    assert.equal(validateQuestionAnswer(question, question.correctIndex), true);
    assert.equal(validateQuestionAnswer(question, { option: question.correctIndex }), true);
    assert.equal(validateQuestionAnswer(question, (question.correctIndex + 1) % 3), false);
    assert.equal(validateQuestionAnswer(question, { option: (question.correctIndex + 1) % 3 }), false);
  }
});

test('o enunciado de número para extenso não revela a resposta', () => {
  let call = 0;
  const question = createWordQuestion(() => {
    call += 1;
    return call === 1 ? 62 / 141 : 0;
  });

  assert.equal(question.value, 62);
  assert.equal(question.mode, 'number-to-word');
  assert.equal(question.prompt, 'Observe o número 62 e escolha como ele é escrito.');
  assert.equal(question.speech, question.prompt);
  assert.equal(question.prompt.includes(numberToPortuguese(question.value)), false);
});

test('soma com número desconhecido sempre tem uma solução única e inversa correta', () => {
  for (let index = 0; index < 100; index += 1) {
    const question = createUnknownQuestion(() => ((index * 29) % 97) / 100 + 0.01);
    assert.ok(question.result <= 9);
    assert.ok(question.missingValue >= 1 && question.missingValue <= 9);
    assert.equal(question.a + question.b, question.result);
    assert.equal(validateQuestionAnswer(question, question.missingValue), true);
    assert.equal(validateQuestionAnswer(question, question.missingValue + 1), false);
    assert.deepEqual(question.inverse, {
      minuend: question.result,
      subtrahend: question.b,
      difference: question.a,
    });
    assert.equal(buildInverseSentence(question), `${numberToPortuguese(question.inverse.minuend)} menos ${numberToPortuguese(question.inverse.subtrahend)} é igual a ${numberToPortuguese(question.inverse.difference)}.`);
  }
});

test('a progressão só permite avançar após o acerto', () => {
  assert.equal(canAdvance(false), false);
  assert.equal(canAdvance(undefined), false);
  assert.equal(canAdvance(true), true);
});

test('uma rodada tem seis atividades na ordem definida', () => {
  const round = createRound(constantRandom(0));
  assert.deepEqual(round.map((question) => question.type), ['flat', 'spatial', 'neighbor', 'word', 'addition', 'unknown']);
});

test('a revisão original declara um modo de resposta permitido para todas as atividades', () => {
  const round = createRound(constantRandom(0.37));
  assert.equal(round.length, 6);
  for (const question of round) {
    assert.ok(AV2_ALLOWED_ANSWER_MODES.includes(question.answerMode));
    assert.equal(validateAv2AnswerMode(question, { requireDeclared: true }), true);
  }
  assert.equal(round.find(({ type }) => type === 'word').answerMode, 'single-choice');
  assert.ok(round.filter(({ type }) => ['addition', 'neighbor', 'unknown'].includes(type))
    .every(({ answerMode }) => answerMode === 'numeric-input'));
});

test('textos de voz não revelam as respostas das atividades', () => {
  for (let index = 0; index < 40; index += 1) {
    const random = () => ((index * 23) % 97) / 100 + 0.01;
    const round = createRound(random);
    const addition = round[4];
    assert.equal(addition.speech.includes(numberToPortuguese(addition.result)), false);
    const unknown = round[5];
    assert.equal(unknown.speech.includes(numberToPortuguese(unknown.missingValue)), false);
    assert.match(unknown.speech, /número que está faltando/);
    assert.doesNotMatch(unknown.speech, /espaço/);
    const word = round[3];
    if (word.mode === 'word-to-number') assert.equal(word.speech.includes(numberToPortuguese(word.value)), false);
    if (word.mode === 'number-to-word') {
      assert.match(word.speech, /Observe o número/);
      assert.match(word.speech, /escolha como ele é escrito/);
    } else {
      assert.equal(/\d/.test(word.speech), false);
    }
  }
});

test('o campo da soma com número desconhecido começa vazio e preserva a resposta digitada', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /const answer = state\.answer\.value \?\? '';[\s\S]*value="\$\{answer\}"/);
  assert.doesNotMatch(app, /data-unknown-field="\$\{name\}"[^>]*value="\$\{value\}"/);
});

test('os campos de antecessor e sucessor mantêm o foco até completar três algarismos', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /maxlength="3" pattern="\[0-9\]\*" data-neighbor-field/);
  assert.match(app, /function focusNextInput\(input, selector, maxLength = 1\)\s*\{\s*if \(input\.value\.length !== maxLength\) return;/);
  assert.match(app, /focusNextInput\(input, '\[data-neighbor-field\]', 3\);/);
});

test('a ajuda pode ser solicitada ao papai ou à mamãe', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /Pedir ajuda ao papai ou à mamãe/);
  assert.match(app, /Chame o papai ou a mamãe para pensar junto com você/);
});

test('a tela final não renderiza o botão de ouvir parabéns', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const rewardRenderer = app.match(/function renderReward\(\) \{[\s\S]*?\n\}\n\nfunction render\(\)/)?.[0];

  assert.ok(rewardRenderer);
  assert.doesNotMatch(rewardRenderer, /renderSpeechButton\('celebration'/);
  assert.match(rewardRenderer, /data-action="print"/);
  assert.match(rewardRenderer, /data-action="another-coloring-page"/);
  assert.match(rewardRenderer, /data-action="restart"/);
});

test('a impressão reserva somente uma página A4 e a voz usa o endpoint interno', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /lang="pt-BR"/);
  assert.match(css, /@page\s*\{\s*size:\s*A4 portrait/);
  assert.match(css, /\.print-sheet,\s*\.print-sheet \*/);
  assert.match(css, /\.reward-main,\s*\.reward-card\s*\{[\s\S]*?position:\s*static;/);
  assert.match(css, /\.reward-main\s*\{\s*display:\s*block;\s*overflow:\s*visible;/);
  assert.match(css, /\.print-sheet\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*10mm;/);
  assert.match(css, /\.coloring-image\s*\{[^}]*max-width:\s*100%;[^}]*max-height:/);
  assert.doesNotMatch(app, /SpeechSynthesis/);
  assert.match(app, /createTtsClient/);
  assert.match(app, /AbortController/);
  assert.match(app, /URL\.revokeObjectURL/);
  assert.match(app, /Preparando a leitura…/);
  assert.match(app, /kind === 'question' \? 'Ouvir pergunta'/);
});
