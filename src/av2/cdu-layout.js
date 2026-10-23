function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function digits(value) {
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    throw new RangeError('O valor da coluna deve estar entre 0 e 999.');
  }
  return String(value).padStart(3, ' ').split('').map((digit) => digit === ' ' ? '' : Number(digit));
}

export function renderCduLegend() {
  return `<div class="av2-addition-legend cdu-legend" aria-label="C significa centena, D significa dezena e U significa unidade"><span><b>C</b> Centena</span><span><b>D</b> Dezena</span><span><b>U</b> Unidade</span></div>`;
}

/** Renders only the shared aligned C/D/U layout; callers provide the operation trace and result cells. */
export function renderCduLayout({
  firstOperand,
  secondOperand,
  markers = {},
  resultCells,
  ariaLabel,
  firstRowLabel = '1ª parcela',
  secondRowLabel = '2ª parcela',
  resultRowLabel = 'resposta',
  operator = '+',
  markerRowLabel = 'vai um',
}) {
  if (!Array.isArray(resultCells) || resultCells.length !== 3
    || resultCells.some((cell) => typeof cell !== 'string')) {
    throw new TypeError('A linha de resposta deve conter as casas C, D e U.');
  }
  const firstDigits = digits(firstOperand);
  const secondDigits = digits(secondOperand);
  const columns = ['hundreds', 'tens', 'units'];
  const names = { hundreds: 'centenas', tens: 'dezenas', units: 'unidades' };
  const markerCells = columns.map((column) => {
    const marker = markers[column] ?? null;
    const value = marker?.value ? String(marker.value) : '';
    const isCarryDestination = column !== 'units';
    const label = value
      ? marker.ariaLabel ?? `vai um na casa de ${names[column]}`
      : marker?.ariaLabel ?? (isCarryDestination ? `casa da reserva das ${names[column]} vazia` : 'não há casa de reserva nas unidades');
    const content = isCarryDestination
      ? marker?.inputHtml ?? `<span class="av2-addition-digit addition-static-carry" aria-hidden="true">${value ? `<b>${escapeHtml(value)}</b>` : ''}</span>`
      : '';
    const isRevealed = Boolean(value || marker?.isRevealed);
    return `<span class="addition-carry-cell ${isRevealed ? 'is-revealed' : ''} cdu-marker-cell" role="cell" data-cdu-marker="${column}" aria-label="${escapeHtml(label)}">${content}</span>`;
  });
  const operandCells = (values) => values.map((value) => `<span role="cell">${value === '' ? '' : value}</span>`).join('');

  return `<div class="av2-addition-board cdu-board" role="table" aria-label="${escapeHtml(ariaLabel)}">
    <div class="av2-addition-row av2-addition-position cdu-row" role="row"><span role="cell"></span><b role="columnheader">C</b><b role="columnheader">D</b><b role="columnheader">U</b></div>
    <div class="av2-addition-row av2-addition-carry-row cdu-row" role="row"><span class="av2-addition-row-label cdu-row-label">${escapeHtml(markerRowLabel)}</span>${markerCells.join('')}</div>
    <div class="av2-addition-row cdu-row" role="row" aria-label="${escapeHtml(`${firstRowLabel}: ${firstOperand}`)}"><span class="av2-addition-row-label cdu-row-label">${escapeHtml(firstRowLabel)}</span>${operandCells(firstDigits)}</div>
    <div class="av2-addition-row cdu-row" role="row" aria-label="${escapeHtml(`${operator === '+' ? 'Mais' : operator} ${secondRowLabel}: ${secondOperand}`)}"><span class="av2-addition-row-label cdu-row-label"><b aria-label="${operator === '+' ? 'mais' : escapeHtml(operator)}">${escapeHtml(operator)}</b> ${escapeHtml(secondRowLabel)}</span>${operandCells(secondDigits)}</div>
    <div class="av2-addition-line cdu-line" role="presentation"><span></span><span></span><span></span><span></span></div>
    <div class="av2-addition-row av2-addition-answer-row cdu-row" role="row"><span class="av2-addition-row-label cdu-row-label">${escapeHtml(resultRowLabel)}</span>${resultCells.join('')}</div>
  </div>`;
}
