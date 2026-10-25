import { normalizeAnimal, isValidAnimal, pickAnimalSuggestions } from './src/data/coloringAnimals.js';
import { AV2_SUBTRACTION_ACTIVITY_ID, createAv2SubtractionRound, validateAv2SubtractionAnswer } from './src/av2/subtraction.js';
import { AV2_SEQUENCES_PROGRESS_STORAGE_KEY, createAv2SequencesRound, validateAv2SequencesAnswer } from './src/av2/sequences.js';
import { renderSubtractionQuestion } from './src/av2/subtraction-layout.js';
import {
  AV2_MONEY_COMPOSITION_ACTIVITY_ID,
  countMoneyCompositionSelection,
  createAv2MoneyCompositionRound,
  formatMoneyCompositionTotal,
  totalMoneyCompositionCents,
  validateAv2MoneyCompositionSelection,
} from './src/av2/money-composition.js';
import {
  ACTIVITY_NAMES,
  FLAT_SHAPES,
  SPATIAL_SHAPES,
  createRound,
  numberToPortuguese,
  numberToDigits,
  validateQuestionAnswer,
  canAdvance,
} from './src/game.js';
import { renderSpatialSvg } from './src/figures.js';
import { createVisualSelectionInteraction } from './src/association-interaction.js';
import {
  REWARD_MESSAGE,
  COLORING_PAGE_HISTORY_KEY,
  LOCAL_COLORING_PAGE_HISTORY_LIMIT,
  createRecentIdStore,
  getColoringPageById,
  isDisplayableColoringPage,
  pickColoringPage,
} from './src/data/coloringPages.js';
import {
  OFFICIAL_COLORING_PAGE_HISTORY_KEY,
  OFFICIAL_COLORING_PAGE_HISTORY_LIMIT,
  pickOfficialColoringPage,
} from './src/data/officialColoringPages.js';
import { createTtsClient } from './src/tts-client.js';
import {
  AV2_REVISION_ID,
  BANKNOTES,
  COINS,
  MONEY_DENOMINATIONS,
  createAv2Round,
  createAv2ShoppingRound,
  validateAv2Answer,
} from './src/av2/money.js';
import {
  AV2_ADDITION_ACTIVITY_ID,
  AV2_ADDITION_ROUND_LENGTH,
  createAv2AdditionRound,
  validateAv2AdditionAnswer,
} from './src/av2/addition.js';
import { renderCduLayout, renderCduLegend } from './src/av2/cdu-layout.js';
import { getAv2ProductIllustration } from './src/av2/product-illustrations.js';
import {
  AV2_ADDITION_PROGRESS_STORAGE_KEY,
  AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY,
  AV2_SUBTRACTION_PROGRESS_STORAGE_KEY,
  AV2_SHOPPING_PROGRESS_STORAGE_KEY,
  createAv2ProgressStore,
} from './src/av2/progress.js';
import {
  AV2_SIMULADO_ACTIVITY_ID,
  AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT,
  AV2_SIMULADO_FULL_COVERAGE_PRESET_ID,
  AV2_SIMULADO_PROGRESS_STORAGE_KEY,
  AV2_SIMULADO_SUBJECTS,
  createAv2SimuladoFocusRound,
  createAv2SimuladoFullCoverageRound,
  createAv2SimuladoRound,
  normalizeAv2SimuladoCounts,
  upgradeLegacyAv2SimuladoQuestion,
  validateAv2SimuladoAnswer,
} from './src/av2/simulado.js';
import { getAv2AnswerMode, validateAv2AnswerMode } from './src/av2/interaction-contract.js';
import {
  createChildProfileStore,
  createPersonalizedMessage,
  formatChildText,
  getNeutralSpeechText,
  isValidChildName,
  normalizeChildName,
} from './src/child-profile.js';

const app = document.querySelector('#app');
const childProfile = createChildProfileStore();
const storedChildName = childProfile.getName();
const coloringPageHistory = createRecentIdStore({
  key: COLORING_PAGE_HISTORY_KEY,
  limit: LOCAL_COLORING_PAGE_HISTORY_LIMIT,
});
const officialColoringPageHistory = createRecentIdStore({
  key: OFFICIAL_COLORING_PAGE_HISTORY_KEY,
  limit: OFFICIAL_COLORING_PAGE_HISTORY_LIMIT,
});
const av2Progress = createAv2ProgressStore();
const av2ShoppingProgress = createAv2ProgressStore({ key: AV2_SHOPPING_PROGRESS_STORAGE_KEY });
const av2AdditionProgress = createAv2ProgressStore({ key: AV2_ADDITION_PROGRESS_STORAGE_KEY });
const av2SubtractionProgress = createAv2ProgressStore({ key: AV2_SUBTRACTION_PROGRESS_STORAGE_KEY });
const av2SimuladoProgress = createAv2ProgressStore({ key: AV2_SIMULADO_PROGRESS_STORAGE_KEY });
const av2SequencesProgress = createAv2ProgressStore({ key: AV2_SEQUENCES_PROGRESS_STORAGE_KEY });
const av2MoneyCompositionProgress = createAv2ProgressStore({ key: AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY });
const moneyById = new Map(MONEY_DENOMINATIONS.map((money) => [money.id, money]));
const simuladoPairColors = ['red', 'green', 'blue', 'yellow'];
let visualSelectionInteraction = null;

const state = {
  screen: storedChildName ? 'home' : 'name',
  activeRevision: 'classic',
  childName: storedChildName,
  childNameDraft: storedChildName ?? '',
  childNameError: false,
  changeChildDialogOpen: false,
  round: [],
  currentIndex: 0,
  correct: false,
  attempts: 0,
  selectedKey: null,
  answer: {},
  activeAddField: null,
  hintVisible: false,
  parentHelp: false,
  rewardPageId: null,
  lastRewardPageId: null,
  unavailableRewardPageIds: new Set(),
  rewardFallback: false,
  generatedRewardImage: null,
  generatingRewardImage: false,
  rewardGenerationError: '',
  animalPickerOpen: false,
  animalDraft: '',
  generatingAnimal: '',
  animalSuggestions: [],
  lastOfficialColoringPageId: null,
  officialOpenFailure: null,
  av2Round: [],
  av2Index: 0,
  av2Correct: false,
  av2Attempts: 0,
  av2Selected: null,
  av2Block: 'block-01',
  av2SimuladoSetup: Object.fromEntries(AV2_SIMULADO_SUBJECTS.map(({ id }) => [id, AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT])),
  av2SequenceAnswer: {},
  av2HintIndex: -1,
  av2AdditionAnswer: {},
  av2AdditionInputError: false,
  av2ActiveAdditionField: null,
  av2Simulation: null,
  av2CompositeStage: 1,
  av2CompositeIntermediate: null,
  av2SimuladoInputError: '',
  av2SimuladoNumericAnswer: '',
  av2Pairing: { selectedGroupId: null, selectedProductId: null, matches: {}, matchColors: {} },
  av2CompositeFirstTry: { addition: true, subtraction: true },
  av2CompositeNotice: '',
  av2MoneySelection: [],
  av2MoneyNextItemId: 0,
  av2MoneySolutions: [],
  av2MoneyFeedback: null,
};

function countSimuladoQuestions(round) {
  const counts = Object.fromEntries(AV2_SIMULADO_SUBJECTS.map(({ id }) => [id, 0]));
  for (const question of round) {
    for (const subjectId of question.simulado?.subjectIds ?? []) counts[subjectId] += 1;
  }
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
}

function recordSimuladoAttempt(question, isCorrect, subjectId = null) {
  const subject = subjectId ?? question?.simulado?.subjectId;
  recordSimuladoStageAttempt(question, isCorrect, subject);
}

function recordSimuladoStageAttempt(question, isCorrect, subjectId) {
  if (state.av2Block !== 'block-07' || !state.av2Simulation || !question?.simulado) return;
  const subject = subjectId ?? question.simulado.subjectId;
  if (isCorrect) return;
  const key = `${question.simulado.questionId}:${subject}`;
  if (!state.av2Simulation.errors.some((target) => target.key === key)) {
    state.av2Simulation.errors.push({
      key,
      subjectId: subject,
      sourceQuestionId: question.simulado.questionId,
      sourceType: question.type,
      contextual: question.simulado.contextual === true || question.simulado.composite === true,
    });
  }
}

const positiveMessageTemplates = [
  ['Você acertou! Parabéns! 🌟', 'Você acertou! Parabéns! Vamos continuar?'],
  ['Muito bem, {name}! 💛', 'Muito bem! Vamos continuar?'],
  ['Excelente! Vamos continuar?', 'Excelente! Vamos continuar?'],
  ['Mandou muito bem! ✨', 'Mandou muito bem! Vamos continuar?'],
];

const retryMessages = [
  'Quase! Vamos tentar novamente?',
  'Observe com calma e tente mais uma vez.',
  'Quer revisar este assunto?',
  'Tudo bem tentar de novo! 💛',
];

const ttsClient = createTtsClient();
const speech = {
  available: true,
  active: null,
  token: 0,
  message: '',
  messageTimer: null,
};

function updateSpeechButtons() {
  document.querySelectorAll('[data-speech-button]').forEach((button) => {
    const active = speech.active?.kind === button.dataset.speechButton;
    const loading = active && speech.active.phase === 'loading';
    button.dataset.speaking = active ? 'true' : 'false';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-busy', String(loading));
    button.disabled = loading;
    button.setAttribute('aria-label', active ? 'Parar leitura' : button.dataset.defaultLabel);
    button.querySelector('.speech-label').textContent = active ? 'Parar leitura' : button.dataset.defaultLabel;
    button.querySelector('.speech-icon').textContent = active ? '■' : '🔊';
  });
  const status = document.querySelector('[data-speech-status]');
  if (status) {
    status.textContent = speech.active?.phase === 'loading'
      ? 'Preparando a leitura…'
      : speech.active?.phase === 'playing'
        ? 'Leitura em andamento.'
        : speech.message;
  }
}

function cancelSpeech() {
  speech.token += 1;
  speech.active?.controller?.abort();
  if (speech.active?.audio) {
    speech.active.audio.pause();
    speech.active.audio.currentTime = 0;
  }
  if (speech.active?.url) URL.revokeObjectURL(speech.active.url);
  speech.active = null;
  speech.message = '';
  if (speech.messageTimer) clearTimeout(speech.messageTimer);
  speech.messageTimer = null;
  if (typeof document !== 'undefined') updateSpeechButtons();
}

function showSpeechMessage(message) {
  speech.message = message;
  if (speech.messageTimer) clearTimeout(speech.messageTimer);
  speech.messageTimer = setTimeout(() => {
    speech.message = '';
    speech.messageTimer = null;
    updateSpeechButtons();
  }, 3500);
  updateSpeechButtons();
}

async function speak(kind, text) {
  if (!speech.available) return;
  if (speech.active?.kind === kind) {
    cancelSpeech();
    return;
  }

  cancelSpeech();
  const token = speech.token;
  const controller = new AbortController();
  speech.active = { kind, token, controller, phase: 'loading' };
  updateSpeechButtons();
  try {
    const blob = await ttsClient.getAudio(text, controller.signal);
    if (speech.token !== token) return;

    const url = URL.createObjectURL(blob);
    speech.active = { kind, token, controller, phase: 'loading', url };
    const audio = new Audio(url);
    speech.active = { kind, token, controller, phase: 'playing', audio, url };
    audio.addEventListener('ended', () => {
      if (speech.token === token) cancelSpeech();
    });
    audio.addEventListener('error', () => {
      if (speech.token === token) {
        cancelSpeech();
        showSpeechMessage('A leitura não está disponível agora.');
      }
    });
    updateSpeechButtons();
    await audio.play();
  } catch (error) {
    if (speech.token === token) {
      cancelSpeech();
      if (error?.name !== 'AbortError') showSpeechMessage('A leitura não está disponível agora.');
    }
  }
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', cancelSpeech);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function currentChildName() {
  return normalizeChildName(state.childName) ?? '';
}

function createPositiveMessage(index) {
  const [visualTemplate, speechText] = positiveMessageTemplates[index % positiveMessageTemplates.length];
  return createPersonalizedMessage({
    childName: currentChildName(),
    visualTemplate,
    speechText,
  });
}

function createRewardMessage() {
  return createPersonalizedMessage({
    childName: currentChildName(),
    visualTemplate: REWARD_MESSAGE,
    speechText: 'Você terminou a revisão! Escolha suas cores e divirta-se!',
  });
}

function renderSpeechButton(kind, speechText, customLabel = null) {
  const label = customLabel ?? (kind === 'question' ? 'Ouvir pergunta' : kind === 'celebration' ? 'Ouvir parabéns' : 'Ouvir explicação');
  const neutralSpeechText = getNeutralSpeechText(speechText);
  const active = speech.active?.kind === kind;
  const loading = active && speech.active.phase === 'loading';
  return `<button class="speech-button${active ? ' is-speaking' : ''}" type="button" data-speech-button="${kind}" data-speech-text="${escapeAttribute(neutralSpeechText)}" data-default-label="${label}" aria-label="${active ? 'Parar leitura' : label}" aria-pressed="${active}" aria-busy="${loading}" data-speaking="${active}"${loading ? ' disabled' : ''}>
    <span class="speech-icon" aria-hidden="true">${active ? '■' : '🔊'}</span><span class="speech-label">${active ? 'Parar leitura' : label}</span>
  </button>`;
}

function renderProgress() {
  return `<div class="progress-dots" aria-label="Progresso: atividade ${state.currentIndex + 1} de 6">
    ${ACTIVITY_NAMES.map((name, index) => `<span class="progress-dot ${index < state.currentIndex ? 'is-complete' : ''} ${index === state.currentIndex ? 'is-current' : ''}" title="${name}" aria-hidden="true">${index < state.currentIndex ? '★' : '☆'}</span>`).join('')}
  </div>`;
}

function renderGuide(message = 'Vamos com calma! Você consegue!') {
  const guideLabel = formatChildText('Luna, uma gatinha professora, está torcendo por {name}.', currentChildName());
  return `<div class="guide" role="img" aria-label="${escapeAttribute(guideLabel || 'Luna, uma gatinha professora está aqui para ajudar.')}">
    <div class="cat-avatar" aria-hidden="true"><span class="cat-ear left"></span><span class="cat-ear right"></span><span class="cat-face"><i></i><i></i><b></b><em></em></span><span class="cat-book">＋</span></div>
    <p class="guide-bubble">${escapeHtml(message)}</p>
  </div>`;
}

function renderHeader() {
  return `<header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="Voltar para a apresentação">${escapeHtml(currentChildName())} <span>★</span></a>
    ${renderProgress()}
    <div class="header-actions">
      <button class="change-child-button" type="button" data-action="change-child" aria-label="Trocar criança">Trocar criança</button>
      <button class="restart-button" type="button" data-action="restart" aria-label="Começar uma nova rodada">↻ <span>Recomeçar</span></button>
    </div>
  </header>`;
}

function renderFlatGraphic(question) {
  const objectNames = {
    circle: 'moeda vista de frente',
    triangle: 'bandeirinha triangular',
    rectangle: 'livro visto de frente',
    square: 'azulejo quadrado',
  };
  const detail = question.representation === 'object' ? `<span class="object-detail" aria-hidden="true">${question.shapeKey === 'circle' ? '✦' : question.shapeKey === 'triangle' ? '!' : question.shapeKey === 'rectangle' ? 'ABC' : '＋'}</span>` : '';
  const label = question.representation === 'object'
    ? `Ilustração bidimensional inspirada em ${objectNames[question.shapeKey]}`
    : 'Ilustração bidimensional de uma figura plana';
  return `<div class="flat-graphic ${question.shapeKey} ${question.representation}" role="img" aria-label="${label}"><span class="shape-surface"></span>${detail}</div>`;
}

function renderSpatialGraphic(question) {
  const objectNames = {
    cube: 'dado',
    'rectangular-block': 'caixa de sapatos',
    cylinder: 'lata',
    cone: 'chapéu de festa',
    sphere: 'bola',
  };
  const label = question.representation === 'object'
    ? `Ilustração tridimensional inspirada em ${objectNames[question.shapeKey]}`
    : 'Ilustração tridimensional de um sólido geométrico';
  return `<div class="spatial-graphic ${question.shapeKey} ${question.representation}" role="img" aria-label="${label}">${renderSpatialSvg(question.shapeKey, question.representation)}</div>`;
}

function questionForShape(question, shape) {
  return {
    ...question,
    shapeKey: shape.key,
    shapeName: shape.name,
    spokenShapeName: shape.spoken,
  };
}

function renderShapeSelectionQuestion(question) {
  const isFlat = question.type === 'flat';
  const shapeCatalog = isFlat ? FLAT_SHAPES : SPATIAL_SHAPES;
  const optionDescriptions = isFlat
    ? {
      circle: 'forma redonda',
      triangle: 'forma com três lados',
      rectangle: 'forma com dois lados longos e dois curtos',
      square: 'forma com quatro lados iguais',
    }
    : {
      cube: 'sólido com seis faces quadradas',
      'rectangular-block': 'sólido com faces retangulares',
      cylinder: 'sólido com duas bases redondas',
      cone: 'sólido com uma ponta e uma base redonda',
      sphere: 'sólido completamente redondo',
    };
  const shapes = (question.optionKeys ?? shapeCatalog.map(({ key }) => key))
    .map((key) => shapeCatalog.find((shape) => shape.key === key))
    .filter(Boolean);
  const visualOptions = shapes.map((shape, index) => {
    const shapeQuestion = questionForShape(question, shape);
    const visual = isFlat ? renderFlatGraphic(shapeQuestion) : renderSpatialGraphic(shapeQuestion);
    const selected = state.selectedKey === shape.key;
    const incorrect = selected && !state.correct && state.attempts > 0;
    return `<button class="shape-option ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-shape-option="${shape.key}" aria-label="Alternativa visual ${index + 1} de ${shapes.length}: ${optionDescriptions[shape.key]}" aria-describedby="shape-selection-instruction" aria-pressed="${selected}" ${state.correct ? 'disabled' : ''}>
        ${visual}
      </button>`;
  }).join('');
  const status = state.correct
    ? `Você acertou! Esta é a figura ${question.spokenShapeName}.`
    : state.attempts > 0
      ? 'Observe com calma e escolha outra figura.'
      : 'Escolha a figura que corresponde ao nome.';
  return `<div class="shape-selection ${isFlat ? 'flat-shape-selection' : 'spatial-shape-selection'}">
    <p class="shape-selection-instruction" id="shape-selection-instruction">Selecione a figura correta.</p>
    <div class="shape-options" role="group" aria-label="Alternativas visuais">
      ${visualOptions}
    </div>
    <p class="shape-selection-status" aria-live="polite">${status}</p>
  </div>`;
}

function renderAdditionQuestion(question) {
  const [aHundreds, aTens, aUnits] = numberToDigits(question.a);
  const [bHundreds, bTens, bUnits] = numberToDigits(question.b);
  const answer = state.answer;
  const field = (name, label, extra = '') => `<input class="digit-input ${extra}" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" data-add-field="${name}" aria-label="${label}" value="${answer[name] ?? ''}">`;
  const carryFields = `${field('toHundreds', 'Reserva para a centena', 'carry-input')}${field('toTens', 'Reserva para a dezena', 'carry-input')}`;
  return `<div class="addition-wrap">
    <div class="legend" aria-label="Legenda das posições"><span><b>C</b> centena</span><span><b>D</b> dezena</span><span><b>U</b> unidade</span></div>
    <div class="addition-board" aria-label="Adição vertical com centena, dezena e unidade">
      <div class="addition-row position-row"><span></span><b>C</b><b>D</b><b>U</b></div>
      <div class="addition-row carry-row"><span class="carry-label">reserva</span>${carryFields}<span></span></div>
      <div class="addition-row"><span></span><span>${aHundreds}</span><span>${aTens}</span><span>${aUnits}</span></div>
      <div class="addition-row"><span class="operator" aria-label="mais">+</span><span>${bHundreds}</span><span>${bTens}</span><span>${bUnits}</span></div>
      <div class="addition-line" aria-hidden="true"></div>
      <div class="addition-row answer-row"><span></span>${field('hundreds', 'Centena do resultado')}${field('tens', 'Dezena do resultado')}${field('units', 'Unidade do resultado')}</div>
    </div>
    <p class="addition-note">Some primeiro as unidades, depois as dezenas e as centenas.</p>
    <div class="number-pad" aria-label="Teclado numérico">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `<button type="button" data-pad-digit="${digit}">${digit}</button>`).join('')}
      <button type="button" class="pad-clear" data-pad-clear>Limpar</button>
    </div>
    <button class="primary-button check-button" type="button" data-action="check-answer">Conferir resposta <span aria-hidden="true">→</span></button>
  </div>`;
}

function renderNeighborQuestion(question) {
  const answer = state.answer;
  let sequence;
  if (question.mode === 'middle') {
    sequence = `<span>${question.before}</span>${numberInput('middle', 'Número que está entre os dois', answer.middle)}<span>${question.after}</span>`;
  } else if (question.mode === 'before') {
    sequence = `${numberInput('before', 'Número que vem antes', answer.before)}<span>${question.center}</span><span>${question.after}</span>`;
  } else {
    sequence = `${numberInput('before', 'Número que vem antes', answer.before)}<span>${question.center}</span>${numberInput('after', 'Número que vem depois', answer.after)}`;
  }
  return `<div class="neighbor-wrap"><div class="number-sequence" aria-label="Sequência de números">${sequence}</div>
    <p class="sequence-help">Conte de um em um para descobrir os vizinhos.</p>
    <button class="primary-button check-button" type="button" data-action="check-answer">Conferir resposta <span aria-hidden="true">→</span></button>
  </div>`;
}

function numberInput(name, label, value = '') {
  return `<input class="sequence-input" type="text" inputmode="numeric" maxlength="3" pattern="[0-9]*" data-neighbor-field="${name}" aria-label="${label}" value="${value ?? ''}">`;
}

function renderWordQuestion(question) {
  const selected = state.answer.option;
  const lead = question.mode === 'number-to-word'
    ? `<div class="number-prompt"><span>Número</span><strong>${question.value}</strong></div>`
    : `<div class="word-prompt cursive-text">${numberToPortuguese(question.value)}</div>`;
  return `<div class="word-wrap">${lead}<div class="word-options" role="radiogroup" aria-label="Opções de resposta">
    ${question.options.map((option, index) => `<button class="word-option ${selected === index ? 'is-selected' : ''}" type="button" role="radio" aria-checked="${selected === index}" data-word-option="${index}">${option.label}</button>`).join('')}
  </div>
  <button class="primary-button check-button" type="button" data-action="check-answer" ${selected === undefined ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button></div>`;
}

function renderUnknownQuestion(question) {
  const answer = state.answer.value ?? '';
  const valuePart = (name, label, value, hidden) => hidden
    ? `<input class="unknown-input" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" data-unknown-field="${name}" aria-label="${label}" value="${answer}">`
    : `<span>${value}</span>`;
  return `<div class="unknown-wrap">
    <div class="unknown-equation" aria-label="Soma com um número faltando">
      ${valuePart('left', 'Número que está faltando', question.a, question.format === 'missing-left')}
      <span aria-label="mais">＋</span>
      ${valuePart('right', 'Número que está faltando', question.b, question.format === 'missing-right')}
      <span aria-label="é igual a">＝</span>
      ${valuePart('result', 'Número que está faltando', question.result, question.format === 'missing-result')}
    </div>
    <div class="counting-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <p class="unknown-help">Pense em quantos faltam para completar a soma.</p>
    <button class="primary-button check-button" type="button" data-action="check-answer">Conferir resposta <span aria-hidden="true">→</span></button>
  </div>`;
}

function renderColoringAttribution(page) {
  if (!page?.sourceUrl || !page?.licenseUrl) return '';
  return `<p class="coloring-attribution" data-print-attribution>
    Desenho: <a href="${escapeAttribute(page.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(page.title)}</a>
    — por ${escapeHtml(page.author)}
    — <a href="${escapeAttribute(page.licenseUrl)}" target="_blank" rel="noreferrer">${escapeHtml(page.license)}</a>
  </p>`;
}

function renderColoringPage(page) {
  if (state.generatedRewardImage) {
    return `<div class="print-sheet" data-coloring-page-id="generated-openrouter" data-orientation="portrait">
      <img class="coloring-image" data-generated-coloring-image src="${escapeAttribute(state.generatedRewardImage.src)}" alt="${escapeAttribute(`Desenho de ${state.generatedRewardImage.animal} para colorir.`)}" decoding="async">
      <p class="coloring-attribution">Desenho criado sob demanda com OpenRouter.</p>
    </div>`;
  }
  if (!page || !isDisplayableColoringPage(page)) {
    return `<div class="print-sheet print-fallback" data-orientation="portrait" role="status">
      <p>Não foi possível carregar o desenho. Confira a conexão e toque em “Ver outro desenho”.</p>
    </div>`;
  }
  return `<div class="print-sheet" data-coloring-page-id="${page.id}" data-orientation="${page.orientation}">
    <img class="coloring-image" data-coloring-image="${page.id}" src="${escapeAttribute(page.src)}" alt="${escapeAttribute(page.alt)}" decoding="async" referrerpolicy="no-referrer">
    ${renderColoringAttribution(page)}
  </div>`;
}

function renderExplanation(question) {
  if (question.type === 'addition') {
    return `<div class="written-reinforcement"><span>A soma de:</span><strong>${numberToPortuguese(question.a)}</strong><span>e</span><strong>${numberToPortuguese(question.b)}</strong><span>é</span><strong>${numberToPortuguese(question.result)}</strong></div>`;
  }
  if (question.type === 'neighbor') {
    return `<div class="sequence-reveal"><span>${question.before}</span><b>${question.center}</b><span>${question.after}</span><p>${question.explanation}</p></div>`;
  }
  if (question.type === 'word') {
    return `<div class="word-reinforcement"><strong>${question.value}</strong><span>é escrito como</span><strong class="cursive-text">${numberToPortuguese(question.value)}</strong></div>`;
  }
  if (question.type === 'unknown') {
    return `<div class="inverse-reveal"><div class="inverse-equation">${question.inverse.minuend} − ${question.inverse.subtrahend} = ${question.inverse.difference}</div><div class="inverse-dots" aria-hidden="true">${Array.from({ length: question.result }, (_, index) => `<i class="${index < question.inverse.subtrahend ? 'is-taken' : ''}"></i>`).join('')}</div><p>${question.explanation}</p></div>`;
  }
  return `<p class="shape-reinforcement">${question.explanation}</p>`;
}

function renderFeedback(question) {
  if (state.correct) {
    const positiveMessage = createPositiveMessage(state.currentIndex);
    return `<div class="feedback success-feedback" role="status" aria-live="polite">
      <p class="feedback-title">${escapeHtml(positiveMessage.visualText)}</p>
      ${renderExplanation(question)}
      <div class="feedback-actions">
        ${renderSpeechButton('explanation', question.explanation)}
        <button class="primary-button next-button" type="button" data-action="next" autofocus>Próximo <span aria-hidden="true">→</span></button>
      </div>
    </div>`;
  }
  if (state.attempts === 0) return '';
  const hint = getHint(question);
  return `<div class="feedback retry-feedback" role="alert" aria-live="polite">
    <p class="feedback-title">${retryMessages[(state.attempts - 1) % retryMessages.length]}</p>
    ${state.attempts >= 2 ? `<div class="help-actions"><button class="secondary-button" type="button" data-action="hint">💡 Ver uma dica</button><button class="secondary-button" type="button" data-action="parent-help">🤝 Pedir ajuda ao papai ou à mamãe</button></div>` : ''}
    ${state.hintVisible ? `<p class="hint-box"><b>Dica:</b> ${hint}</p>` : ''}
    ${state.parentHelp ? '<p class="hint-box"><b>Ajuda:</b> Chame o papai ou a mamãe para pensar junto com você. Você está aprendendo!</p>' : ''}
  </div>`;
}

function getHint(question) {
  const hints = {
    flat: 'Observe os contornos e os cantinhos da figura. O nome conta uma pista.',
    spatial: 'Veja se a forma ocupa espaço e tem volume, como um objeto que podemos pegar.',
    addition: 'Comece pelas unidades. Quando a soma passar de nove, a reserva vai para a próxima coluna.',
    neighbor: 'Conte um número para trás e um número para frente, sempre de um em um.',
    word: 'Leia as dezenas e depois observe com atenção a unidade.',
    unknown: 'Pense em quantos faltam para completar o número que aparece do outro lado do sinal.',
  };
  return hints[question.type];
}

function renderExercise(question) {
  if (question.type === 'flat' || question.type === 'spatial') return renderShapeSelectionQuestion(question);
  if (question.type === 'addition') return renderAdditionQuestion(question);
  if (question.type === 'neighbor') return renderNeighborQuestion(question);
  if (question.type === 'word') return renderWordQuestion(question);
  return renderUnknownQuestion(question);
}

function renderGame() {
  const question = state.round[state.currentIndex];
  if (!validateAv2AnswerMode(question, { requireDeclared: true })) {
    throw new TypeError(`A questão ${question?.type ?? 'sem tipo'} não declarou uma interação permitida.`);
  }
  const guideMessage = state.correct ? 'Que conquista linda! Observe a explicação.' : 'Vamos com calma! Você consegue!';
  const prompt = question.type === 'flat' || question.type === 'spatial'
    ? `<span class="shape-prompt-label">${escapeHtml(question.promptLabel)}</span> <strong class="shape-name-prompt">${escapeHtml(question.shapeName)}</strong>`
    : escapeHtml(question.prompt);
  return `<div class="site-shell game-screen">
    ${renderHeader()}
    <main class="main-content">
      <div class="question-topline"><span class="activity-badge">Atividade ${state.currentIndex + 1}</span><span class="activity-count">${ACTIVITY_NAMES[state.currentIndex]}</span></div>
      <div class="question-heading"><div><h1 id="question-title">${ACTIVITY_NAMES[state.currentIndex]}</h1></div>${renderGuide(guideMessage)}</div>
      <section class="question-card" aria-labelledby="question-title">
        <div class="prompt-row"><p class="prompt" id="question-prompt">${prompt}</p>${renderSpeechButton('question', question.speech)}</div>
        <span class="speech-status" data-speech-status role="status" aria-live="polite"></span>
        <div class="exercise-area" data-answer-mode="${question.answerMode}">${renderExercise(question)}</div>
        ${renderFeedback(question)}
      </section>
    </main>
  </div>`;
}

function renderNameScreen() {
  const hasError = state.childNameError;
  const errorMessage = 'Digite seu primeiro nome ou apelido para continuar. 💛';
  return `<div class="site-shell home-screen name-screen">
    <main class="home-main">
      <div class="home-decor decor-one" aria-hidden="true">2</div><div class="home-decor decor-two" aria-hidden="true">★</div><div class="home-decor decor-three" aria-hidden="true">5</div>
      <section class="home-card profile-name-panel" aria-labelledby="child-name-title">
        <div class="home-art" aria-hidden="true"><span class="home-circle">6</span><span class="home-triangle"></span><span class="home-square">＋</span><span class="home-star">★</span></div>
        <p class="eyebrow">1º ano Vita</p>
        <h1 id="child-name-title">Bem-vinda! Bem-vindo! 🌟</h1>
        <p class="home-subtitle">Como você gostaria de ser chamada ou chamado?</p>
        <form class="child-name-form" data-child-name-form novalidate>
          <label for="child-name">Seu primeiro nome ou apelido</label>
          <input id="child-name" name="childName" type="text" maxlength="40" autocomplete="nickname" placeholder="Seu primeiro nome ou apelido" value="${escapeAttribute(state.childNameDraft)}" aria-describedby="child-name-help${hasError ? ' child-name-error' : ''}"${hasError ? ' aria-invalid="true"' : ''} autofocus>
          <p id="child-name-help" class="name-help">Use apenas seu primeiro nome ou apelido.</p>
          <p id="child-name-error" class="name-error" role="alert"${hasError ? '' : ' hidden'}>${errorMessage}</p>
          <button class="primary-button start-button" type="submit" data-child-name-submit ${isValidChildName(state.childNameDraft) ? '' : 'disabled'}>Continuar <span aria-hidden="true">→</span></button>
        </form>
        ${renderGuide('Estou aqui para torcer por você!')}
        <p class="privacy-note">Seu nome fica somente neste navegador.</p>
      </section>
    </main>
  </div>`;
}

function renderHome() {
  const av2RoundsCompleted = av2SimuladoProgress.get().roundsCompleted;
  return `<div class="site-shell home-screen">
    <main class="home-main">
      <div class="home-decor decor-one" aria-hidden="true">2</div><div class="home-decor decor-two" aria-hidden="true">★</div><div class="home-decor decor-three" aria-hidden="true">5</div>
      <section class="home-card home-dashboard-card" aria-labelledby="home-title">
        <div class="home-art" aria-hidden="true"><span class="home-circle">6</span><span class="home-triangle"></span><span class="home-square">＋</span><span class="home-star">★</span></div>
        <p class="eyebrow">1º ano Vita · Uma aventura de aprender</p>
        <h1 id="home-title">Revisão de Matemática<br><span>de ${escapeHtml(currentChildName())}</span></h1>
        <p class="home-subtitle">Comece pelo simulado ou escolha uma revisão para praticar.</p>
        <section class="simulation-feature" aria-labelledby="simulation-title">
          <div class="simulation-feature-art" aria-hidden="true">✏️</div>
          <div class="simulation-feature-content">
            <p class="simulation-kicker">Preparação para a prova</p>
            <h2 id="simulation-title">Simulado AV2</h2>
            <p>Revise todos os assuntos da AV2 ou escolha quais quer praticar.</p>
            <p class="simulation-progress">Simulados concluídos: <strong>${av2RoundsCompleted}</strong></p>
            <button class="primary-button simulation-start-button" type="button" data-action="open-av2-simulado-setup">Preparar simulado <span aria-hidden="true">→</span></button>
          </div>
        </section>
        <section class="home-review-section" aria-labelledby="home-reviews-title">
          <h2 id="home-reviews-title">Revisões por assunto</h2>
          <p>Escolha uma área para praticar no seu ritmo.</p>
          <div class="revision-choices" aria-label="Outras revisões de Matemática">
            <button class="primary-button revision-choice" type="button" data-action="start"><span class="revision-choice-title">1ª revisão</span><span class="revision-choice-copy">Formas, números e desafios</span><span class="revision-choice-arrow" aria-hidden="true">→</span></button>
            <button class="secondary-button revision-choice av2-choice" type="button" data-action="av2-entry"><span class="revision-choice-title">Reforço AV2 por assunto</span><span class="revision-choice-copy">Dinheiro, operações, sequências e compras</span><span class="revision-choice-arrow" aria-hidden="true">→</span></button>
          </div>
        </section>
        ${renderGuide('Estou aqui para torcer por você!')}
        <button class="change-child-home" type="button" data-action="change-child">Trocar criança</button>
        <p class="privacy-note">Sem cadastro. Só brincadeira e aprendizado.</p>
      </section>
    </main>
  </div>`;
}

function renderMoneyIllustration(money) {
  const visualType = money.kind === 'coin' ? 'money-coin' : 'money-note';
  return `<div class="money-illustration ${visualType}" role="img" aria-label="${escapeAttribute(money.description)}">
    <span class="money-image-fallback" aria-hidden="true">${escapeHtml(money.label)}</span>
    <img class="money-object-image" src="${escapeAttribute(money.imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
  </div>`;
}

function renderAv2Home() {
  const sampleCoin = COINS.find(({ id }) => id === 'coin-50-centavos');
  const sampleNote = BANKNOTES.find(({ id }) => id === 'note-20-reais');
  const roundsCompleted = av2Progress.get().roundsCompleted;
  const shoppingRoundsCompleted = av2ShoppingProgress.get().roundsCompleted;
  const additionRoundsCompleted = av2AdditionProgress.get().roundsCompleted;
  const sequenceRoundsCompleted = av2SequencesProgress.get().roundsCompleted;
  const compositionRoundsCompleted = av2MoneyCompositionProgress.get().roundsCompleted;
  return `<div class="site-shell home-screen av2-home-screen">
    <main class="home-main">
      <section class="home-card av2-home-card" aria-labelledby="av2-home-title">
        <p class="eyebrow">Reforço AV2 por assunto · Revisão para 27 de outubro</p>
        <h1 id="av2-home-title">AV2 Matemática<br><span>Escolha uma atividade</span></h1>
        <div class="av2-activity-grid" aria-label="Atividades da AV2 de Matemática">
          <article class="av2-activity-card">
            <h2>Dinheiro</h2>
            <p>Reconheça moedas e cédulas, compare valores e descubra equivalências.</p>
            <div class="av2-samples" aria-label="Moeda e cédula brasileiras">
              ${renderMoneyIllustration(sampleCoin)}
              ${renderMoneyIllustration(sampleNote)}
            </div>
            <p class="av2-progress-summary" data-av2-rounds-completed>Rodadas concluídas: <strong>${roundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2">Começar <span aria-hidden="true">→</span></button>
          </article>
          <article class="av2-activity-card shopping-activity-card">
            <span class="shopping-activity-icon" aria-hidden="true">🧮</span>
            <h2>Compras e troco</h2>
            <p>Some preços, compare produtos e descubra quanto sobra.</p>
            <div class="shopping-activity-samples" aria-hidden="true"><span>🪙</span><span>✏️</span><span>⭐</span></div>
            <p class="av2-progress-summary" data-shopping-rounds-completed>Rodadas concluídas: <strong>${shoppingRoundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2-shopping">Começar <span aria-hidden="true">→</span></button>
          </article>
          <article class="av2-activity-card addition-activity-card">
            <span class="addition-activity-icon" aria-hidden="true">➕</span>
            <h2>Adição com reagrupamento</h2>
            <p>Some dezenas e centenas, use o vai um e descubra as parcelas e o total.</p>
            <div class="addition-activity-sample" aria-label="Exemplo de adição: 156 mais 195">156 + 195 = ?</div>
            <p class="av2-progress-summary" data-addition-rounds-completed>Rodadas concluídas: <strong>${additionRoundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2-addition">Começar <span aria-hidden="true">→</span></button>
          </article>
          <article class="av2-activity-card sequences-activity-card">
            <span class="addition-activity-icon" aria-hidden="true">🔢</span>
            <h2>Sequências e números por extenso</h2>
            <p>Complete sequências e tabelas, descubra vizinhos e escolha a escrita correta dos números.</p>
            <div class="addition-activity-sample" aria-label="Exemplo: 208 por extenso">208 → duzentos e oito</div>
            <p class="av2-progress-summary">Rodadas concluídas: <strong>${sequenceRoundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2-sequences">Começar <span aria-hidden="true">→</span></button>
          </article>
          <article class="av2-activity-card money-composition-activity-card">
            <span class="addition-activity-icon" aria-hidden="true">🪙</span>
            <h2>Formar quantias</h2>
            <p>Junte moedas e cédulas, forme valores e descubra equivalências.</p>
            <div class="addition-activity-sample" aria-label="Exemplo: duas moedas de 50 centavos formam 1 real">50 + 50 = 1 real</div>
            <p class="av2-progress-summary">Rodadas concluídas: <strong>${compositionRoundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2-money-composition">Começar <span aria-hidden="true">→</span></button>
          </article>
          <article class="av2-activity-card subtraction-activity-card">
            <span class="addition-activity-icon" aria-hidden="true">➖</span>
            <h2>Subtração com reagrupamento</h2>
            <p>Subtraia dezenas e centenas, descubra as trocas e os termos da subtração.</p>
            <div class="addition-activity-sample" aria-label="Exemplo de subtração: 351 menos 147">351 − 147 = ?</div>
            <p class="av2-progress-summary" data-subtraction-rounds-completed>Rodadas concluídas: <strong>${av2SubtractionProgress.get().roundsCompleted}</strong></p>
            <button class="primary-button start-button" type="button" data-action="start-av2-subtraction">Começar <span aria-hidden="true">→</span></button>
          </article>
        </div>
        <button class="secondary-button av2-back-button" type="button" data-action="home">Voltar às revisões</button>
        ${renderGuide('Moedas e cédulas têm valores diferentes. Vamos descobrir!')}
      </section>
    </main>
  </div>`;
}

function renderAv2SimuladoSetup() {
  const selectedCount = Object.keys(state.av2SimuladoSetup).filter((id) => state.av2SimuladoSetup[id] > 0).length;
  const topics = AV2_SIMULADO_SUBJECTS.map(({ id, label, description }) => {
    const enabled = state.av2SimuladoSetup[id] > 0;
    const count = enabled ? state.av2SimuladoSetup[id] : AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT;
    return `<div class="simulado-topic-option">
      <input id="simulado-subject-${id}" type="checkbox" data-simulado-subject="${id}" ${enabled ? 'checked' : ''}>
      <label class="simulado-topic-copy" for="simulado-subject-${id}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></label>
      <span class="simulado-count-control"><span>Questões</span><select data-simulado-count="${id}" aria-label="Quantidade de questões de ${escapeAttribute(label)}" ${enabled ? '' : 'disabled'}>${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${value === count ? 'selected' : ''}>${value}</option>`).join('')}</select></span>
    </div>`;
  }).join('');
  return `<div class="site-shell home-screen av2-home-screen">
    <main class="home-main">
      <section class="home-card av2-home-card simulado-setup-card" aria-labelledby="simulado-setup-title">
        <p class="eyebrow">Simulado AV2</p>
        <h1 id="simulado-setup-title">Prepare a revisão<br><span>de ${escapeHtml(currentChildName())}</span></h1>
        <p class="home-subtitle">Pratique alguns assuntos ou faça a revisão completa da escola.</p>
        <section class="simulado-full-preset" aria-labelledby="simulado-full-preset-title">
          <h2 id="simulado-full-preset-title">Revisão completa AV2</h2>
          <p>Pratique equivalências, compras, tabela numérica, reconhecimento de números por extenso e o problema encadeado da biblioteca.</p>
          <button class="primary-button" type="button" data-action="start-av2-full-simulado">Começar revisão completa <span aria-hidden="true">→</span></button>
        </section>
        <p class="simulado-custom-heading">Ou personalize sua prática</p>
        <fieldset class="simulado-topic-list">
          <legend>Assuntos do simulado</legend>
          ${topics}
        </fieldset>
        <p class="simulado-setup-note">${selectedCount ? `${selectedCount} assunto${selectedCount === 1 ? '' : 's'} selecionado${selectedCount === 1 ? '' : 's'}. Cada assunto mantém a quantidade escolhida.` : 'Selecione pelo menos um assunto para começar.'}</p>
        <button class="primary-button start-button" type="button" data-action="start-av2-simulado" ${selectedCount ? '' : 'disabled'}>Começar simulado personalizado <span aria-hidden="true">→</span></button>
        <button class="secondary-button av2-back-button" type="button" data-action="home">Voltar às revisões</button>
        ${renderGuide('Vamos revisar vários assuntos. Você consegue!')}
      </section>
    </main>
  </div>`;
}

function readAv2SimuladoSetup() {
  const counts = {};
  for (const { id } of AV2_SIMULADO_SUBJECTS) {
    const enabled = document.querySelector(`[data-simulado-subject="${id}"]`)?.checked;
    const count = Number(document.querySelector(`[data-simulado-count="${id}"]`)?.value);
    if (enabled && Number.isInteger(count) && count >= 1 && count <= 5) counts[id] = count;
  }
  return counts;
}

function renderAv2Progress() {
  const total = state.av2Round.length || (state.av2Block === 'block-03' ? AV2_ADDITION_ROUND_LENGTH : 10);
  return `<div class="av2-progress" role="img" aria-label="Progresso: questão ${state.av2Index + 1} de ${total}">
    ${Array.from({ length: total }, (_, index) => `<span class="av2-progress-dot ${index < state.av2Index ? 'is-complete' : ''} ${index === state.av2Index ? 'is-current' : ''}" aria-hidden="true">${index < state.av2Index ? '★' : '☆'}</span>`).join('')}
  </div>`;
}

function renderAv2Header() {
  return `<header class="topbar av2-topbar">
    <span class="brand av2-brand">${escapeHtml(currentChildName())} <span aria-hidden="true">★</span></span>
    ${renderAv2Progress()}
    <div class="header-actions">
      <button class="change-child-button" type="button" data-action="change-child" aria-label="Trocar criança">Trocar criança</button>
      ${['block-03', 'block-04', 'block-05', 'block-06', 'block-07'].includes(state.av2Block)
    ? '<button class="secondary-button av2-exit-button" type="button" data-action="av2-home" aria-label="Voltar às atividades AV2">Atividades</button>'
    : '<button class="secondary-button av2-exit-button" type="button" data-action="home" aria-label="Voltar às revisões">Revisões</button>'}
    </div>
  </header>`;
}

function renderAdditionBoard(question, { showResult = false } = {}) {
  const { a, b, trace } = question.data;
  const revealedCarries = showResult
    ? ['toTens', 'toHundreds']
    : question.hints[Math.max(0, state.av2HintIndex)]?.revealsCarries ?? [];
  const markers = {
    hundreds: revealedCarries.includes('toHundreds') && trace.carries.toHundreds > 0
      ? { value: '1', ariaLabel: 'vai um para as centenas' } : null,
    tens: revealedCarries.includes('toTens') && trace.carries.toTens > 0
      ? { value: '1', ariaLabel: 'vai um para as dezenas' } : null,
  };
  const digitInput = (name, label, extraClass = '') => `<input class="av2-addition-digit ${extraClass} ${state.av2Attempts > 0 && !state.av2Correct ? 'is-incorrect' : ''}" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" data-av2-add-field="${name}" aria-label="${label}" aria-describedby="av2-addition-entry-help" value="${escapeAttribute(state.av2AdditionAnswer[name] ?? '')}" ${state.av2Correct ? 'disabled' : ''}>`;
  const answerDigit = (name, label) => `<span role="cell">${digitInput(name, `${label} do resultado`)}</span>`;
  if (!showResult) {
    markers.hundreds = {
      inputHtml: digitInput('carryHundreds', 'Reserva para a centena', 'av2-addition-carry-digit'),
      isRevealed: revealedCarries.includes('toHundreds') && trace.carries.toHundreds > 0,
      ariaLabel: 'casa da reserva das centenas',
    };
    markers.tens = {
      inputHtml: digitInput('carryTens', 'Reserva para a dezena', 'av2-addition-carry-digit'),
      isRevealed: revealedCarries.includes('toTens') && trace.carries.toTens > 0,
      ariaLabel: 'casa da reserva das dezenas',
    };
  }
  const resultDigits = String(trace.result).length;
  const resultCells = showResult
    ? [resultDigits === 3 ? Math.floor(trace.result / 100) : '', Math.floor(trace.result / 10) % 10, trace.result % 10]
      .map((digit) => `<span class="addition-static-digit" role="cell">${digit}</span>`)
    : [resultDigits === 3 ? answerDigit('hundreds', 'Centena') : '<span class="addition-empty-digit" role="cell" aria-label="Sem centena"></span>', answerDigit('tens', 'Dezena'), answerDigit('units', 'Unidade')];
  const accessibleAddition = `${a} mais ${b}${showResult ? ` é igual a ${trace.result}` : ''}`;
  return `<div class="av2-addition-wrap">${renderCduLegend()}${renderCduLayout({
    firstOperand: a,
    secondOperand: b,
    markers,
    resultCells,
    ariaLabel: `Adição vertical: ${accessibleAddition}. Colunas de centena, dezena e unidade.`,
    firstRowLabel: '1ª parcela',
    secondRowLabel: '2ª parcela',
    resultRowLabel: showResult ? 'soma' : 'resposta',
    operator: '+',
    markerRowLabel: 'vai um',
  })}</div>`;
}

function renderAv2AdditionQuestion(question) {
  if (question.type === 'terms') {
    const options = question.options.map((answer, index) => {
      const selected = state.av2Selected === answer;
      const incorrect = selected && !state.av2Correct && state.av2Attempts > 0;
      const label = typeof answer === 'number' ? String(answer) : answer;
      return `<button class="av2-answer-label ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${escapeAttribute(answer)}" aria-label="Alternativa ${index + 1}: ${escapeAttribute(label)}" aria-pressed="${selected}" ${state.av2Correct ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
    }).join('');
    const hintIndex = state.av2HintIndex;
    const hintLimit = state.av2Attempts === 0 ? 0 : question.hints.length - 1;
    const hint = hintIndex >= 0 ? question.hints[hintIndex] : null;
    return `<div class="av2-exercise is-addition is-terms" data-av2-question-type="terms">
      ${renderAdditionBoard(question, { showResult: true })}
      <div class="av2-answer-options label-options" role="group" aria-label="Alternativas de resposta">${options}</div>
      <div class="av2-addition-actions">
        <button class="secondary-button av2-hint-button" type="button" data-action="av2-hint" ${!state.av2Correct && hintIndex < hintLimit ? '' : 'disabled'}>${hintIndex >= 0 ? 'Outra dica' : 'Quero uma dica'}</button>
      </div>
      ${hint ? `<p class="hint-box av2-addition-hint" role="status" aria-live="polite"><b>Dica ${hintIndex + 1}:</b> ${escapeHtml(hint.text)}</p>` : ''}
    </div>`;
  }

  const hintIndex = state.av2HintIndex;
  const hint = hintIndex >= 0 ? question.hints[hintIndex] : null;
  const hintLimit = state.av2Attempts === 0 ? 0 : question.hints.length - 1;
  const canShowAnotherHint = !state.av2Correct && hintIndex < hintLimit;
  return `<div class="av2-exercise is-addition" data-av2-question-type="${question.type}">
    ${renderAdditionBoard(question)}
    <p class="av2-addition-entry-help" id="av2-addition-entry-help">Digite a soma nas casas C, D e U. Você também pode preencher as reservas.</p>
    ${state.av2AdditionInputError ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2AdditionInputError)}</p>` : ''}
    <div class="number-pad av2-addition-pad" role="group" aria-label="Teclado numérico">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `<button type="button" data-av2-add-digit="${digit}" ${state.av2Correct ? 'disabled' : ''}>${digit}</button>`).join('')}
      <button type="button" class="pad-clear" data-av2-add-clear ${state.av2Correct ? 'disabled' : ''}>Limpar</button>
    </div>
    <div class="av2-addition-actions">
      <button class="primary-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button>
      <button class="secondary-button av2-hint-button" type="button" data-action="av2-hint" aria-describedby="av2-addition-entry-help" ${canShowAnotherHint ? '' : 'disabled'}>${hintIndex >= 0 ? 'Outra dica' : 'Quero uma dica'}</button>
    </div>
    ${hint ? `<p class="hint-box av2-addition-hint" role="status" aria-live="polite"><b>Dica ${hintIndex + 1}:</b> ${escapeHtml(hint.text)}</p>` : ''}
  </div>`;
}

function renderSimuladoChoiceOptions(options, { wordLabels = false, selected = state.av2Selected, label = 'Alternativas de resposta' } = {}) {
  return `<div class="av2-answer-options label-options simulado-choice-options" role="group" aria-label="${escapeAttribute(label)}">
    ${options.map((option, index) => {
      const value = typeof option === 'object' ? option.value : option;
      const text = typeof option === 'object' ? option.label : wordLabels ? numberToPortuguese(option) : String(option);
      const isSelected = String(selected) === String(value);
      const isIncorrect = isSelected && state.av2Attempts > 0 && !state.av2Correct;
      return `<button class="av2-answer-label ${isSelected ? 'is-selected' : ''} ${isIncorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${escapeAttribute(value)}" aria-label="Alternativa ${index + 1}: ${escapeAttribute(text)}" aria-pressed="${isSelected}" ${state.av2Correct ? 'disabled' : ''}>${escapeHtml(text)}</button>`;
    }).join('')}
  </div>`;
}

function renderSimuladoTwoStepQuestion(question) {
  const { steps } = question.data;
  const stage = state.av2CompositeStage;
  const step = steps[stage - 1];
  const number = step.question;
  const operationName = step.operation === 'addition' ? 'adição' : 'subtração';
  const stageTitle = step.kind === 'terms' ? `Identifique os termos da ${operationName}.`
    : step.operation === 'addition' ? 'Resolva a adição da biblioteca.' : 'Use o resultado anterior para resolver a subtração.';
  const notice = state.av2CompositeNotice ? `<p class="simulado-intermediate-result" role="status">${escapeHtml(state.av2CompositeNotice)}</p>` : '';
  if (step.kind === 'operation') {
    const operation = step.operation === 'addition'
      ? renderAv2AdditionQuestion(number)
      : renderSubtractionQuestion(number, {
        hintIndex: state.av2HintIndex, correct: false, selected: state.av2Selected,
        answer: state.av2AdditionAnswer, error: state.av2AdditionInputError,
      });
    const intermediate = stage === 3
      ? `<p class="simulado-intermediate-result">Resultado confirmado na primeira etapa: <strong>${state.av2CompositeIntermediate}</strong> livros.</p>` : '';
    return `<div class="av2-exercise is-simulado is-two-step" data-av2-question-type="simulado-two-step">
      <div class="simulado-step-heading"><span>Etapa ${stage} de 4</span><strong>${escapeHtml(stageTitle)}</strong></div>
      ${notice}${intermediate}${operation}
    </div>`;
  }

  const result = number.data.trace.result;
  const resultDigits = String(result).padStart(3, '0');
  const resultCells = [...resultDigits].map((digit) => `<span role="cell">${digit}</span>`);
  const board = `${renderCduLegend()}${renderCduLayout({
    firstOperand: number.data.a,
    secondOperand: number.data.b,
    operator: step.operation === 'addition' ? '+' : '−',
    firstRowLabel: 'Número de cima',
    secondRowLabel: 'Número de baixo',
    resultRowLabel: 'Resultado',
    resultCells,
    showMarkerRow: false,
    ariaLabel: `Operação concluída na biblioteca: ${number.data.a} ${step.operation === 'addition' ? 'mais' : 'menos'} ${number.data.b} é igual a ${result}. Colunas C, D e U.`,
  })}`;
  const roles = step.operation === 'addition'
    ? ['1ª parcela', '2ª parcela', 'soma ou total']
    : ['minuendo', 'subtraendo', 'resto ou diferença'];
  const rows = [
    ['a', number.data.a, 'Primeiro número'],
    ['b', number.data.b, 'Segundo número'],
    ['result', result, 'Resultado'],
  ].map(([key, value, label]) => `<label class="simulado-term-row"><strong>${value}</strong><span>${label}</span><select data-simulado-term-role="${key}" aria-label="Nome do termo para ${label.toLocaleLowerCase('pt-BR')}"><option value="">Escolha o nome</option>${roles.map((role) => `<option value="${escapeAttribute(role)}" ${state.av2Selected?.[key] === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('')}</select></label>`).join('');
  return `<div class="av2-exercise is-simulado is-two-step" data-av2-question-type="simulado-two-step">
    <div class="simulado-step-heading"><span>Etapa ${stage} de 4</span><strong>${escapeHtml(stageTitle)}</strong></div>
    ${notice}${stage === 4 ? `<p class="simulado-intermediate-result">A subtração usa o total de livros calculado na adição.</p>` : ''}
    ${board}
    <div class="simulado-term-matches" role="group" aria-label="Associe os números aos nomes dos termos">${rows}</div>
    ${state.av2SimuladoInputError ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}</p>` : ''}
    <button class="primary-button simulado-submit-button" type="button" data-action="submit-av2">Conferir termos <span aria-hidden="true">→</span></button>
  </div>`;
}

function renderSimuladoMoneyGroup(denominationIds, title = 'Dinheiro') {
  return `<section class="simulado-context-section" aria-label="${escapeAttribute(title)}"><h2>${escapeHtml(title)}</h2><div class="av2-money-group">${denominationIds.map((id) => {
    const money = moneyById.get(id);
    return money ? `<div class="av2-group-item">${renderMoneyIllustration(money)}<span>${escapeHtml(money.label)}</span></div>` : '';
  }).join('')}</div></section>`;
}

function renderSimuladoProductCard(product, { selectable = false, selected = false, incorrect = false, match = false, matchColor = '' } = {}) {
  const illustration = getAv2ProductIllustration(product.illustrationId);
  if (!illustration) return '';
  const price = `${product.priceReais} ${product.priceReais === 1 ? 'real' : 'reais'}`;
  const body = `<img class="av2-product-image" src="${escapeAttribute(illustration.src)}" alt="" aria-hidden="true" width="180" height="130" decoding="async"><strong>${escapeHtml(product.label)}</strong><span class="av2-product-price">${price}</span>`;
  if (match) return `<button class="av2-product-card simulado-match-product ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''} ${matchColor ? `is-pair-${matchColor}` : ''}" type="button" data-match-product="${escapeAttribute(product.id)}" aria-pressed="${selected}" aria-label="${escapeAttribute(`${product.label}, ${price}`)}" ${matchColor ? 'disabled' : ''}>${body}</button>`;
  if (!selectable) return `<article class="av2-product-card" data-av2-product-id="${escapeAttribute(product.id)}">${body}</article>`;
  return `<button class="av2-product-card av2-product-choice ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${escapeAttribute(product.id)}" data-av2-product-id="${escapeAttribute(product.id)}" aria-pressed="${selected}" aria-label="${escapeAttribute(`${product.label}, ${price}`)}">${body}</button>`;
}

function renderSimuladoProductBoard(products, { label = 'Produtos e preços', selectable = false, selectedIds = [] } = {}) {
  return `<div class="av2-products simulado-product-board" data-product-count="${products.length}" role="group" aria-label="${escapeAttribute(label)}">${products.map((product) => renderSimuladoProductCard(product, {
    selectable,
    selected: selectable && selectedIds.includes(product.id),
    incorrect: selectable && state.av2Attempts > 0 && selectedIds.includes(product.id)
      && !state.av2Round[state.av2Index].correctAnswers?.includes(product.id),
  })).join('')}</div>`;
}

function renderSimuladoNumericEntry(question) {
  const label = question.prompt.includes('soma') ? 'Total em reais' : 'Resposta em reais';
  return `<div class="simulado-answer-entry-wrap">
    <label class="simulado-answer-entry"><span>${label}</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="3" data-simulado-numeric-answer aria-label="${label}" value="${escapeAttribute(state.av2SimuladoNumericAnswer)}" ${state.av2Correct ? 'disabled' : ''}></label>
    ${state.av2SimuladoInputError ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}</p>` : ''}
    <button class="primary-button simulado-submit-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button>
  </div>`;
}

function renderSimuladoNumberTable(question) {
  const table = question.type === 'simulado-number-table' ? question.data.table : question;
  const columns = Math.min(table.columns, typeof window !== 'undefined' && window.innerWidth < 520 ? 5 : table.columns);
  return `<div class="number-table simulado-number-table" style="--table-columns:${columns}" role="group" aria-label="Tabela numérica de ${table.values[0]} até ${table.values.at(-1)}">${table.values.map((value, index) => table.gaps.includes(index)
    ? `<label class="number-table-cell is-gap ${state.av2Attempts > 0 && String(state.av2SequenceAnswer[index] ?? '') !== String(value) ? 'is-incorrect' : ''}"><span class="sr-only">Falta o número na posição ${index + 1}</span><input type="text" inputmode="numeric" maxlength="3" data-table-gap="${index}" aria-label="Número que falta na posição ${index + 1}" value="${escapeAttribute(state.av2SequenceAnswer[index] ?? '')}" ${state.av2Correct ? 'disabled' : ''}></label>`
    : `<span class="number-table-cell">${value}</span>`).join('')}</div>
    ${state.av2SimuladoInputError ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}</p>` : ''}
    <button class="primary-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir tabela</button>`;
}

function renderSimuladoMoneyProductMatching(question) {
  const { groups, products } = question.data;
  const matches = state.av2Pairing.matches;
  const productById = new Map(products.map((product) => [product.id, product]));
  const groupById = new Map(groups.map((group, index) => [group.id, `Grupo ${index + 1}`]));
  const groupCards = groups.map((group, index) => {
    const product = productById.get(matches[group.id]);
    const selected = state.av2Pairing.selectedGroupId === group.id;
    const incorrect = selected && Boolean(state.av2Pairing.selectedProductId);
    const matchColor = state.av2Pairing.matchColors[group.id] ?? '';
    const stateClass = matchColor ? `is-pair-${matchColor}` : incorrect ? 'is-pair-incorrect' : '';
    const status = product ? `Associado a ${escapeHtml(product.label)}`
      : incorrect ? 'Esse brinquedo tem outro preço'
        : selected ? 'Agora toque no brinquedo com o mesmo preço' : 'Toque para escolher';
    return `<button class="simulado-match-group ${selected ? 'is-selected' : ''} ${stateClass}" type="button" data-match-group="${escapeAttribute(group.id)}" data-match-denominations="${escapeAttribute(group.denominationIds.join('|'))}" aria-pressed="${Boolean(product || selected)}" aria-label="${escapeAttribute(`Grupo ${index + 1}${product ? `, associado a ${product.label}` : selected ? ', selecionado' : ''}`)}" ${product || state.av2Correct ? 'disabled' : ''}><strong>Grupo ${index + 1}</strong><span class="simulado-match-money">${group.denominationIds.map((id) => moneyById.get(id)).filter(Boolean).map((money) => renderMoneyIllustration(money)).join('')}</span><span class="simulado-match-status">${status}</span></button>`;
  }).join('');
  const productCards = products.map((product) => {
    const matchedGroup = Object.entries(matches).find(([, productId]) => productId === product.id)?.[0];
    const incorrect = Boolean(state.av2Pairing.selectedGroupId)
      && state.av2Pairing.selectedProductId === product.id && !matchedGroup;
    const selected = Boolean(matchedGroup) || incorrect;
    const matchColor = matchedGroup ? state.av2Pairing.matchColors[matchedGroup] ?? '' : '';
    const status = matchedGroup ? `Associado a ${groupById.get(matchedGroup)}`
      : incorrect ? 'Esse preço não corresponde ao grupo selecionado' : 'Ainda sem associação';
    return `<div class="simulado-match-product-card">${renderSimuladoProductCard(product, { match: true, selected, incorrect, matchColor })}<span class="simulado-match-product-status">${status}</span></div>`;
  }).join('');
  const matchCount = Object.keys(matches).length;
  const status = state.av2SimuladoInputError
    ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}${state.av2Attempts >= 2 ? `<br><b>Dica:</b> ${escapeHtml(question.hint)}` : ''}</p>`
    : matchCount ? `<p class="simulado-match-feedback" role="status" aria-live="polite" aria-atomic="true">${matchCount === groups.length ? 'Muito bem! Todos os pares estão corretos.' : `Pares corretos: ${matchCount} de ${groups.length}.`}</p>` : '';
  return `<div class="av2-exercise is-simulado is-money-matching" data-av2-question-type="simulado-money-product-match">
    <p class="simulado-match-instructions">Toque em um grupo de cédulas e depois no brinquedo com o mesmo preço.</p>
    <div class="simulado-pairing-columns"><section aria-label="Grupos de cédulas"><h2>Grupos de cédulas</h2><div class="simulado-match-groups">${groupCards}</div></section><section aria-label="Brinquedos e preços"><h2>Brinquedos e preços</h2><div class="simulado-match-products">${productCards}</div></section></div>
    ${status}
    <button class="primary-button simulado-submit-button" type="button" data-action="submit-av2" ${matchCount !== groups.length || state.av2Correct ? 'disabled' : ''}>Conferir associações</button>
  </div>`;
}

function renderSimuladoShoppingScenario(question) {
  const { moneyDenominationIds, products } = question.data;
  const isAffordability = question.type === 'simulado-shopping-affordability';
  const showProducts = question.type !== 'simulado-shopping-total';
  return `<div class="av2-exercise is-simulado is-shopping" data-av2-question-type="${question.type}">
    ${renderSimuladoMoneyGroup(moneyDenominationIds, 'Dinheiro de Rael')}
    ${showProducts ? `<section class="simulado-context-section"><h2>Brinquedos e preços</h2>${renderSimuladoProductBoard(products, { label: isAffordability ? 'Marque todos os brinquedos que Rael pode comprar' : 'Brinquedos e preços' , selectable: isAffordability, selectedIds: Array.isArray(state.av2Selected) ? state.av2Selected : [] })}</section>` : ''}
    ${isAffordability
      ? `<p class="simulado-multiple-select-note">Pode haver mais de uma resposta. Marque todas as opções e depois confira.</p><button class="primary-button" type="button" data-action="submit-av2" ${!Array.isArray(state.av2Selected) || !state.av2Selected.length || state.av2Correct ? 'disabled' : ''}>Conferir escolhas</button>`
      : renderSimuladoNumericEntry(question)}
    ${state.av2SimuladoInputError && isAffordability ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}</p>` : ''}
  </div>`;
}

function renderSimuladoProductPriceQuestion(question) {
  const isChoice = question.options.length > 0;
  return `<div class="av2-exercise is-simulado is-product-board" data-av2-question-type="simulado-product-board">
    ${renderSimuladoProductBoard(question.data.products, { label: 'Materiais escolares e preços' })}
    ${isChoice ? renderSimuladoChoiceOptions(question.options, { selected: state.av2Selected, label: 'Escolha o material' }) : renderSimuladoNumericEntry(question)}
    ${isChoice ? `<button class="primary-button simulado-submit-button" type="button" data-action="submit-av2" ${state.av2Selected === null || state.av2Correct ? 'disabled' : ''}>Conferir resposta</button>` : ''}
  </div>`;
}

function renderAv2SimuladoQuestion(question) {
  if (question.type === 'simulado-two-step') return renderSimuladoTwoStepQuestion(question);
  if (question.type === 'simulado-money-product-match') return renderSimuladoMoneyProductMatching(question);
  if (question.type.startsWith('simulado-shopping-')) return renderSimuladoShoppingScenario(question);
  if (question.type === 'simulado-product-board') return renderSimuladoProductPriceQuestion(question);
  if (question.type === 'simulado-number-table') return `<div class="av2-exercise is-simulado is-table" data-av2-question-type="simulado-number-table">${renderSimuladoNumberTable(question)}</div>`;
  if (question.type === 'simulado-association') {
    const { pairs, options } = question.data;
    return `<div class="av2-exercise is-simulado is-association" data-av2-question-type="simulado-association">
      <div class="simulado-association-list" role="group" aria-label="Associação de números e escritas por extenso">
        ${pairs.map(({ value }) => `<label class="simulado-association-row"><strong>${value}</strong><span aria-hidden="true">↔</span><select data-av2-association-answer="${value}" aria-label="Escrita por extenso do número ${value}" ${state.av2Correct ? 'disabled' : ''}><option value="">Escolha a escrita</option>${options.map((word) => `<option value="${escapeAttribute(word)}" ${state.av2Selected?.[String(value)] === word ? 'selected' : ''}>${escapeHtml(word)}</option>`).join('')}</select></label>`).join('')}
      </div>
      ${state.av2SimuladoInputError ? `<p class="av2-addition-input-error" role="alert">${escapeHtml(state.av2SimuladoInputError)}</p>` : ''}
      <button class="primary-button simulado-submit-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir associações <span aria-hidden="true">→</span></button>
    </div>`;
  }
  if (question.type === 'simulado-sequence') {
    return `<div class="av2-exercise is-simulado is-sequence" data-av2-question-type="simulado-sequence">
      <div class="simulado-sequence-display" aria-label="Sequência numérica">${question.data.sequence.map((value) => `<span class="${value === null ? 'is-missing' : ''}">${value ?? '?'}</span>`).join('')}</div>
      ${renderSimuladoChoiceOptions(question.options)}
      <button class="primary-button simulado-submit-button" type="button" data-action="submit-av2" ${state.av2Selected === null || state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button>
    </div>`;
  }
  if (question.type === 'simulado-word') {
    const selected = state.av2Selected;
    const lead = question.data.mode === 'number-to-word'
      ? `<div class="number-prompt"><span>Número</span><strong>${question.data.value}</strong></div>`
      : `<div class="word-prompt cursive-text">${escapeHtml(numberToPortuguese(question.data.value))}</div>`;
    const instruction = question.data.mode === 'number-to-word'
      ? 'Escolha como o número é escrito por extenso'
      : 'Escolha o número correspondente';
    return `<div class="word-wrap is-simulado is-word" data-av2-question-type="simulado-word">${lead}
      <div class="word-options" role="radiogroup" aria-label="${instruction}">${question.options.map((option, index) => `<button class="word-option ${question.data.mode === 'number-to-word' ? 'cursive-text' : ''} ${Number(selected) === Number(option.value) ? 'is-selected' : ''}" type="button" role="radio" aria-checked="${Number(selected) === Number(option.value)}" data-av2-answer="${option.value}" aria-label="Alternativa ${index + 1}: ${escapeAttribute(option.label)}" ${state.av2Correct ? 'disabled' : ''}>${escapeHtml(option.label)}</button>`).join('')}</div>
      <button class="primary-button check-button" type="button" data-action="submit-av2" ${selected === null || state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button>
    </div>`;
  }
  return '';
}

function renderAv2SequencesQuestion(question) {
  if (question.type === 'sequence') return `<div class="neighbor-wrap av2-number-sequence-wrap"><div class="number-sequence av2-number-sequence" aria-label="${escapeAttribute(question.prompt)}">${question.values.map((value, index) => index === question.blank
    ? `<input class="sequence-input" type="text" inputmode="numeric" maxlength="3" data-sequence-answer="" aria-label="Número que falta" value="${escapeAttribute(state.av2SequenceAnswer.value ?? '')}" ${state.av2Correct ? 'disabled' : ''}>`
    : `<span>${value}</span>`).join('')}</div><p class="sequence-help">${question.direction === 'increasing' ? 'Conte de um em um para a frente.' : 'Conte de um em um para trás.'}</p><button class="primary-button check-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button></div>`;
  if (question.category === 'NUM-03') {
    const before = question.kind === 'predecessor' ? `<input class="sequence-input" type="text" inputmode="numeric" maxlength="3" data-sequence-answer="" aria-label="Antecessor de ${question.target}" value="${escapeAttribute(state.av2SequenceAnswer.value ?? '')}" ${state.av2Correct ? 'disabled' : ''}>` : `<span>${question.target - 1}</span>`;
    const after = question.kind === 'successor' ? `<input class="sequence-input" type="text" inputmode="numeric" maxlength="3" data-sequence-answer="" aria-label="Sucessor de ${question.target}" value="${escapeAttribute(state.av2SequenceAnswer.value ?? '')}" ${state.av2Correct ? 'disabled' : ''}>` : `<span>${question.target + 1}</span>`;
    return `<div class="neighbor-wrap"><div class="number-sequence" aria-label="${escapeAttribute(question.prompt)}">${before}<span>${question.target}</span>${after}</div><p class="sequence-help">Conte de um em um para descobrir o vizinho.</p><button class="primary-button check-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir resposta <span aria-hidden="true">→</span></button></div>`;
  }
  if (question.type === 'number-table') return renderSimuladoNumberTable(question);
  if (question.category === 'NUM-06') return `<div class="word-wrap av2-number-to-word-choice"><div class="number-prompt"><span>Número</span><strong>${question.value}</strong></div><div class="word-options av2-word-options" role="radiogroup" aria-label="Escolha como o número é escrito por extenso">${question.options.map((value,index)=>`<button class="word-option cursive-text ${state.av2Selected===value?'is-selected':''}" type="button" role="radio" aria-checked="${state.av2Selected===value}" data-av2-answer="${value}" aria-label="Alternativa ${index+1}: ${escapeAttribute(question.optionLabels[index])}" ${state.av2Correct?'disabled':''}>${escapeHtml(question.optionLabels[index])}</button>`).join('')}</div><button class="primary-button check-button" type="button" data-action="submit-av2" ${state.av2Selected===null||state.av2Selected===undefined||state.av2Correct?'disabled':''}>Conferir resposta <span aria-hidden="true">→</span></button></div>`;
  const selected = state.av2Selected;
  return `<div class="word-wrap av2-number-word-recognition"><div class="word-prompt cursive-text">${escapeHtml(question.displayWord)}</div><div class="word-options av2-word-options" role="radiogroup" aria-label="Escolha o número correspondente">${question.options.map((value,index)=>`<button class="word-option ${selected===value?'is-selected':''}" type="button" role="radio" aria-checked="${selected===value}" data-av2-answer="${value}" aria-label="Alternativa ${index+1}: ${value}" ${state.av2Correct?'disabled':''}>${value}</button>`).join('')}</div><button class="primary-button check-button" type="button" data-action="submit-av2" ${selected===null||selected===undefined||state.av2Correct?'disabled':''}>Conferir resposta <span aria-hidden="true">→</span></button></div>`;
}

function renderAv2MoneyCompositionQuestion(question) {
  const selectedItems = state.av2MoneySelection;
  const counts = countMoneyCompositionSelection(selectedItems);
  const total = formatMoneyCompositionTotal(totalMoneyCompositionCents(counts));
  const selectedMoney = selectedItems.map((item) => {
    const money = moneyById.get(item.denominationId);
    if (!money) return '';
    return `<article class="av2-composition-selected-item">
      ${renderMoneyIllustration(money)}
      <span>${escapeHtml(money.label)}</span>
      <button class="av2-composition-remove" type="button" data-remove-money-item="${item.key}" aria-label="Remover ${escapeAttribute(money.spokenLabel)} da seleção" ${state.av2Correct ? 'disabled' : ''}>Remover</button>
    </article>`;
  }).join('');
  const palette = question.allowedDenominationIds.map((id) => {
    const money = moneyById.get(id);
    if (!money) return '';
    const quantity = counts[id] ?? 0;
    const unavailable = quantity >= question.quantityLimits[id] || selectedItems.length >= question.maxItems;
    return `<button class="av2-composition-option" type="button" data-add-money="${escapeAttribute(money.id)}" aria-label="Adicionar ${escapeAttribute(money.spokenLabel)}${quantity ? `; selecionada ${quantity} ${quantity === 1 ? 'vez' : 'vezes'}` : ''}" ${state.av2Correct || unavailable ? 'disabled' : ''}>
      ${renderMoneyIllustration(money)}
      <span class="av2-composition-option-label">${escapeHtml(money.label)}</span>
      ${quantity ? `<span class="av2-composition-count">Na seleção: ${quantity}</span>` : ''}
    </button>`;
  }).join('');
  const referenceMoney = question.referenceDenominationId ? moneyById.get(question.referenceDenominationId) : null;
  const reference = referenceMoney
    ? `<div class="av2-composition-reference" aria-label="Valor de referência">${renderMoneyIllustration(referenceMoney)}<span>Valor para comparar: ${escapeHtml(referenceMoney.label)}</span></div>`
    : '';
  let firstWay = '';
  if (question.requiredDistinctSolutions > 1 && state.av2MoneySolutions.length > 0) {
    const summary = Object.entries(state.av2MoneySolutions[0])
      .filter(([, quantity]) => quantity > 0)
      .sort(([left], [right]) => (moneyById.get(left)?.valueCents ?? 0) - (moneyById.get(right)?.valueCents ?? 0))
      .map(([id, quantity]) => {
        const money = moneyById.get(id);
        return money ? `<span class="av2-composition-summary-item">${renderMoneyIllustration(money)}<b>${quantity} × ${escapeHtml(money.label)}</b></span>` : '';
      }).join('');
    firstWay = `<div class="av2-composition-first-way"><strong>Primeira maneira</strong><div class="av2-composition-summary">${summary}</div></div>`;
  }
  return `<div class="av2-exercise av2-money-composition" data-av2-question-type="money-composition" data-challenge-id="${escapeAttribute(question.challengeId)}" data-composition-stage="${state.av2MoneySolutions.length + 1}">
    ${reference}
    <section class="av2-composition-section" aria-labelledby="av2-composition-palette-title">
      <h2 id="av2-composition-palette-title">Dinheiro disponível</h2>
      <div class="av2-composition-palette" role="group" aria-label="Toque para adicionar uma moeda ou cédula">${palette}</div>
    </section>
    <section class="av2-composition-section" aria-labelledby="av2-composition-selection-title">
      <h2 id="av2-composition-selection-title">Sua seleção</h2>
      ${selectedItems.length ? `<div class="av2-composition-selected" role="group" aria-label="Itens selecionados">${selectedMoney}</div>` : '<p class="av2-composition-empty">Toque no dinheiro para começar.</p>'}
      <p class="av2-composition-total" data-av2-money-total aria-live="polite" aria-atomic="true">Você formou: <strong>${escapeHtml(total)}</strong></p>
      ${firstWay}
      <div class="av2-composition-controls">
        <button class="secondary-button" type="button" data-action="clear-av2-money" ${selectedItems.length === 0 || state.av2Correct ? 'disabled' : ''}>Limpar seleção</button>
        <button class="primary-button" type="button" data-action="submit-av2" ${state.av2Correct ? 'disabled' : ''}>Conferir resposta</button>
      </div>
    </section>
  </div>`;
}

function renderAv2Question(question) {
  if (question.activityId === AV2_SIMULADO_ACTIVITY_ID) return renderAv2SimuladoQuestion(question);
  if (question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID) return renderAv2MoneyCompositionQuestion(question);
  if (question.activityId === 'av2-sequences') return renderAv2SequencesQuestion(question);
  if (question.activityId === AV2_SUBTRACTION_ACTIVITY_ID) return renderSubtractionQuestion(question, {
    hintIndex: state.av2HintIndex, correct: state.av2Correct, selected: state.av2Selected,
    answer: state.av2AdditionAnswer, error: state.av2AdditionInputError,
  });
  if (question.activityId === AV2_ADDITION_ACTIVITY_ID) return renderAv2AdditionQuestion(question);
  if (question.pedagogicalCategory === 'SHOPPING_PROBLEM') return renderAv2ShoppingQuestion(question);

  const moneyGroup = (ids) => `<div class="av2-money-group">${ids.map((id) => `<div class="av2-group-item">${renderMoneyIllustration(moneyById.get(id))}<span>${escapeHtml(moneyById.get(id).label)}</span></div>`).join('')}</div>`;
  let promptMoney = '';
  if (question.type === 'identification') promptMoney = renderMoneyIllustration(moneyById.get(question.data.denominationId));
  if (question.type === 'equivalence' || question.type === 'composition') promptMoney = moneyGroup(question.data.denominationIds);

  const interactiveOptions = question.options.map((answer, index) => {
    const selected = state.av2Selected === answer;
    const incorrect = selected && !state.av2Correct && state.av2Attempts > 0;
    if (typeof answer === 'number') {
      const label = `${answer} ${answer === 1 ? 'real' : 'reais'}`;
      return `<button class="av2-answer-label ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${answer}" aria-label="Alternativa ${index + 1}: ${label}" aria-pressed="${selected}" ${state.av2Correct ? 'disabled' : ''}>${label}</button>`;
    }
    const money = moneyById.get(answer);
    const label = `${money.kind === 'coin' ? 'Moeda' : 'Cédula'} de ${money.label}`;
    if (question.type === 'identification') {
      return `<button class="av2-answer-label ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${money.id}" aria-label="Alternativa ${index + 1}: ${escapeAttribute(label)}" aria-pressed="${selected}" ${state.av2Correct ? 'disabled' : ''}>${escapeHtml(money.label)}</button>`;
    }
    return `<button class="av2-money-option ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${money.id}" aria-label="Alternativa ${index + 1}: ${escapeAttribute(label)}" aria-pressed="${selected}" ${state.av2Correct ? 'disabled' : ''}>${renderMoneyIllustration(money)}<span class="av2-option-label">${escapeHtml(money.label)}</span></button>`;
  }).join('');

  return `<div class="av2-exercise ${question.type === 'identification' ? 'is-identification' : 'is-comparison'}" data-av2-question-type="${question.type}">
    ${promptMoney ? `<div class="av2-prompt-money">${promptMoney}</div>` : ''}
    <div class="av2-answer-options ${question.type === 'identification' || typeof question.options[0] === 'number' ? 'label-options' : 'money-options'}" role="group" aria-label="Alternativas de resposta">
      ${interactiveOptions}
    </div>
  </div>`;
}

function renderAv2ShoppingQuestion(question) {
  const { data } = question;
  const selectedIds = Array.isArray(state.av2Selected) ? state.av2Selected : [];
  const renderProductCard = (product, { selectable = false, selected = false, incorrect = false } = {}) => {
    const illustration = getAv2ProductIllustration(product.illustrationId);
    if (!illustration) return '';
    const priceLabel = `${product.priceReais} ${product.priceReais === 1 ? 'real' : 'reais'}`;
    const image = `<img class="av2-product-image" src="${escapeAttribute(illustration.src)}" alt="" aria-hidden="true" width="180" height="130" decoding="async">`;
    const contents = `${image}<strong>${escapeHtml(product.label)}</strong><span class="av2-product-price">${priceLabel}</span>`;
    if (!selectable) {
      return `<article class="av2-product-card" data-av2-product-id="${escapeAttribute(product.id)}" data-av2-product-illustration="${escapeAttribute(product.illustrationId)}">${contents}</article>`;
    }
    const buttonLabel = `${product.label}, ${priceLabel}`;
    return `<button class="av2-product-card av2-product-choice ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${escapeAttribute(product.id)}" data-av2-product-id="${escapeAttribute(product.id)}" data-av2-product-illustration="${escapeAttribute(product.illustrationId)}" aria-pressed="${selected}" aria-label="${escapeAttribute(buttonLabel)}" ${state.av2Correct ? 'disabled' : ''}>${contents}</button>`;
  };
  const renderProductGroup = (products, { label = 'Produtos e preços', selectable = false } = {}) => (
    `<div class="av2-products" data-product-count="${products.length}" role="group" aria-label="${escapeAttribute(label)}">${products.map((product) => renderProductCard(product, {
      selectable,
      selected: selectable && selectedIds.includes(product.id),
      incorrect: selectable && selectedIds.includes(product.id) && state.av2Attempts > 0 && !question.correctAnswers.includes(product.id),
    })).join('')}</div>`
  );

  if (question.type === 'shopping-affordability') {
    const options = question.options.map((productId) => data.products.find(({ id }) => id === productId)).filter(Boolean);
    return `<div class="av2-exercise is-shopping" data-av2-question-type="${question.type}"><p class="av2-available-money">Você tem <strong>${data.availableReais} reais</strong>.</p>${renderProductGroup(options, { label: 'Escolha todos os produtos que pode comprar', selectable: true })}<button class="primary-button" type="button" data-action="submit-av2" ${selectedIds.length === 0 || state.av2Correct ? 'disabled' : ''}>Conferir escolhas</button></div>`;
  }

  let visualMoney = '';
  if (question.type === 'shopping-available-total') {
    visualMoney = `<div class="av2-money-group">${data.denominationIds.map((id) => `<div class="av2-group-item">${renderMoneyIllustration(moneyById.get(id))}<span>${escapeHtml(moneyById.get(id).label)}</span></div>`).join('')}</div>`;
  }
  let productCards = '';
  let paidAmount = '';
  if (question.type === 'shopping-change') {
    const product = data.products.find(({ id }) => id === data.purchaseProductId);
    productCards = product ? renderProductGroup([product], { label: 'Produto comprado' }) : '';
    paidAmount = `<p class="av2-available-money av2-shopping-paid" data-av2-paid-amount="${data.availableReais}">Valor pago: <strong>${data.availableReais} reais</strong>.</p>`;
  } else if (question.type === 'shopping-product-sum' || question.type === 'shopping-selected-total') {
    const products = data.selectedProductIds.map((id) => data.products.find((product) => product.id === id)).filter(Boolean);
    productCards = renderProductGroup(products, { label: 'Produtos para somar' });
  }
  const numericOptions = question.options.map((amount, index) => {
    const selected = state.av2Selected === amount;
    const incorrect = selected && !state.av2Correct && state.av2Attempts > 0;
    const label = `${amount} ${amount === 1 ? 'real' : 'reais'}`;
    return `<button class="av2-answer-label ${selected ? 'is-selected' : ''} ${incorrect ? 'is-incorrect' : ''}" type="button" data-av2-answer="${amount}" aria-label="Alternativa ${index + 1}: ${label}" aria-pressed="${selected}" ${state.av2Correct ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  return `<div class="av2-exercise is-shopping" data-av2-question-type="${question.type}">${visualMoney || `${paidAmount}${productCards}`}<div class="av2-answer-options label-options" role="group" aria-label="Alternativas de resposta">${numericOptions}</div></div>`;
}

function renderAv2MoneyCompositionFeedback(question) {
  if (state.av2MoneyFeedback === 'first-way' && state.av2MoneySolutions.length === 1) {
    const text = 'Primeira maneira: correta! Agora forme o mesmo valor de outro jeito.';
    return `<div class="feedback success-feedback av2-composition-step-feedback" role="status" aria-live="polite">
      <p class="feedback-title">Primeira maneira: correta!</p>
      <p>Agora forme o mesmo valor de outro jeito.</p>
      ${renderSpeechButton('feedback', text, 'Ouvir')}
    </div>`;
  }
  if (state.av2MoneyFeedback === 'duplicate-combination') {
    const text = 'Essa combinação já foi usada. Tente formar o valor de outro jeito!';
    return `<div class="feedback av2-composition-duplicate-feedback" role="status" aria-live="polite" aria-atomic="true">
      <p class="feedback-title">${escapeHtml(text)}</p>
      ${renderSpeechButton('feedback', text, 'Ouvir')}
    </div>`;
  }
  if (state.av2Attempts === 0) return '';
  const messages = {
    'below-target': 'Você ainda não chegou ao valor pedido. Observe quanto falta.',
    'above-target': 'Você passou do valor pedido. Tente retirar uma moeda ou cédula.',
    'wrong-banknote-count': 'O valor está certo, mas confira a quantidade de cédulas.',
    'unauthorized-denomination': 'Escolha somente o dinheiro disponível neste desafio.',
    'wrong-money-kind': question.banknoteOnly ? 'Neste desafio, use somente cédulas.' : 'Neste desafio, use somente moedas.',
    'inventory-limit': 'Você já usou todas as peças disponíveis desse valor.',
    'not-enough-denominations': 'Use moedas de valores diferentes para formar essa quantia.',
    'invalid-quantities': 'Confira os itens escolhidos e tente novamente.',
    'invalid-challenge': 'Este desafio não pode ser conferido agora.',
  };
  const message = messages[state.av2MoneyFeedback] ?? 'Observe os valores e tente mais uma vez.';
  return `<div class="feedback retry-feedback" role="alert" aria-live="polite" aria-atomic="true">
    <p class="feedback-title">${escapeHtml(message)}</p>
    ${renderSpeechButton('feedback', message, 'Ouvir')}
    ${state.av2HintIndex < 0
      ? '<button class="secondary-button" type="button" data-action="av2-hint">Quero uma dica</button>'
      : `<p class="hint-box"><b>Dica:</b> ${escapeHtml(question.hint)}</p>${renderSpeechButton('hint', question.hint, 'Ouvir dica')}`}
  </div>`;
}

function renderAv2Feedback(question) {
  if (question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID && !state.av2Correct) {
    return renderAv2MoneyCompositionFeedback(question);
  }
  if (state.av2Correct) {
    const message = createPersonalizedMessage({
      childName: currentChildName(),
      visualTemplate: question.feedback.correct.replace(/^Muito bem!/, 'Muito bem, {name}!'),
      speechText: question.feedback.correct,
    });
    const speechText = question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID ? question.feedback.correct : question.explanation;
    const speechKind = question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID ? 'feedback' : 'explanation';
    return `<div class="feedback success-feedback" role="status" aria-live="polite">
      <p class="feedback-title">${escapeHtml(message.visualText)}</p>
      <div class="feedback-actions">
        ${renderSpeechButton(speechKind, speechText, question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID ? 'Ouvir' : null)}
        <button class="primary-button next-button" type="button" data-action="next-av2">${state.av2Index === state.av2Round.length - 1 ? 'Concluir' : 'Próxima'} <span aria-hidden="true">→</span></button>
      </div>
    </div>`;
  }
  if (question.type === 'simulado-money-product-match') return '';
  if (state.av2Attempts === 0) return '';
  if (state.av2Block === 'block-07' && question.activityId === AV2_SIMULADO_ACTIVITY_ID) {
    const step = question.type === 'simulado-two-step'
      ? question.data.steps[state.av2CompositeStage - 1] : null;
    const hints = step?.kind === 'operation' ? step.question.hints : null;
    const hint = state.av2HintIndex < 0 ? null
      : hints ? hints[state.av2HintIndex]?.text : question.hint;
    const hintAvailable = state.av2HintIndex < 0
      || (hints && state.av2HintIndex < hints.length - 1);
    return `<div class="feedback retry-feedback" role="alert" aria-live="polite">
      <p class="feedback-title">${state.av2Attempts === 1 ? question.feedback.retry : 'Observe a atividade com calma e tente novamente.'}</p>
      ${hint ? `<p class="hint-box"><b>Dica:</b> ${escapeHtml(hint)}</p>${renderSpeechButton('hint', hint, 'Ouvir dica')}` : ''}
      ${hintAvailable ? '<button class="secondary-button" type="button" data-action="av2-hint">Quero uma dica</button>' : ''}
    </div>`;
  }
  if ([AV2_ADDITION_ACTIVITY_ID, AV2_SUBTRACTION_ACTIVITY_ID].includes(question.activityId)) {
    return `<div class="feedback retry-feedback" role="alert" aria-live="polite">
      <p class="feedback-title">${state.av2Attempts === 1 ? question.feedback.retry : 'Observe a conta com calma e tente mais uma vez.'}</p>
    </div>`;
  }
  return `<div class="feedback retry-feedback" role="alert" aria-live="polite">
    <p class="feedback-title">${state.av2Attempts === 1 ? question.feedback.retry : 'Observe os valores e tente mais uma vez.'}</p>
    ${state.av2Attempts >= 2 ? `<p class="hint-box"><b>Dica:</b> ${escapeHtml(question.hint)}</p>` : ''}
  </div>`;
}

function renderAv2Game() {
  let question = state.av2Round[state.av2Index];
  if (state.av2Block === 'block-07') {
    let safeQuestion = upgradeLegacyAv2SimuladoQuestion(question);
    if (!safeQuestion) {
      const knownSubjects = ['money', 'addition', 'subtraction', 'sequences', 'words'];
      const subjectId = knownSubjects.includes(question?.simulado?.subjectId) ? question.simulado.subjectId
        : (question?.simulado?.subjectIds ?? []).find((id) => knownSubjects.includes(id)) ?? 'words';
      safeQuestion = createAv2SimuladoRound({ [subjectId]: 1 })[0];
    }
    if (safeQuestion !== question) {
      state.av2Round = [...state.av2Round];
      state.av2Round[state.av2Index] = safeQuestion;
      state.av2Selected = null;
      state.av2Correct = false;
      state.av2Attempts = 0;
      state.av2HintIndex = -1;
      state.av2SequenceAnswer = {};
      state.av2SimuladoInputError = '';
      state.av2SimuladoNumericAnswer = '';
      state.av2Pairing = { selectedGroupId: null, selectedProductId: null, matches: {}, matchColors: {} };
    }
    question = safeQuestion;
  }
  if (!validateAv2AnswerMode(question, { requireDeclared: ['block-05', 'block-07'].includes(state.av2Block) })) {
    throw new TypeError(`A questão AV2 ${question?.type ?? 'sem tipo'} não declarou uma interação permitida.`);
  }
  const activityName = state.av2Block === 'block-07'
    ? question.type === 'simulado-two-step' ? 'Problema em duas etapas'
      : AV2_SIMULADO_SUBJECTS.find(({ id }) => id === question.simulado?.subjectId)?.label ?? 'Simulado AV2'
    : state.av2Block === 'block-05' ? ['NUM-05','NUM-06'].includes(question.category) ? 'Números por extenso' : 'Sequências e números por extenso'
    : state.av2Block === 'block-06' ? 'Formar quantias'
    : state.av2Block === 'block-04' ? 'Subtração com reagrupamento'
    : state.av2Block === 'block-03' ? 'Adição com reagrupamento'
    : state.av2Block === 'block-02' ? 'Compras e troco'
    : question.type === 'identification' || question.type === 'equivalence' || question.type === 'composition'
      ? 'Reconhecer o dinheiro' : 'Comparar valores';
  const heading = question.type === 'simulado-word'
    ? question.data.mode === 'number-to-word' ? 'Escolha a escrita correta' : 'Escolha o número correspondente'
    : state.av2Block === 'block-05' && question.category === 'NUM-06' ? 'Escolha a escrita correta'
      : state.av2Block === 'block-05' && question.category === 'NUM-05' ? 'Escolha o número correspondente' : activityName;
  return `<div class="site-shell game-screen av2-game-screen">
    ${renderAv2Header()}
    <main class="main-content av2-main-content">
      <div class="question-topline"><span class="activity-badge">Questão ${state.av2Index + 1} de ${state.av2Round.length}</span><span class="activity-count">${activityName}</span></div>
      <div class="question-heading"><div><h1 id="av2-question-title">${heading}</h1></div>${renderGuide(state.av2Correct ? 'Que conquista linda! Vamos continuar.' : 'Vamos com calma! Você consegue!')}</div>
      <section class="question-card av2-question-card" aria-labelledby="av2-question-title">
        <div class="prompt-row"><p class="prompt" id="av2-question-prompt">${escapeHtml(question.prompt)}</p>${renderSpeechButton('question', question.speech)}</div>
        <span class="speech-status" data-speech-status role="status" aria-live="polite"></span>
        <div class="exercise-area av2-exercise-area${['SHOPPING_PROBLEM', 'CONNECTED_SHOPPING_SCENARIO', 'PRODUCT_PRICE_BOARD'].includes(question.pedagogicalCategory) ? ' is-shopping-question' : ''}" data-answer-mode="${question.answerMode ?? getAv2AnswerMode(question)}">${renderAv2Question(question)}</div>
        ${renderAv2Feedback(question)}
      </section>
    </main>
  </div>`;
}

function selectRewardPage() {
  state.animalPickerOpen = false;
  state.animalDraft = '';
  state.generatedRewardImage = null;
  state.generatingRewardImage = false;
  state.rewardGenerationError = '';
  state.unavailableRewardPageIds = new Set();
  const page = pickColoringPage({
    excludeId: state.lastRewardPageId,
    recentIds: coloringPageHistory.get(),
    unavailableIds: state.unavailableRewardPageIds,
  });
  state.rewardPageId = page?.id ?? null;
  state.lastRewardPageId = page?.id ?? state.lastRewardPageId;
  state.rewardFallback = !page;
  if (page) coloringPageHistory.remember(page.id);
}

function showAnotherColoringPage() {
  state.generatedRewardImage = null;
  state.rewardGenerationError = '';
  const page = pickColoringPage({
    excludeId: state.rewardPageId,
    recentIds: coloringPageHistory.get(),
    unavailableIds: state.unavailableRewardPageIds,
  });
  if (!page) {
    state.rewardPageId = null;
    state.rewardFallback = true;
    render();
    return;
  }
  state.rewardPageId = page.id;
  state.lastRewardPageId = page.id;
  state.rewardFallback = false;
  coloringPageHistory.remember(page.id);
  render();
}

function handleColoringAssetError(pageId) {
  if (state.screen !== 'reward' || state.rewardPageId !== pageId) return;
  state.unavailableRewardPageIds.add(pageId);
  showAnotherColoringPage();
}

async function generateRewardColoringPage(animal, source = 'typed') {
  if (state.generatingRewardImage) return;
  if (!isValidAnimal(animal)) {
    state.rewardGenerationError = 'Digite o nome de um animal, como peixe-boi.';
    render();
    document.querySelector('#coloring-animal')?.focus();
    return;
  }
  animal = normalizeAnimal(animal);
  state.generatingRewardImage = true;
  state.generatingAnimal = animal;
  state.rewardGenerationError = '';
  render();
  const loadingStartedAt = Date.now();
  const waitingMessages = [
    'Enquanto o desenho chega, quais cores você quer usar?',
    'Você pode imaginar os sons desse animal?',
    'Já pode separar seus lápis de cor!',
  ];
  let messageIndex = 0;
  const loadingTimer = setInterval(() => {
    const message = document.querySelector('[data-coloring-wait-message]');
    if (message) message.textContent = Date.now() - loadingStartedAt >= 30000
      ? 'Seu desenho ainda está sendo criado. Alguns animais demoram um pouquinho mais!'
      : waitingMessages[messageIndex++ % waitingMessages.length];
  }, 7000);
  try {
    const response = await fetch('/api/coloring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animal, source }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || typeof payload?.image !== 'string') {
      throw new Error(payload?.error || 'Não foi possível criar o desenho agora. Tente de novo.');
    }
    state.generatedRewardImage = { src: payload.image, animal };
    state.animalPickerOpen = false;
  } catch (error) {
    state.rewardGenerationError = error instanceof Error
      ? error.message
      : 'Não foi possível criar o desenho agora. Tente de novo.';
  } finally {
    clearInterval(loadingTimer);
    state.generatingAnimal = '';
    state.generatingRewardImage = false;
    render();
    document.querySelector(state.animalPickerOpen ? '#coloring-animal' : '[data-action="generate-coloring-page"]')?.focus();
  }
}

function handleGeneratedColoringImageError() {
  if (state.screen !== 'reward' || !state.generatedRewardImage) return;
  state.generatedRewardImage = null;
  state.rewardGenerationError = 'Não foi possível abrir o desenho. Tente criar outro.';
  render();
}

function openOfficialColoringPage() {
  const page = pickOfficialColoringPage({
    excludeId: state.lastOfficialColoringPageId,
    recentIds: officialColoringPageHistory.get(),
  });
  if (!page) return;

  state.lastOfficialColoringPageId = page.id;
  state.officialOpenFailure = null;
  officialColoringPageHistory.remember(page.id);
  const openedWindow = window.open(page.url, '_blank', 'noopener,noreferrer');
  if (openedWindow) return;

  state.officialOpenFailure = page;
  render();
}

function renderOfficialColoringAction() {
  const failure = state.officialOpenFailure;
  return `<div class="official-reward-option" data-official-reward-option>
    <button class="secondary-button official-coloring-button" type="button" data-action="open-official-coloring" aria-describedby="official-coloring-help">🖍 Abrir desenho oficial surpresa ↗</button>
    <p id="official-coloring-help" class="official-coloring-help">Abre uma página oficial da Disney ou de outros amigos em uma nova aba. Precisa de internet.</p>
    ${failure ? `<p class="official-open-message" role="alert">O navegador não abriu a nova página. <a href="${escapeAttribute(failure.url)}" target="_blank" rel="noopener noreferrer">Toque aqui para acessar o desenho oficial.</a></p>` : ''}
  </div>`;
}

function openAnimalPicker() {
  if (state.generatingRewardImage) return;
  state.animalPickerOpen = true;
  state.rewardGenerationError = '';
  state.animalSuggestions = pickAnimalSuggestions();
  render();
  document.querySelector('#coloring-animal')?.focus();
}

function renderAnimalGeneration() {
  return `<div class="animal-generation" data-animal-generation>
    <div class="drawing-animation" aria-hidden="true">
      <svg class="drawing-paper" viewBox="0 0 220 180" fill="none">
        <rect x="20" y="10" width="180" height="160" rx="14" fill="white" stroke="#d7cff1" stroke-width="3"/>
        <g class="drawing-traces" stroke="#6b56a5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <path pathLength="100" d="M66 126 Q72 104 88 107 Q110 88 132 107 Q148 104 154 126 Q158 148 137 144 Q110 134 83 144 Q62 148 66 126Z"/>
          <ellipse pathLength="100" cx="67" cy="89" rx="11" ry="15" transform="rotate(-25 67 89)"/>
          <ellipse pathLength="100" cx="94" cy="68" rx="11" ry="15"/>
          <ellipse pathLength="100" cx="126" cy="68" rx="11" ry="15"/>
          <ellipse pathLength="100" cx="153" cy="89" rx="11" ry="15" transform="rotate(25 153 89)"/>
        </g>
      </svg>
      <span class="drawing-pencil">✏️</span><span class="drawing-spark drawing-spark-one">✦</span><span class="drawing-spark drawing-spark-two">✧</span>
    </div>
    <h2 id="animal-picker-title" tabindex="-1">Criando seu desenho de <span>${escapeHtml(state.generatingAnimal)}</span>!</h2>
    <p>Seu animal vai aparecer no habitat dele, prontinho para colorir.</p>
    <div class="drawing-wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="drawing-wait-message" role="status" aria-live="polite" data-coloring-wait-message>Enquanto o desenho chega, quais cores você quer usar?</p>
    <p class="drawing-wait-help">Pode levar até um minutinho. O desenho aparece aqui quando estiver pronto.</p>
  </div>`;
}

function renderAnimalPicker() {
  if (!state.animalPickerOpen) return '';
  if (state.generatingRewardImage) return `<dialog class="animal-picker animal-picker-loading" data-animal-dialog aria-labelledby="animal-picker-title">${renderAnimalGeneration()}</dialog>`;
  const disabled = state.generatingRewardImage ? 'disabled' : '';
  return `<dialog class="animal-picker" data-animal-dialog aria-labelledby="animal-picker-title" aria-busy="${state.generatingRewardImage}">
    <h2 id="animal-picker-title">Qual animal você quer colorir?</h2>
    <form data-animal-form>
      <label for="coloring-animal">Digite o nome do animal</label>
      <p id="animal-help">Pode escrever em português! Por exemplo: peixe-boi. Ele vai aparecer no seu habitat natural.</p>
      <div class="animal-entry"><input id="coloring-animal" name="animal" type="text" minlength="2" maxlength="60" required autocomplete="off" placeholder="Ex.: peixe-boi" aria-describedby="animal-help" autofocus value="${escapeAttribute(state.animalDraft)}" ${disabled}>
      <button class="primary-button" type="submit" ${disabled}>Criar meu desenho</button></div>
    </form>
    <p>Ou toque em um destes animais para criar o desenho:</p>
    <div class="animal-suggestions">${state.animalSuggestions.map((animal) => `<button class="secondary-button" type="button" data-animal-suggestion="${escapeAttribute(animal)}" ${disabled}>${escapeHtml(animal)}</button>`).join('')}</div>
    <button class="secondary-button" type="button" data-action="refresh-animal-suggestions" ${disabled}>Ver outros animais</button>
    <p role="status" aria-live="polite">${state.generatingRewardImage ? 'Criando seu desenho…' : escapeHtml(state.rewardGenerationError)}</p>
    <button class="secondary-button" type="button" data-action="cancel-animal-picker" ${disabled}>Cancelar</button>
  </dialog>`;
}

function renderReward() {
  const rewardPage = getColoringPageById(state.rewardPageId);
  const rewardMessage = createRewardMessage();
  const av2Reward = state.activeRevision === AV2_REVISION_ID;
  const subtractionReward = av2Reward && state.av2Block === 'block-04';
  const simuladoReward = av2Reward && state.av2Block === 'block-07';
  const additionReward = av2Reward && ['block-03', 'block-04'].includes(state.av2Block);
  const twelveChallengeReward = av2Reward && ['block-03', 'block-04', 'block-05', 'block-06'].includes(state.av2Block);
  const starCount = simuladoReward ? state.av2Round.length : twelveChallengeReward ? 12 : av2Reward ? 10 : 6;
  const starsLabel = `${starCount} estrelas conquistadas`;
  return `<div class="site-shell reward-screen">
    <main class="reward-main">
      <section class="reward-card" aria-labelledby="reward-title">
        <div class="reward-stars${av2Reward ? ' av2-reward-stars' : ''}${twelveChallengeReward ? ' av2-addition-reward-stars' : ''}" aria-label="${starsLabel}">${Array.from({ length: starCount }, () => av2Reward ? '<span aria-hidden="true">★</span>' : '★').join(av2Reward ? '' : ' ')}</div>
        <p class="eyebrow">Missão cumprida!</p>
        <h1 id="reward-title">${escapeHtml(rewardMessage.visualText)}</h1>
        <p class="reward-copy">${simuladoReward ? 'Você concluiu o Simulado AV2. Agora é hora de colorir!' : av2Reward && state.av2Block === 'block-06' ? 'Você concluiu os 12 desafios de formar quantias. Agora é hora de colorir!' : av2Reward && state.av2Block === 'block-05' ? 'Você concluiu as 12 questões de sequências e números. Agora é hora de colorir!' : subtractionReward ? 'Você concluiu as 12 questões de subtração. Agora é hora de colorir!' : additionReward ? 'Você concluiu as 12 questões de adição. Agora é hora de colorir!' : av2Reward ? 'Você concluiu as 10 questões sobre dinheiro. Agora é hora de colorir!' : 'Você passou por todas as atividades. Agora é hora de colorir!'}</p>
        ${state.rewardFallback && !state.generatedRewardImage ? renderColoringPage(null) : renderColoringPage(rewardPage)}
        <p class="coloring-generation-status" role="status" aria-live="polite">${state.generatingRewardImage ? 'Criando um desenho novo…' : state.rewardGenerationError ? escapeHtml(state.rewardGenerationError) : ''}</p>
        ${renderAnimalPicker()}
        <div class="reward-actions">
          <button class="primary-button" type="button" data-action="print">🖨 Imprimir meu desenho</button>
          <button class="secondary-button" type="button" data-action="another-coloring-page" ${state.generatingRewardImage ? 'disabled' : ''}>🎨 Ver outro desenho</button>
          ${simuladoReward && state.av2Simulation?.errors.length ? `<button class="secondary-button" type="button" data-action="review-av2-simulado-errors">Praticar as questões que errei (${state.av2Simulation.errors.length})</button>` : ''}
          <button class="secondary-button" type="button" data-action="generate-coloring-page" ${state.generatingRewardImage ? 'disabled' : ''}>${state.generatingRewardImage ? 'Criando desenho…' : '✨ Gerar desenho novo'}</button>
          <button class="secondary-button" type="button" data-action="restart">↻ ${av2Reward ? 'Outra rodada AV2' : 'Jogar novamente'}</button>
          ${additionReward || simuladoReward ? '<button class="secondary-button" type="button" data-action="av2-home">Voltar às atividades AV2</button>' : ''}
          ${av2Reward ? '<button class="secondary-button" type="button" data-action="home">Voltar às revisões</button>' : ''}
          <button class="change-child-home" type="button" data-action="change-child">Trocar criança</button>
        </div>
        ${renderOfficialColoringAction()}
      </section>
    </main>
  </div>`;
}

function renderChangeChildDialog() {
  if (!state.changeChildDialogOpen) return '';
  return `<div class="dialog-backdrop" data-change-child-dialog>
    <section class="change-child-dialog" role="dialog" aria-modal="true" aria-labelledby="change-child-title">
      <h2 id="change-child-title">Trocar criança</h2>
      <p>Deseja trocar o nome da criança neste dispositivo?</p>
      <div class="dialog-actions">
        <button class="secondary-button" type="button" data-action="cancel-change-child">Cancelar</button>
        <button class="primary-button" type="button" data-action="confirm-change-child">Trocar criança</button>
      </div>
    </section>
  </div>`;
}

function updateDocumentTitle() {
  if (state.screen === 'name') {
    document.title = 'Revisão de Matemática | 1º ano Vita';
    return;
  }
  if (state.screen.startsWith('av2-') || state.activeRevision === AV2_REVISION_ID) {
    document.title = `AV2 Matemática de ${currentChildName()} | 1º ano Vita`;
    return;
  }
  document.title = `Revisão de Matemática de ${currentChildName()} | 1º ano Vita`;
}

function destroyVisualSelectionInteraction() {
  visualSelectionInteraction?.destroy();
  visualSelectionInteraction = null;
}

function render() {
  destroyVisualSelectionInteraction();
  if (state.screen === 'name') app.innerHTML = renderNameScreen();
  else if (state.screen === 'home') app.innerHTML = renderHome();
  else if (state.screen === 'av2-home') app.innerHTML = renderAv2Home();
  else if (state.screen === 'av2-simulado-setup') app.innerHTML = renderAv2SimuladoSetup();
  else if (state.screen === 'av2-game') app.innerHTML = renderAv2Game();
  else if (state.screen === 'reward') app.innerHTML = renderReward();
  else app.innerHTML = renderGame();
  app.insertAdjacentHTML('beforeend', renderChangeChildDialog());
  updateDocumentTitle();
  updateSpeechButtons();
  bindEvents();
  if (state.changeChildDialogOpen) document.querySelector('[data-action="cancel-change-child"]')?.focus();
}

function resetRoundState() {
  state.activeRevision = 'classic';
  state.round = [];
  state.currentIndex = 0;
  state.correct = false;
  state.attempts = 0;
  state.selectedKey = null;
  state.answer = {};
  state.activeAddField = null;
  state.hintVisible = false;
  state.parentHelp = false;
  state.rewardPageId = null;
  state.unavailableRewardPageIds = new Set();
  state.rewardFallback = false;
  state.officialOpenFailure = null;
  state.av2Round = [];
  state.av2Index = 0;
  state.av2Correct = false;
  state.av2Attempts = 0;
  state.av2Selected = null;
  state.av2Block = 'block-01';
  state.av2Simulation = null;
  state.av2CompositeStage = 1;
  state.av2CompositeIntermediate = null;
}

function requestChangeChild() {
  state.changeChildDialogOpen = true;
  render();
}

function cancelChangeChild() {
  state.changeChildDialogOpen = false;
  render();
}

function confirmChangeChild() {
  cancelSpeech();
  childProfile.clearName();
  state.childName = null;
  state.childNameDraft = '';
  state.childNameError = false;
  state.changeChildDialogOpen = false;
  resetRoundState();
  state.screen = 'name';
  render();
  document.querySelector('#child-name')?.focus();
}

function submitChildName(event) {
  event.preventDefault();
  const savedName = childProfile.saveName(state.childNameDraft);
  if (!savedName) {
    state.childNameError = true;
    render();
    document.querySelector('#child-name')?.focus();
    return;
  }
  state.childName = savedName;
  state.childNameDraft = savedName;
  state.childNameError = false;
  state.screen = 'home';
  render();
}

function beginRound() {
  cancelSpeech();
  state.activeRevision = 'classic';
  state.screen = 'game';
  state.round = createRound();
  state.currentIndex = 0;
  state.correct = false;
  state.attempts = 0;
  state.selectedKey = null;
  state.answer = {};
  state.activeAddField = null;
  state.hintVisible = false;
  state.parentHelp = false;
  state.rewardPageId = null;
  state.unavailableRewardPageIds = new Set();
  state.rewardFallback = false;
  state.officialOpenFailure = null;
  render();
}

function beginAv2Round(block = 'block-01') {
  if (block === 'block-07') {
    beginAv2SimuladoRound(defaultAv2SimuladoCounts());
    return;
  }
  cancelSpeech();
  state.activeRevision = AV2_REVISION_ID;
  state.av2Block = block;
  state.av2Simulation = null;
  state.screen = 'av2-game';
  state.av2Round = block === 'block-06' ? createAv2MoneyCompositionRound()
    : block === 'block-05' ? createAv2SequencesRound()
    : block === 'block-04' ? createAv2SubtractionRound()
    : block === 'block-03' ? createAv2AdditionRound()
    : block === 'block-02' ? createAv2ShoppingRound() : createAv2Round();
  state.av2Index = 0;
  state.av2Correct = false;
  state.av2Attempts = 0;
  state.av2Selected = null;
  state.av2HintIndex = -1;
  state.av2AdditionAnswer = {};
  state.av2SequenceAnswer = {};
  state.av2AdditionInputError = false;
  state.av2ActiveAdditionField = null;
  state.av2MoneySelection = [];
  state.av2MoneyNextItemId = 0;
  state.av2MoneySolutions = [];
  state.av2MoneyFeedback = null;
  state.av2SimuladoNumericAnswer = '';
  state.av2Pairing = { selectedGroupId: null, selectedProductId: null, matches: {}, matchColors: {} };
  state.av2CompositeFirstTry = { addition: true, subtraction: true };
  state.av2CompositeNotice = '';
  state.rewardPageId = null;
  state.rewardFallback = false;
  state.officialOpenFailure = null;
  render();
}

function beginAv2SimuladoRound(counts, { mode = 'full', preset = 'custom', targets = [] } = {}) {
  cancelSpeech();
  const round = mode === 'focus' ? createAv2SimuladoFocusRound(targets)
    : preset === AV2_SIMULADO_FULL_COVERAGE_PRESET_ID ? createAv2SimuladoFullCoverageRound()
    : createAv2SimuladoRound(counts);
  const normalizedCounts = mode === 'focus' || preset === AV2_SIMULADO_FULL_COVERAGE_PRESET_ID
    ? countSimuladoQuestions(round) : normalizeAv2SimuladoCounts(counts);
  state.activeRevision = AV2_REVISION_ID;
  state.av2Block = 'block-07';
  state.av2Round = round;
  state.av2Simulation = {
    counts: normalizedCounts,
    mode,
    preset,
    errors: [],
    focusTargets: targets.map((target) => ({ ...target })),
  };
  state.screen = 'av2-game';
  state.av2Index = 0;
  state.av2Correct = false;
  state.av2Attempts = 0;
  state.av2Selected = null;
  state.av2HintIndex = -1;
  state.av2AdditionAnswer = {};
  state.av2SequenceAnswer = {};
  state.av2AdditionInputError = false;
  state.av2ActiveAdditionField = null;
  state.av2CompositeStage = 1;
  state.av2CompositeIntermediate = null;
  state.av2CompositeFirstTry = { addition: true, subtraction: true };
  state.av2CompositeNotice = '';
  state.av2SimuladoInputError = '';
  state.av2SimuladoNumericAnswer = '';
  state.av2Pairing = { selectedGroupId: null, selectedProductId: null, matches: {}, matchColors: {} };
  state.av2MoneySelection = [];
  state.av2MoneyNextItemId = 0;
  state.av2MoneySolutions = [];
  state.av2MoneyFeedback = null;
  state.rewardPageId = null;
  state.rewardFallback = false;
  state.officialOpenFailure = null;
  render();
}

function nextQuestion() {
  if (!canAdvance(state.correct)) return;
  cancelSpeech();
  if (state.currentIndex >= state.round.length - 1) {
    selectRewardPage();
    state.screen = 'reward';
    render();
    return;
  }
  state.currentIndex += 1;
  state.correct = false;
  state.attempts = 0;
  state.selectedKey = null;
  state.answer = {};
  state.activeAddField = null;
  state.hintVisible = false;
  state.parentHelp = false;
  render();
}

function nextAv2Question() {
  if (!state.av2Correct) return;
  cancelSpeech();
  if (state.av2Index >= state.av2Round.length - 1) {
    if (state.av2Block === 'block-07') {
      av2SimuladoProgress.completeRound();
      selectRewardPage();
      state.screen = 'reward';
      render();
      return;
    }
    const progressStore = state.av2Block === 'block-06' ? av2MoneyCompositionProgress
      : state.av2Block === 'block-05' ? av2SequencesProgress
      : state.av2Block === 'block-04' ? av2SubtractionProgress
      : state.av2Block === 'block-03' ? av2AdditionProgress
      : state.av2Block === 'block-02' ? av2ShoppingProgress : av2Progress;
    progressStore.completeRound();
    selectRewardPage();
    state.screen = 'reward';
    render();
    return;
  }
  state.av2Index += 1;
  state.av2Correct = false;
  state.av2Attempts = 0;
  state.av2Selected = null;
  state.av2HintIndex = -1;
  state.av2AdditionAnswer = {};
  state.av2SequenceAnswer = {};
  state.av2AdditionInputError = false;
  state.av2ActiveAdditionField = null;
  state.av2CompositeStage = 1;
  state.av2CompositeIntermediate = null;
  state.av2CompositeFirstTry = { addition: true, subtraction: true };
  state.av2CompositeNotice = '';
  state.av2SimuladoInputError = '';
  state.av2SimuladoNumericAnswer = '';
  state.av2Pairing = { selectedGroupId: null, selectedProductId: null, matches: {}, matchColors: {} };
  state.av2MoneySelection = [];
  state.av2MoneyNextItemId = 0;
  state.av2MoneySolutions = [];
  state.av2MoneyFeedback = null;
  render();
}

function wrongAnswer() {
  state.correct = false;
  state.attempts += 1;
  state.hintVisible = false;
  state.parentHelp = false;
  cancelSpeech();
  render();
}

function correctAnswer() {
  state.correct = true;
  cancelSpeech();
  render();
}

function currentQuestion() {
  return state.round[state.currentIndex];
}

function focusVisualOption(shapeKey) {
  document.querySelector(`[data-shape-option="${shapeKey}"]`)?.focus();
}

function selectVisualOption(shapeKey) {
  if (state.correct) return;
  const question = currentQuestion();
  state.selectedKey = shapeKey;
  state.answer = shapeKey;
  if (validateQuestionAnswer(question, shapeKey)) {
    correctAnswer();
    return;
  }
  wrongAnswer();
  focusVisualOption(shapeKey);
}

function selectAv2Option(moneyId) {
  if (state.av2Correct) return;
  const question = state.av2Round[state.av2Index];
  if (state.av2Block === 'block-07' && question.activityId === AV2_SIMULADO_ACTIVITY_ID) {
    if (question.type === 'simulado-shopping-affordability') {
      if (!question.options.includes(moneyId)) return;
      const selected = Array.isArray(state.av2Selected) ? state.av2Selected : [];
      state.av2Selected = selected.includes(moneyId)
        ? selected.filter((id) => id !== moneyId) : [...selected, moneyId];
      state.av2SimuladoInputError = '';
      render();
      return;
    }
    const options = question.type === 'simulado-two-step'
      ? question.data.steps[state.av2CompositeStage - 1].options : question.options;
    if (!options.some((option) => String(typeof option === 'object' ? option.value : option) === String(moneyId))) return;
    state.av2Selected = /^\d+$/.test(String(moneyId)) ? Number(moneyId) : moneyId;
    render();
    return;
  }
  if (question?.type === 'shopping-affordability') {
    if (!question.options.includes(moneyId)) return;
    const selected = Array.isArray(state.av2Selected) ? state.av2Selected : [];
    state.av2Selected = selected.includes(moneyId)
      ? selected.filter((id) => id !== moneyId)
      : [...selected, moneyId];
    render();
    return;
  }
  const answer = question?.options.includes(moneyId) ? moneyId
    : question?.options.includes(Number(moneyId)) ? Number(moneyId) : null;
  if (answer === null) return;
  state.av2Selected = answer;
  if (question.activityId === 'av2-sequences' && ['NUM-05','NUM-06'].includes(question.category)) {
    render();
    return;
  }
  const isCorrect = question.activityId === 'av2-sequences' ? validateAv2SequencesAnswer(question, answer)
    : question.activityId === AV2_SUBTRACTION_ACTIVITY_ID
    ? validateAv2SubtractionAnswer(question, answer)
    : question.activityId === AV2_ADDITION_ACTIVITY_ID
    ? validateAv2AdditionAnswer(question, answer)
    : validateAv2Answer(question, answer);
  if (isCorrect) {
    recordSimuladoAttempt(question, true);
    state.av2Correct = true;
    cancelSpeech();
    render();
    return;
  }
  recordSimuladoAttempt(question, false);
  state.av2Attempts += 1;
  if ([AV2_ADDITION_ACTIVITY_ID, AV2_SUBTRACTION_ACTIVITY_ID].includes(question.activityId)) {
    state.av2HintIndex = Math.min(state.av2HintIndex + 1, question.hints.length - 1);
  }
  cancelSpeech();
  render();
  document.querySelector(`[data-av2-answer="${moneyId}"]`)?.focus();
}

function addAv2MoneySelection(moneyId) {
  if (state.av2Correct) return;
  const question = state.av2Round[state.av2Index];
  if (question?.activityId !== AV2_MONEY_COMPOSITION_ACTIVITY_ID
    || !question.allowedDenominationIds.includes(moneyId)) return;
  const counts = countMoneyCompositionSelection(state.av2MoneySelection);
  if (state.av2MoneySelection.length >= question.maxItems || (counts[moneyId] ?? 0) >= question.quantityLimits[moneyId]) return;
  state.av2MoneySelection = [...state.av2MoneySelection, { key: state.av2MoneyNextItemId++, denominationId: moneyId }];
  if (state.av2MoneyFeedback !== 'first-way') state.av2MoneyFeedback = null;
  render();
}

function removeAv2MoneySelection(itemKey) {
  if (state.av2Correct) return;
  const numericKey = Number(itemKey);
  const nextSelection = state.av2MoneySelection.filter(({ key }) => key !== numericKey);
  if (nextSelection.length === state.av2MoneySelection.length) return;
  state.av2MoneySelection = nextSelection;
  if (state.av2MoneyFeedback !== 'first-way') state.av2MoneyFeedback = null;
  render();
}

function clearAv2MoneySelection() {
  if (state.av2Correct || state.av2MoneySelection.length === 0) return;
  state.av2MoneySelection = [];
  if (state.av2MoneyFeedback !== 'first-way') state.av2MoneyFeedback = null;
  render();
}

function submitAv2MoneyCompositionAnswer(question) {
  if (state.av2Correct) return;
  const counts = countMoneyCompositionSelection(state.av2MoneySelection);
  const result = validateAv2MoneyCompositionSelection(question, counts, state.av2MoneySolutions);
  state.av2MoneyFeedback = result.reason;
  if (state.av2Block === 'block-07' && question.simulado) {
    recordSimuladoAttempt(question, result.correct);
  }
  if (result.correct) {
    state.av2MoneySolutions = [...state.av2MoneySolutions, { ...counts }];
    state.av2MoneySelection = [];
    if (state.av2MoneySolutions.length >= question.requiredDistinctSolutions) {
      state.av2Correct = true;
      state.av2MoneyFeedback = null;
    } else {
      state.av2Attempts = 0;
      state.av2HintIndex = -1;
      state.av2MoneyFeedback = 'first-way';
    }
  } else if (result.reason !== 'duplicate-combination') {
    state.av2Attempts += 1;
  }
  cancelSpeech();
  render();
}

function submitAv2Answer() {
  if (state.av2Correct) return;
  const question = state.av2Round[state.av2Index];
  if (state.av2Block === 'block-07' && question.type === 'simulado-two-step') {
    const stage = state.av2CompositeStage;
    const step = question.data.steps[stage - 1];
    let answer;
    let invalidRegrouping = false;
    if (step.kind === 'terms') {
      answer = Object.fromEntries([...document.querySelectorAll('[data-simulado-term-role]')]
        .map((select) => [select.dataset.simuladoTermRole, select.value]));
      if (Object.keys(answer).length !== Object.keys(step.expectedRoles).length || Object.values(answer).some((value) => !value)) {
        state.av2SimuladoInputError = 'Escolha o nome de cada parte da operação antes de conferir.';
        render();
        return;
      }
    } else {
      const fields = [...document.querySelectorAll('[data-av2-add-field]')];
      const values = Object.fromEntries(fields.map((input) => [input.dataset.av2AddField, input.value]));
      const required = step.operation === 'addition' && step.question.data.result < 100
        ? ['tens', 'units'] : ['hundreds', 'tens', 'units'];
      if (required.some((name) => !/^\d$/.test(values[name] ?? ''))) {
        state.av2SimuladoInputError = step.operation === 'addition'
          ? 'Preencha as casas da soma antes de conferir.' : 'Digite a diferença antes de conferir.';
        render();
        return;
      }
      const editedBorrowFields = fields.filter((input) => input.dataset.av2AddField.startsWith('borrow')
        && input.dataset.borrowEdited === 'true');
      invalidRegrouping = editedBorrowFields.some((input) => {
        const column = input.dataset.av2AddField.slice(6).toLowerCase();
        return !/^\d{1,2}$/.test(input.value) || Number(input.value) !== step.question.data.trace.adjusted[column];
      });
      answer = Number(required.map((name) => values[name]).join(''));
    }
    const intermediateIsPreserved = stage !== 3 || state.av2CompositeIntermediate === step.question.data.a;
    const isCorrect = !invalidRegrouping && intermediateIsPreserved
      && validateAv2SimuladoAnswer(question, answer, stage);
    state.av2SimuladoInputError = invalidRegrouping
      ? 'Confira as trocas: quando uma coluna recebe 10, o vizinho perde 1.' : '';
    recordSimuladoStageAttempt(question, isCorrect, step.subjectId, {
      complete: isCorrect && step.kind === 'terms',
      firstTry: state.av2CompositeFirstTry[step.operation] && state.av2Attempts === 0,
    });
    if (!isCorrect) {
      state.av2CompositeFirstTry[step.operation] = false;
      state.av2Attempts += 1;
      state.av2HintIndex = Math.min(state.av2HintIndex + 1, step.kind === 'operation'
        ? step.question.hints.length - 1 : 0);
    } else if (stage === 1) {
      state.av2CompositeIntermediate = step.result;
      state.av2CompositeStage = 2;
      state.av2Selected = {};
      state.av2Attempts = 0;
      state.av2HintIndex = -1;
      state.av2AdditionAnswer = {};
      state.av2SimuladoInputError = '';
      state.av2CompositeNotice = 'A adição foi conferida. Agora identifique as parcelas e a soma.';
    } else if (stage === 2) {
      state.av2CompositeStage = 3;
      state.av2Selected = {};
      state.av2Attempts = 0;
      state.av2HintIndex = -1;
      state.av2AdditionAnswer = {};
      state.av2SimuladoInputError = '';
      state.av2CompositeNotice = 'A soma confirmada foi guardada para a próxima etapa.';
    } else if (stage === 3) {
      state.av2CompositeStage = 4;
      state.av2Selected = {};
      state.av2Attempts = 0;
      state.av2HintIndex = -1;
      state.av2AdditionAnswer = {};
      state.av2SimuladoInputError = '';
      state.av2CompositeNotice = 'A subtração foi conferida. Agora identifique seus termos.';
    } else {
      state.av2Correct = true;
      state.av2SimuladoInputError = '';
    }
    cancelSpeech();
    render();
    return;
  }
  if (state.av2Block === 'block-07' && question.type === 'simulado-money-product-match') {
    const answer = { ...state.av2Pairing.matches };
    if (Object.keys(answer).length !== question.data.groups.length) {
      state.av2SimuladoInputError = 'Associe todos os grupos antes de conferir.';
      render();
      return;
    }
    const isCorrect = validateAv2SimuladoAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    state.av2SimuladoInputError = '';
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && question.type === 'simulado-shopping-affordability') {
    const answer = Array.isArray(state.av2Selected) ? state.av2Selected : [];
    if (!answer.length) {
      state.av2SimuladoInputError = 'Marque os brinquedos que Rael pode comprar.';
      render(); return;
    }
    const isCorrect = validateAv2SimuladoAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    state.av2SimuladoInputError = '';
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && question.type === 'simulado-number-table') {
    state.av2SequenceAnswer = Object.fromEntries([...document.querySelectorAll('[data-table-gap]')]
      .map((input) => [input.dataset.tableGap, input.value]));
    const table = question.data.table;
    const complete = table.gaps.every((index) => String(state.av2SequenceAnswer[index] ?? '').trim() !== '');
    if (!complete) {
      state.av2SimuladoInputError = 'Preencha todos os espaços vazios antes de conferir a tabela.';
      render(); return;
    }
    state.av2SimuladoInputError = '';
    const isCorrect = validateAv2SimuladoAnswer(question, state.av2SequenceAnswer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && ['simulado-shopping-total', 'simulado-shopping-change'].includes(question.type)) {
    const answer = state.av2SimuladoNumericAnswer;
    state.av2SimuladoNumericAnswer = answer;
    if (!String(answer).trim()) {
      state.av2SimuladoInputError = 'Informe o valor em reais antes de conferir.';
      render(); return;
    }
    state.av2SimuladoInputError = '';
    const isCorrect = validateAv2SimuladoAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && question.type === 'simulado-product-board' && question.options.length === 0) {
    const answer = state.av2SimuladoNumericAnswer;
    state.av2SimuladoNumericAnswer = answer;
    if (!String(answer).trim()) {
      state.av2SimuladoInputError = 'Informe o total em reais antes de conferir.';
      render(); return;
    }
    state.av2SimuladoInputError = '';
    const isCorrect = validateAv2SimuladoAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && ['simulado-sequence', 'simulado-word', 'simulado-association'].includes(question.type)) {
    if (question.type === 'simulado-association') {
      state.av2Selected = Object.fromEntries([...document.querySelectorAll('[data-av2-association-answer]')]
        .map((select) => [select.dataset.av2AssociationAnswer, select.value]));
      const complete = Object.values(state.av2Selected).every(Boolean);
      if (!complete) {
        state.av2SimuladoInputError = 'Associe os três números antes de conferir.';
        render();
        return;
      }
    }
    state.av2SimuladoInputError = '';
    const isCorrect = validateAv2SimuladoAnswer(question, state.av2Selected);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (!isCorrect) {
      state.av2Attempts += 1;
      state.av2HintIndex = Math.min(state.av2HintIndex + 1, 1);
    }
    cancelSpeech();
    render();
    return;
  }
  if (state.av2Block === 'block-07' && question.type === 'simulado-product-board' && question.options.length > 0) {
    const isCorrect = validateAv2SimuladoAnswer(question, state.av2Selected);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (!isCorrect) state.av2Attempts += 1;
    cancelSpeech(); render(); return;
  }
  if (question.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID) {
    submitAv2MoneyCompositionAnswer(question);
    return;
  }
  if (question.activityId === 'av2-sequences') {
    if(question.type === 'number-table') state.av2SequenceAnswer = Object.fromEntries([...document.querySelectorAll('[data-table-gap]')].map(input=>[input.dataset.tableGap,input.value]));
    else if(question.type === 'sequence' || question.category === 'NUM-03') state.av2SequenceAnswer={value:document.querySelector('[data-sequence-answer]')?.value ?? ''};
    const answer=question.type==='number-table'?state.av2SequenceAnswer:question.type==='sequence'||question.category==='NUM-03'?state.av2SequenceAnswer.value:state.av2Selected;
    if((question.type==='sequence'||question.category==='NUM-03')&&!String(answer).trim()){state.av2Attempts++;render();return;}
    if(['NUM-05','NUM-06'].includes(question.category)&&(answer===null||answer===undefined)){state.av2Attempts++;render();return;}
    state.av2Selected=answer;state.av2Correct=validateAv2SequencesAnswer(question,answer);if(!state.av2Correct)state.av2Attempts++;cancelSpeech();render();return;
  }
  if (question.activityId === AV2_SUBTRACTION_ACTIVITY_ID && question.type !== 'terms') {
    const allFields = [...document.querySelectorAll('[data-av2-add-field]')];
    const fields = allFields.filter((field) => !field.dataset.av2AddField.startsWith('borrow'));
    const values = fields.map((field) => field.value);
    // Leading blank places are allowed; a missing units digit is never coerced to zero.
    const raw = values.join('').trim();
    if (!raw || !/^\d$/.test(values[values.length - 1] ?? '') || values.some((v) => v !== '' && !/^\d$/.test(v))) {
      state.av2AdditionInputError = 'Digite a diferença antes de conferir.';
      render(); return;
    }
    const answer = Number(values.map((v) => v === '' ? '0' : v).join(''));
    state.av2AdditionInputError = false;
    state.av2Selected = answer;
    const editedMinuend = allFields.some((field) => field.dataset.av2AddField.startsWith('borrow')
      && field.value !== String(question.data.trace.original[field.dataset.av2AddField.slice(6).toLowerCase()]));
    const invalidBorrow = editedMinuend && allFields.find((field) => {
      const name = field.dataset.av2AddField;
      if (!name.startsWith('borrow')) return false;
      const column = name.slice(6).toLowerCase();
      return !/^\d{1,2}$/.test(field.value) || Number(field.value) !== question.data.trace.adjusted[column];
    });
    const isCorrect = !invalidBorrow && validateAv2SubtractionAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    state.av2Correct = isCorrect;
    if (invalidBorrow) state.av2AdditionInputError = 'Confira as trocas: quando uma coluna recebe 10, o vizinho perde 1. Registre os valores depois de todas as trocas.';
    if (!state.av2Correct) {
      state.av2Attempts += 1;
      state.av2HintIndex = Math.min(state.av2HintIndex + 1, question.hints.length - 1);
    }
    cancelSpeech(); render(); return;
  }
  if (question.activityId === AV2_ADDITION_ACTIVITY_ID && question.type !== 'terms') {
    const requiredFields = question.data.result >= 100 ? ['hundreds', 'tens', 'units'] : ['tens', 'units'];
    const inputs = [...document.querySelectorAll('[data-av2-add-field]')];
    const values = Object.fromEntries(inputs.map((input) => [input.dataset.av2AddField, input.value]));
    const missingField = requiredFields.find((field) => !/^\d$/.test(values[field] ?? ''));
    if (missingField) {
      state.av2AdditionInputError = 'Preencha as casas do resultado antes de conferir.';
      render();
      document.querySelector(`[data-av2-add-field="${missingField}"]`)?.focus();
      return;
    }
    state.av2AdditionInputError = false;
    const incorrectCarry = [
      ['carryHundreds', question.data.trace.carries.toHundreds],
      ['carryTens', question.data.trace.carries.toTens],
    ].find(([field, expected]) => values[field] !== '' && Number(values[field]) !== expected);
    if (incorrectCarry) {
      const [field] = incorrectCarry;
      state.av2AdditionInputError = 'Confira o número que você escreveu na casa da reserva.';
      recordSimuladoAttempt(question, false);
      state.av2Attempts += 1;
      state.av2HintIndex = Math.min(state.av2HintIndex + 1, question.hints.length - 1);
      cancelSpeech();
      render();
      document.querySelector(`[data-av2-add-field="${field}"]`)?.focus();
      return;
    }
    const answer = Number(requiredFields.map((field) => values[field]).join(''));
    state.av2Selected = answer;
    const isCorrect = validateAv2AdditionAnswer(question, answer);
    recordSimuladoAttempt(question, isCorrect);
    if (isCorrect) {
      state.av2Correct = true;
    } else {
      state.av2Attempts += 1;
      state.av2HintIndex = Math.min(state.av2HintIndex + 1, question.hints.length - 1);
    }
    cancelSpeech();
    render();
    return;
  }
  const answer = Array.isArray(state.av2Selected) ? state.av2Selected : [];
  const isCorrect = validateAv2Answer(question, answer);
  recordSimuladoAttempt(question, isCorrect);
  if (isCorrect) {
    state.av2Correct = true;
  } else {
    state.av2Attempts += 1;
  }
  cancelSpeech();
  render();
}

function requestAv2Hint() {
  if (state.av2Correct) return;
  const question = state.av2Round[state.av2Index];
  if (question?.activityId === AV2_MONEY_COMPOSITION_ACTIVITY_ID) {
    if (state.av2HintIndex >= 0) return;
    state.av2HintIndex = 0;
    cancelSpeech();
    render();
    return;
  }
  if (state.av2Block === 'block-07' && question?.type === 'simulado-two-step') {
    const step = question.data.steps[state.av2CompositeStage - 1];
    if (step.kind === 'operation') {
      const maximumIndex = step.question.hints.length - 1;
      if (state.av2HintIndex >= maximumIndex) return;
      state.av2HintIndex += 1;
    } else {
      if (state.av2HintIndex >= 0) return;
      state.av2HintIndex = 0;
    }
    cancelSpeech(); render(); return;
  }
  if (state.av2Block === 'block-07' && question?.activityId === AV2_SIMULADO_ACTIVITY_ID) {
    if (state.av2HintIndex >= 0) return;
    state.av2HintIndex = 0;
    cancelSpeech(); render(); return;
  }
  if (![AV2_ADDITION_ACTIVITY_ID, AV2_SUBTRACTION_ACTIVITY_ID].includes(question?.activityId) || !question.hints?.length) return;
  const maximumIndex = question.activityId === AV2_SUBTRACTION_ACTIVITY_ID ? question.hints.length - 1
    : state.av2Attempts === 0 ? 0 : question.hints.length - 1;
  if (state.av2HintIndex >= maximumIndex) return;
  state.av2HintIndex += 1;
  render();
}

function collectInputAnswers() {
  const question = currentQuestion();
  if (question.type === 'addition') {
    return Object.fromEntries([...document.querySelectorAll('[data-add-field]')].map((input) => [input.dataset.addField, input.value]));
  }
  if (question.type === 'neighbor') {
    return Object.fromEntries([...document.querySelectorAll('[data-neighbor-field]')].map((input) => [input.dataset.neighborField, input.value]));
  }
  if (question.type === 'unknown') return Number(document.querySelector('[data-unknown-field]')?.value ?? '');
  return state.answer;
}

function checkAnswer() {
  const question = currentQuestion();
  const answer = collectInputAnswers();
  state.answer = answer;
  if (validateQuestionAnswer(question, answer)) correctAnswer();
  else wrongAnswer();
}

function focusNextInput(input, selector, maxLength = 1) {
  if (input.value.length !== maxLength) return;
  const inputs = [...document.querySelectorAll(selector)];
  const index = inputs.indexOf(input);
  inputs[index + 1]?.focus();
}

function sanitizeDigitInput(input, maxLength = 1) {
  input.value = input.value.replace(/[^0-9]/g, '').slice(0, maxLength);
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const action = element.dataset.action;
      if (action === 'start') beginRound();
      if (action === 'start-av2') beginAv2Round();
      if (action === 'start-av2-shopping') beginAv2Round('block-02');
      if (action === 'start-av2-addition') beginAv2Round('block-03');
      if (action === 'start-av2-subtraction') beginAv2Round('block-04');
      if (action === 'open-av2-simulado-setup') {
        state.screen = 'av2-simulado-setup';
        render();
      }
      if (action === 'start-av2-simulado') {
        const counts = readAv2SimuladoSetup();
        state.av2SimuladoSetup = Object.fromEntries(AV2_SIMULADO_SUBJECTS.map(({ id }) => [id, counts[id] ?? 0]));
        if (Object.keys(counts).length) beginAv2SimuladoRound(counts);
      }
      if (action === 'start-av2-full-simulado') {
        beginAv2SimuladoRound(null, { preset: AV2_SIMULADO_FULL_COVERAGE_PRESET_ID });
      }
      if (action === 'review-av2-simulado-errors') {
        const targets = state.av2Simulation?.errors.map((target) => ({ ...target })) ?? [];
        if (targets.length) beginAv2SimuladoRound(null, { mode: 'focus', targets });
      }
      if (action === 'generate-coloring-page') openAnimalPicker();
      if (action === 'refresh-animal-suggestions') openAnimalPicker();
      if (action === 'cancel-animal-picker' && !state.generatingRewardImage) {
        state.animalPickerOpen = false;
        state.rewardGenerationError = '';
        render();
        document.querySelector('[data-action="generate-coloring-page"]')?.focus();
      }
      if (action === 'start-av2-sequences') beginAv2Round('block-05');
      if (action === 'start-av2-money-composition') beginAv2Round('block-06');
      if (action === 'restart') {
        if (state.activeRevision === AV2_REVISION_ID) beginAv2Round(state.av2Block);
        else beginRound();
      }
      if (action === 'av2-entry') {
        cancelSpeech();
        state.activeRevision = AV2_REVISION_ID;
        state.screen = 'av2-home';
        render();
      }
      if (action === 'change-child') requestChangeChild();
      if (action === 'cancel-change-child') cancelChangeChild();
      if (action === 'confirm-change-child') confirmChangeChild();
      if (action === 'home') {
        cancelSpeech();
        state.activeRevision = 'classic';
        state.screen = 'home';
        render();
      }
      if (action === 'av2-home') {
        cancelSpeech();
        state.activeRevision = AV2_REVISION_ID;
        state.screen = 'av2-home';
        render();
      }
      if (action === 'next') nextQuestion();
      if (action === 'next-av2') nextAv2Question();
      if (action === 'submit-av2') submitAv2Answer();
      if (action === 'av2-hint') requestAv2Hint();
      if (action === 'clear-av2-money') clearAv2MoneySelection();
      if (action === 'check-answer') checkAnswer();
      if (action === 'hint') {
        state.hintVisible = true;
        state.parentHelp = false;
        render();
      }
      if (action === 'parent-help') {
        state.parentHelp = true;
        state.hintVisible = false;
        render();
      }
      if (action === 'another-coloring-page') showAnotherColoringPage();
      if (action === 'open-official-coloring') openOfficialColoringPage();
      if (action === 'print') window.print();
    });
  });

  const animalDialog = document.querySelector('[data-animal-dialog]');
  animalDialog?.showModal?.();
  if (state.generatingRewardImage) document.querySelector('#animal-picker-title')?.focus();
  animalDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (state.generatingRewardImage) return;
    state.animalPickerOpen = false;
    state.rewardGenerationError = '';
    render();
    document.querySelector('[data-action="generate-coloring-page"]')?.focus();
  });
  document.querySelector('#coloring-animal')?.addEventListener('input', (event) => { state.animalDraft = event.target.value; });
  document.querySelector('[data-animal-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    generateRewardColoringPage(state.animalDraft, 'typed');
  });
  document.querySelectorAll('[data-animal-suggestion]').forEach((button) => {
    button.addEventListener('click', () => generateRewardColoringPage(button.dataset.animalSuggestion, 'suggestion'));
  });

  document.querySelector('[data-child-name-form]')?.addEventListener('submit', submitChildName);
  const childNameInput = document.querySelector('#child-name');
  const childNameSubmit = document.querySelector('[data-child-name-submit]');
  childNameInput?.addEventListener('input', () => {
    state.childNameDraft = childNameInput.value;
    childNameSubmit.disabled = !isValidChildName(childNameInput.value);
    if (state.childNameError) {
      state.childNameError = false;
      childNameInput.removeAttribute('aria-invalid');
      const error = document.querySelector('#child-name-error');
      if (error) error.hidden = true;
    }
  });
  childNameInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !isValidChildName(childNameInput.value)) return;
    event.preventDefault();
    submitChildName(event);
  });

  document.querySelectorAll('[data-coloring-image]').forEach((image) => {
    image.addEventListener('error', () => handleColoringAssetError(image.dataset.coloringImage));
  });
  document.querySelector('[data-generated-coloring-image]')?.addEventListener('error', handleGeneratedColoringImageError);

  document.querySelectorAll('[data-speech-button]').forEach((button) => {
    button.addEventListener('click', () => {
      speak(button.dataset.speechButton, button.dataset.speechText);
    });
  });

  document.querySelectorAll('[data-av2-answer]').forEach((button) => {
    button.addEventListener('click', () => selectAv2Option(button.dataset.av2Answer));
  });

  document.querySelectorAll('[data-match-group]').forEach((button) => {
    button.addEventListener('click', () => {
      const question = state.av2Round[state.av2Index];
      if (state.av2Correct || question?.type !== 'simulado-money-product-match') return;
      const groupId = button.dataset.matchGroup;
      if (state.av2Pairing.matches[groupId]) return;
      state.av2Pairing = {
        ...state.av2Pairing,
        selectedGroupId: state.av2Pairing.selectedGroupId === groupId ? null : groupId,
        selectedProductId: null,
      };
      state.av2SimuladoInputError = '';
      render();
    });
  });
  document.querySelectorAll('[data-match-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const question = state.av2Round[state.av2Index];
      if (state.av2Correct || question?.type !== 'simulado-money-product-match') return;
      const groupId = state.av2Pairing.selectedGroupId;
      const productId = button.dataset.matchProduct;
      if (!groupId) {
        state.av2SimuladoInputError = 'Escolha primeiro um grupo de cédulas.';
        render(); return;
      }
      if (state.av2Pairing.matches[groupId] || Object.values(state.av2Pairing.matches).includes(productId)) return;
      if (question.correctAnswer[groupId] === productId) {
        const color = simuladoPairColors[Object.keys(state.av2Pairing.matches).length % simuladoPairColors.length];
        state.av2Pairing = {
          ...state.av2Pairing,
          selectedGroupId: null,
          selectedProductId: null,
          matches: { ...state.av2Pairing.matches, [groupId]: productId },
          matchColors: { ...state.av2Pairing.matchColors, [groupId]: color },
        };
        state.av2SimuladoInputError = '';
      } else {
        state.av2Pairing = { ...state.av2Pairing, selectedProductId: productId };
        recordSimuladoAttempt(question, false);
        state.av2Attempts += 1;
        state.av2SimuladoInputError = 'Esse brinquedo tem outro preço. Compare os valores e tente novamente.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-simulado-subject]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const subjectId = checkbox.dataset.simuladoSubject;
      const count = Number(document.querySelector(`[data-simulado-count="${subjectId}"]`)?.value) || AV2_SIMULADO_DEFAULT_QUESTIONS_PER_SUBJECT;
      state.av2SimuladoSetup[subjectId] = checkbox.checked ? count : 0;
      render();
    });
  });
  document.querySelectorAll('[data-simulado-count]').forEach((select) => {
    select.addEventListener('change', () => {
      const subjectId = select.dataset.simuladoCount;
      if (state.av2SimuladoSetup[subjectId] > 0) state.av2SimuladoSetup[subjectId] = Number(select.value);
      render();
    });
  });

  document.querySelectorAll('[data-av2-association-answer]').forEach((select) => {
    select.addEventListener('change', () => {
      state.av2Selected = { ...(state.av2Selected ?? {}), [select.dataset.av2AssociationAnswer]: select.value };
      state.av2SimuladoInputError = '';
      document.querySelector('[data-av2-question-type="simulado-association"] .av2-addition-input-error')?.remove();
      const submitButton = document.querySelector('[data-action="submit-av2"]');
      if (submitButton) submitButton.disabled = [...document.querySelectorAll('[data-av2-association-answer]')].some((field) => !field.value);
    });
  });
  document.querySelectorAll('[data-simulado-term-role]').forEach((select) => {
    select.addEventListener('change', () => {
      state.av2Selected = { ...(state.av2Selected ?? {}), [select.dataset.simuladoTermRole]: select.value };
      state.av2SimuladoInputError = '';
    });
  });

  document.querySelectorAll('[data-simulado-numeric-answer]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.simuladoNumericAnswer !== undefined) sanitizeDigitInput(input, 3);
      state.av2SimuladoNumericAnswer = input.value;
      state.av2SimuladoInputError = '';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); submitAv2Answer(); }
    });
  });

  document.querySelectorAll('[data-add-money]').forEach((button) => {
    button.addEventListener('click', () => addAv2MoneySelection(button.dataset.addMoney));
  });

  document.querySelectorAll('[data-remove-money-item]').forEach((button) => {
    button.addEventListener('click', () => removeAv2MoneySelection(button.dataset.removeMoneyItem));
  });

  const visualOptions = [...document.querySelectorAll('[data-shape-option]')];
  if (visualOptions.length > 0) {
    visualSelectionInteraction = createVisualSelectionInteraction({
      options: visualOptions,
      onSelect: (shapeKey) => selectVisualOption(shapeKey),
    });
  }

  document.querySelectorAll('[data-add-field]').forEach((input) => {
    input.addEventListener('focus', () => {
      state.activeAddField = input.dataset.addField;
    });
    input.addEventListener('input', () => {
      sanitizeDigitInput(input);
      state.answer[input.dataset.addField] = input.value;
      focusNextInput(input, '[data-add-field]');
    });
  });

  document.querySelectorAll('[data-av2-add-field]').forEach((input) => {
    input.addEventListener('focus', () => {
      state.av2ActiveAdditionField = input.dataset.av2AddField;
      if (input.dataset.av2AddField.startsWith('borrow')) input.select?.();
    });
    input.addEventListener('input', () => {
      const borrowing = input.dataset.av2AddField.startsWith('borrow');
      if (borrowing) input.dataset.borrowEdited = 'true';
      sanitizeDigitInput(input, borrowing ? 2 : 1);
      state.av2AdditionAnswer[input.dataset.av2AddField] = input.value;
      state.av2AdditionInputError = false;
      if (!borrowing) focusNextInput(input, '[data-av2-add-field]');
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); submitAv2Answer(); }
    });
  });

  document.querySelectorAll('[data-sequence-answer], [data-table-gap]').forEach(input => {
    input.addEventListener('input',()=>{state.av2SequenceAnswer[input.dataset.tableGap ?? 'value']=input.value;});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submitAv2Answer();}});
  });

  document.querySelectorAll('[data-neighbor-field]').forEach((input) => {
    input.addEventListener('input', () => {
      sanitizeDigitInput(input, 3);
      state.answer[input.dataset.neighborField] = input.value;
      focusNextInput(input, '[data-neighbor-field]', 3);
    });
  });

  document.querySelectorAll('[data-unknown-field]').forEach((input) => {
    input.addEventListener('input', () => {
      sanitizeDigitInput(input);
      state.answer.value = input.value;
    });
  });

  document.querySelectorAll('[data-word-option]').forEach((option) => {
    option.addEventListener('click', () => {
      state.answer.option = Number(option.dataset.wordOption);
      render();
      document.querySelector(`[data-word-option="${option.dataset.wordOption}"]`)?.focus();
    });
  });

  document.querySelectorAll('[data-pad-digit]').forEach((button) => {
    button.addEventListener('click', () => {
      const active = state.activeAddField ? document.querySelector(`[data-add-field="${state.activeAddField}"]`) : null;
      const empty = [...document.querySelectorAll('[data-add-field]')].find((input) => !input.value);
      const target = active || empty || document.querySelector('[data-add-field]');
      if (!target) return;
      target.value = button.dataset.padDigit;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus();
    });
  });

  document.querySelector('[data-pad-clear]')?.addEventListener('click', () => {
    state.answer = {};
    state.activeAddField = null;
    document.querySelectorAll('[data-add-field]').forEach((input) => { input.value = ''; });
    document.querySelector('[data-add-field]')?.focus();
  });

  document.querySelectorAll('[data-av2-add-digit]').forEach((button) => {
    button.addEventListener('click', () => {
      const additionFields = [...document.querySelectorAll('[data-av2-add-field]')];
      const active = additionFields.find((input) => input.dataset.av2AddField === state.av2ActiveAdditionField);
      const resultFields = additionFields.filter((input) => !input.dataset.av2AddField.startsWith('carry') && !input.dataset.av2AddField.startsWith('borrow'));
      const empty = resultFields.find((input) => !input.value);
      const target = active || empty || document.querySelector('[data-av2-add-field="units"]');
      if (!target) return;
      target.value = target.dataset.av2AddField.startsWith('borrow')
        ? (target.dataset.borrowEdited !== 'true' || target.value.length >= 2 ? '' : target.value) + button.dataset.av2AddDigit
        : button.dataset.av2AddDigit;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.querySelector('[data-av2-add-clear]')?.addEventListener('click', () => {
    state.av2AdditionAnswer = {};
    state.av2ActiveAdditionField = null;
    state.av2AdditionInputError = false;
    document.querySelectorAll('[data-av2-add-field]').forEach((input) => {
      const name = input.dataset.av2AddField;
      const trace = state.av2Round[state.av2Index]?.data.trace;
      input.value = name.startsWith('borrow') ? String(trace.original[name.slice(6).toLowerCase()]) : '';
      input.dataset.borrowEdited = '';
    });
    document.querySelector('[data-av2-add-field="units"]')?.focus();
  });
}

render();
