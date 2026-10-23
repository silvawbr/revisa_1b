import { renderCduLayout, renderCduLegend } from './cdu-layout.js';
import { validateAv2SubtractionQuestionCandidate } from './subtraction.js';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const columns = ['hundreds', 'tens', 'units'];

/** Presentation consumes the validated trace; it never recalculates exchanges. */
export function renderSubtractionQuestion(question, { hintIndex = -1, correct = false, selected = null, answer = {}, error = false } = {}) {
  if (!validateAv2SubtractionQuestionCandidate(question)) throw new TypeError('Questão de subtração inválida para exibição.');
  const { a, b, trace } = question.data;
  const terms = question.type === 'terms';
  const shown = correct || terms;
  const hint = hintIndex >= 0 ? question.hints[hintIndex] : null;
  const eventCount = correct ? trace.events.length : hint?.revealedEvents ?? 0;
  const markers = {};
  for (const column of columns) {
    const history = [trace.original[column]];
    for (const event of trace.events.slice(0, eventCount)) {
      if (event.stateAfter[column] !== history[history.length - 1]) history.push(event.stateAfter[column]);
    }
    const fieldName = `borrow${column[0].toUpperCase()}${column.slice(1)}`;
    if (!terms && !correct && (column !== 'hundreds' || a >= 100)) {
      const label = column === 'hundreds' ? 'Centenas' : column === 'tens' ? 'Dezenas' : 'Unidades';
      markers[column] = { ariaLabel: `${label} após a troca`, inputHtml: `<input class="av2-addition-digit subtraction-borrow-input" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" data-av2-add-field="${fieldName}" aria-label="${label} após a troca" value="${escape(answer[fieldName] ?? trace.original[column])}">` };
      if (history.length > 1) markers[column].inputHtml += `<span class="subtraction-history" aria-label="${label}: ${history.join(' depois ')}">${history.join(' → ')}</span>`;
    } else if (history.length > 1) markers[column] = { value: history[history.length - 1], ariaLabel: `${column === 'hundreds' ? 'Centenas' : column === 'tens' ? 'Dezenas' : 'Unidades'}: ${history.join(' depois ')}`,
      inputHtml: `<span class="subtraction-history">${history.map((n, i) => `<span${i < history.length - 1 ? ' class="subtraction-previous"' : ''}>${i ? '↓ ' : ''}${n}</span>`).join('')}</span>` };
  }
  // Input width follows the minuend, so the empty board never discloses result length.
  const resultCells = columns.map((column, i) => {
    if (column === 'hundreds' && a < 100) return '<span role="cell"></span>';
    if (shown) {
      const digit = String(trace.result).padStart(3, '0')[i];
      return `<span role="cell">${digit === ' ' ? '' : digit}</span>`;
    }
    return `<span role="cell"><input class="av2-addition-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" data-av2-add-field="${column}" aria-label="${column === 'hundreds' ? 'Centena' : column === 'tens' ? 'Dezena' : 'Unidade'} da diferença" value="${escape(answer[column] ?? '')}"></span>`;
  });
  const firstOperandCells = columns.map((column) => {
    if (column === 'hundreds' && a < 100) return '<span role="cell"></span>';
    const marker = markers[column];
    return `<span class="subtraction-minuend-cell" role="cell">${marker?.inputHtml ?? trace.original[column]}</span>`;
  });
  const board = renderCduLayout({ firstOperand: a, secondOperand: b, operator: '−', firstRowLabel: 'minuendo', secondRowLabel: 'subtraendo', resultRowLabel: terms ? 'diferença' : 'resposta', markerMode: 'borrow', firstOperandCells, showMarkerRow: false, resultCells,
    ariaLabel: `Subtração: ${a} menos ${b}${shown ? ` igual a ${trace.result}` : ''}. Colunas C, D e U.` });
  const options = terms ? `<div class="av2-answer-options label-options" role="group" aria-label="Alternativas de resposta">${question.options.map((option) => `<button class="av2-answer-label" type="button" data-av2-answer="${escape(option)}" aria-pressed="${selected === option}" ${correct ? 'disabled' : ''}>${escape(option)}</button>`).join('')}</div>` : '';
  const input = !terms && !correct ? `<p>Altere os algarismos do minuendo quando precisar reagrupar: tire 1 do vizinho e acrescente 10 à coluna. Depois digite a diferença, incluindo os zeros.</p>
    <div class="number-pad av2-addition-pad" role="group" aria-label="Teclado numérico">${[1,2,3,4,5,6,7,8,9,0].map((n) => `<button type="button" data-av2-add-digit="${n}">${n}</button>`).join('')}<button type="button" data-av2-add-clear>Limpar</button></div>
    <button class="primary-button" type="button" data-action="submit-av2">Conferir resposta</button>` : '';
  return `<div class="av2-exercise is-subtraction" data-av2-question-type="${question.type}">${renderCduLegend()}${board}${options}${input}
    ${error ? `<p role="alert">${escape(error)}</p>` : ''}
    <button class="secondary-button" type="button" data-action="av2-hint" ${correct || hintIndex >= question.hints.length - 1 ? 'disabled' : ''}>${hintIndex < 0 ? 'Quero uma dica' : 'Outra dica'}</button>
    ${hint ? `<p class="hint-box" role="status" aria-live="polite"><b>Dica ${hintIndex + 1}:</b> ${escape(hint.text)}</p>` : ''}</div>`;
}
