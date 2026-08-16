import {
  ACTIVITY_NAMES,
  createRound,
  numberToPortuguese,
  numberToDigits,
  validateQuestionAnswer,
  canAdvance,
} from './src/game.js';
import { renderSpatialSvg } from './src/figures.js';
import {
  REWARD_MESSAGE,
  getColoringPageById,
  isLocalColoringPage,
  pickColoringPage,
} from './src/data/coloringPages.js';
import { createTtsClient } from './src/tts-client.js';

const app = document.querySelector('#app');

const state = {
  screen: 'home',
  round: [],
  currentIndex: 0,
  correct: false,
  attempts: 0,
  selectedKey: null,
  connection: null,
  answer: {},
  activeAddField: null,
  hintVisible: false,
  parentHelp: false,
  rewardPageId: null,
  lastRewardPageId: null,
  unavailableRewardPageIds: new Set(),
  rewardFallback: false,
};

const positiveMessages = [
  'Você acertou! Parabéns! 🌟',
  'Muito bem, Marina! 💛',
  'Excelente! Vamos continuar?',
  'Mandou muito bem! ✨',
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

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function renderSpeechButton(kind, text, customLabel = null) {
  const label = customLabel ?? (kind === 'question' ? 'Ouvir pergunta' : kind === 'celebration' ? 'Ouvir parabéns' : 'Ouvir explicação');
  const active = speech.active?.kind === kind;
  const loading = active && speech.active.phase === 'loading';
  return `<button class="speech-button${active ? ' is-speaking' : ''}" type="button" data-speech-button="${kind}" data-speech-text="${escapeAttribute(text)}" data-default-label="${label}" aria-label="${active ? 'Parar leitura' : label}" aria-pressed="${active}" aria-busy="${loading}" data-speaking="${active}"${loading ? ' disabled' : ''}>
    <span class="speech-icon" aria-hidden="true">${active ? '■' : '🔊'}</span><span class="speech-label">${active ? 'Parar leitura' : label}</span>
  </button>`;
}

function renderProgress() {
  return `<div class="progress-dots" aria-label="Progresso: atividade ${state.currentIndex + 1} de 6">
    ${ACTIVITY_NAMES.map((name, index) => `<span class="progress-dot ${index < state.currentIndex ? 'is-complete' : ''} ${index === state.currentIndex ? 'is-current' : ''}" title="${name}" aria-hidden="true">${index < state.currentIndex ? '★' : '☆'}</span>`).join('')}
  </div>`;
}

function renderGuide(message = 'Vamos com calma! Você consegue!') {
  return `<div class="guide" role="img" aria-label="Luna, uma gatinha professora, está torcendo por Marina.">
    <div class="cat-avatar" aria-hidden="true"><span class="cat-ear left"></span><span class="cat-ear right"></span><span class="cat-face"><i></i><i></i><b></b><em></em></span><span class="cat-book">＋</span></div>
    <p class="guide-bubble">${message}</p>
  </div>`;
}

function renderHeader() {
  return `<header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="Voltar para a apresentação">Marina <span>★</span></a>
    ${renderProgress()}
    <button class="restart-button" type="button" data-action="restart" aria-label="Começar uma nova rodada">↻ <span>Recomeçar</span></button>
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
  const label = question.representation === 'object' ? objectNames[question.shapeKey] : `figura ${question.spokenShapeName}`;
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
  const label = question.representation === 'object' ? objectNames[question.shapeKey] : `forma espacial ${question.spokenShapeName}`;
  return `<div class="spatial-graphic ${question.shapeKey} ${question.representation}" role="img" aria-label="${label}">${renderSpatialSvg(question.shapeKey, question.representation)}</div>`;
}

function renderMatchingQuestion(question) {
  const isFlat = question.type === 'flat';
  const visual = isFlat ? renderFlatGraphic(question) : renderSpatialGraphic(question);
  const selected = state.selectedKey === question.shapeKey;
  return `<div class="matching-area">
    <div class="matching-column">
      <span class="column-title">Nome</span>
      <button class="name-card ${selected ? 'is-selected' : ''}" type="button" draggable="true" data-match-source="${question.shapeKey}" aria-pressed="${selected}">
        <span class="name-card-dot" aria-hidden="true">●</span>${question.shapeName}
      </button>
    </div>
    <div class="matching-arrow" aria-hidden="true">${state.connection ? '✓' : '→'}</div>
    <div class="matching-column">
      <span class="column-title">Imagem</span>
      <button class="visual-target ${state.connection ? 'is-connected' : ''}" type="button" data-match-target="${question.shapeKey}" aria-label="Imagem para ligar ao nome ${question.shapeName}">
        ${visual}
      </button>
    </div>
  </div>
  <div class="matching-actions">
    <p class="interaction-hint" aria-live="polite">${state.selectedKey && !state.connection ? 'Agora toque na imagem.' : state.connection ? 'Ligação concluída! Está certinho.' : 'Toque no nome e depois na imagem.'}</p>
    <button class="secondary-button" type="button" data-action="clear-connection" ${state.connection ? '' : 'disabled'}>↶ Desfazer ligação</button>
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

function renderOriginalColoringSheet(variant = 0) {
  const second = variant === 1 ? `<path d="M555 655 q50 -55 105 0 v220 q-50 40 -105 0z"/><circle cx="610" cy="690" r="10"/><circle cx="650" cy="690" r="10"/><path d="M600 735 q30 28 60 0"/>` : `<path d="M535 675 q60 -55 120 0 v205 q-60 35 -120 0z"/><circle cx="590" cy="710" r="10"/><circle cx="635" cy="710" r="10"/><path d="M585 755 q28 24 55 0"/>`;
  return `<svg class="coloring-svg" viewBox="0 0 794 1123" role="img" aria-label="Desenho em preto e branco de animais simpáticos estudando matemática, com estrelas e formas geométricas para colorir">
    <rect x="20" y="20" width="754" height="1083" rx="30" fill="white" stroke="#171925" stroke-width="10"/>
    <path d="M80 920 q80 -75 160 0 q90 -65 175 0 q90 -75 190 0 q70 -55 115 0" fill="none" stroke="#171925" stroke-width="10" stroke-linecap="round"/>
    <path d="M110 230 q-12 -95 58 -130 l45 70 l60 -65 q75 35 52 125z" fill="white" stroke="#171925" stroke-width="10" stroke-linejoin="round"/>
    <circle cx="200" cy="270" r="120" fill="white" stroke="#171925" stroke-width="10"/>
    <circle cx="165" cy="260" r="12" fill="#171925"/><circle cx="235" cy="260" r="12" fill="#171925"/>
    <path d="M190 295 q18 18 36 0 M200 278 l-16 10 M216 278 l16 10" fill="none" stroke="#171925" stroke-width="8" stroke-linecap="round"/>
    <path d="M85 305 l-60 -16 M85 335 l-65 5 M315 305 l60 -16 M315 335 l65 5" fill="none" stroke="#171925" stroke-width="7" stroke-linecap="round"/>
    <path d="M130 410 h145 v160 h-145z M155 440 h95 M155 475 h95 M155 510 h70" fill="white" stroke="#171925" stroke-width="10" stroke-linejoin="round"/>
    <path d="M162 560 q35 45 78 0" fill="none" stroke="#171925" stroke-width="9"/>
    <path d="M535 555 l30 -70 l30 70 M555 475 l10 -44 l10 44" fill="white" stroke="#171925" stroke-width="10" stroke-linejoin="round"/>
    <path d="M525 555 q45 -55 100 0 v220 q-50 45 -100 0z" fill="white" stroke="#171925" stroke-width="10"/>
    <circle cx="565" cy="595" r="10" fill="#171925"/><circle cx="610" cy="595" r="10" fill="#171925"/><path d="M560 640 q28 25 55 0" fill="none" stroke="#171925" stroke-width="8" stroke-linecap="round"/>
    <path d="M380 365 l42 90 l-98 0z" fill="white" stroke="#171925" stroke-width="10" stroke-linejoin="round"/>
    <path d="M322 360 l20 -30 M350 350 l8 -35 M380 350 l2 -35 M410 360 l15 -30" fill="none" stroke="#171925" stroke-width="8" stroke-linecap="round"/>
    <circle cx="120" cy="735" r="58" fill="white" stroke="#171925" stroke-width="10"/><path d="M120 690 v90 M75 735 h90" fill="none" stroke="#171925" stroke-width="8"/>
    <path d="M270 700 l55 35 l-55 35 l-55 -35z" fill="white" stroke="#171925" stroke-width="10"/>
    <path d="M410 700 h105 v105 h-105z" fill="white" stroke="#171925" stroke-width="10"/>
    <path d="M435 725 h55 M435 755 h55" fill="none" stroke="#171925" stroke-width="7"/>
    <path d="M665 700 l22 45 l50 7 l-36 33 l9 49 l-45 -24 l-45 24 l9 -49 l-36 -33 l50 -7z" fill="white" stroke="#171925" stroke-width="10" stroke-linejoin="round"/>
    <text x="397" y="165" text-anchor="middle" font-size="58" font-family="Trebuchet MS, sans-serif" fill="white" stroke="#171925" stroke-width="2">MATEMÁTICA!</text>
    <text x="397" y="1015" text-anchor="middle" font-size="35" font-family="Trebuchet MS, sans-serif" fill="white" stroke="#171925" stroke-width="1.5">1 + 2 = 3</text>
  </svg>`;
}

function renderColoringAttribution(page) {
  if (!page?.attributionRequired) return '';
  return `<p class="coloring-attribution" data-print-attribution>
    Ilustração de <a href="${escapeAttribute(page.sourceUrl)}" target="_blank" rel="noreferrer">${page.author}</a>
    — <a href="${escapeAttribute(page.licenseUrl)}" target="_blank" rel="noreferrer">${page.license}</a>
    — <a href="${escapeAttribute(page.sourceUrl)}" target="_blank" rel="noreferrer">Fonte</a>
  </p>`;
}

function renderColoringPage(page) {
  if (!page || !isLocalColoringPage(page)) {
    return `<div class="print-sheet print-fallback" data-orientation="portrait">${renderOriginalColoringSheet()}</div>`;
  }
  return `<div class="print-sheet" data-coloring-page-id="${page.id}" data-orientation="${page.orientation}">
    <img class="coloring-image" data-coloring-image="${page.id}" src="${escapeAttribute(page.src)}" alt="${escapeAttribute(page.alt)}" decoding="async">
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
    return `<div class="feedback success-feedback" role="status" aria-live="polite">
      <p class="feedback-title">${positiveMessages[state.currentIndex % positiveMessages.length]}</p>
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
  if (question.type === 'flat' || question.type === 'spatial') return renderMatchingQuestion(question);
  if (question.type === 'addition') return renderAdditionQuestion(question);
  if (question.type === 'neighbor') return renderNeighborQuestion(question);
  if (question.type === 'word') return renderWordQuestion(question);
  return renderUnknownQuestion(question);
}

function renderGame() {
  const question = state.round[state.currentIndex];
  const guideMessage = state.correct ? 'Que conquista linda! Observe a explicação.' : 'Vamos com calma! Você consegue!';
  return `<div class="site-shell game-screen">
    ${renderHeader()}
    <main class="main-content">
      <div class="question-topline"><span class="activity-badge">Atividade ${state.currentIndex + 1}</span><span class="activity-count">${ACTIVITY_NAMES[state.currentIndex]}</span></div>
      <div class="question-heading"><div><h1 id="question-title">${ACTIVITY_NAMES[state.currentIndex]}</h1></div>${renderGuide(guideMessage)}</div>
      <section class="question-card" aria-labelledby="question-title">
        <div class="prompt-row"><p class="prompt" id="question-prompt">${question.prompt}</p>${renderSpeechButton('question', question.speech)}</div>
        <span class="speech-status" data-speech-status role="status" aria-live="polite"></span>
        <div class="exercise-area">${renderExercise(question)}</div>
        ${renderFeedback(question)}
      </section>
    </main>
  </div>`;
}

function renderHome() {
  return `<div class="site-shell home-screen">
    <main class="home-main">
      <div class="home-decor decor-one" aria-hidden="true">2</div><div class="home-decor decor-two" aria-hidden="true">★</div><div class="home-decor decor-three" aria-hidden="true">5</div>
      <section class="home-card" aria-labelledby="home-title">
        <div class="home-art" aria-hidden="true"><span class="home-circle">6</span><span class="home-triangle"></span><span class="home-square">＋</span><span class="home-star">★</span></div>
        <p class="eyebrow">Uma aventura de aprender</p>
        <h1 id="home-title">Revisão de Matemática<br><span>da Marina</span></h1>
        <p class="home-subtitle">Vamos aprender, brincar e conquistar estrelas?</p>
        <button class="primary-button start-button" type="button" data-action="start">Começar <span aria-hidden="true">→</span></button>
        ${renderGuide('Estou aqui para torcer por você!')}
        <p class="privacy-note">Sem cadastro. Só brincadeira e aprendizado.</p>
      </section>
    </main>
  </div>`;
}

function selectRewardPage() {
  state.unavailableRewardPageIds = new Set();
  const page = pickColoringPage({ excludeId: state.lastRewardPageId });
  state.rewardPageId = page?.id ?? null;
  state.lastRewardPageId = page?.id ?? state.lastRewardPageId;
  state.rewardFallback = !page;
}

function showAnotherColoringPage() {
  const page = pickColoringPage({
    excludeId: state.rewardPageId,
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
  render();
}

function handleColoringAssetError(pageId) {
  if (state.screen !== 'reward' || state.rewardPageId !== pageId) return;
  state.unavailableRewardPageIds.add(pageId);
  showAnotherColoringPage();
}

function renderReward() {
  const rewardPage = getColoringPageById(state.rewardPageId);
  return `<div class="site-shell reward-screen">
    <main class="reward-main">
      <section class="reward-card" aria-labelledby="reward-title">
        <div class="reward-stars" aria-label="Seis estrelas conquistadas">★ ★ ★ ★ ★ ★</div>
        <p class="eyebrow">Missão cumprida!</p>
        <h1 id="reward-title">${REWARD_MESSAGE}</h1>
        <p class="reward-copy">Você passou por todas as atividades. Agora é hora de colorir!</p>
        ${state.rewardFallback ? renderColoringPage(null) : renderColoringPage(rewardPage)}
        <div class="reward-actions">
          <button class="primary-button" type="button" data-action="print">🖨 Imprimir meu desenho</button>
          <button class="secondary-button" type="button" data-action="another-coloring-page">🎨 Ver outro desenho</button>
          <button class="secondary-button" type="button" data-action="restart">↻ Jogar novamente</button>
        </div>
      </section>
    </main>
  </div>`;
}

function render() {
  if (state.screen === 'home') app.innerHTML = renderHome();
  else if (state.screen === 'reward') app.innerHTML = renderReward();
  else app.innerHTML = renderGame();
  updateSpeechButtons();
  bindEvents();
}

function beginRound() {
  cancelSpeech();
  state.screen = 'game';
  state.round = createRound();
  state.currentIndex = 0;
  state.correct = false;
  state.attempts = 0;
  state.selectedKey = null;
  state.connection = null;
  state.answer = {};
  state.activeAddField = null;
  state.hintVisible = false;
  state.parentHelp = false;
  state.rewardPageId = null;
  state.unavailableRewardPageIds = new Set();
  state.rewardFallback = false;
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
  state.connection = null;
  state.answer = {};
  state.activeAddField = null;
  state.hintVisible = false;
  state.parentHelp = false;
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

function connectToTarget(targetKey) {
  if (!state.selectedKey) {
    state.attempts += 1;
    render();
    return;
  }
  if (state.selectedKey === targetKey) {
    state.connection = targetKey;
    correctAnswer();
  } else {
    wrongAnswer();
  }
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
      if (action === 'start' || action === 'restart') beginRound();
      if (action === 'home') {
        cancelSpeech();
        state.screen = 'home';
        render();
      }
      if (action === 'next') nextQuestion();
      if (action === 'check-answer') checkAnswer();
      if (action === 'clear-connection') {
        state.connection = null;
        state.selectedKey = null;
        state.attempts = 0;
        render();
      }
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
      if (action === 'print') window.print();
    });
  });

  document.querySelectorAll('[data-coloring-image]').forEach((image) => {
    image.addEventListener('error', () => handleColoringAssetError(image.dataset.coloringImage));
  });

  document.querySelectorAll('[data-speech-button]').forEach((button) => {
    button.addEventListener('click', () => {
      speak(button.dataset.speechButton, button.dataset.speechText);
    });
  });

  document.querySelectorAll('[data-match-source]').forEach((source) => {
    source.addEventListener('click', () => {
      if (state.correct) return;
      state.selectedKey = source.dataset.matchSource;
      render();
    });
    source.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', source.dataset.matchSource);
      state.selectedKey = source.dataset.matchSource;
    });
  });

  document.querySelectorAll('[data-match-target]').forEach((target) => {
    target.addEventListener('click', () => connectToTarget(target.dataset.matchTarget));
    target.addEventListener('dragover', (event) => event.preventDefault());
    target.addEventListener('drop', (event) => {
      event.preventDefault();
      const key = event.dataTransfer?.getData('text/plain');
      if (key) state.selectedKey = key;
      connectToTarget(target.dataset.matchTarget);
    });
  });

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
}

render();
