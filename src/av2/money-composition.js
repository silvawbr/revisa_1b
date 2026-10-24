import { MONEY_DENOMINATIONS } from './money.js';

export const AV2_MONEY_COMPOSITION_ACTIVITY_ID = 'av2-money-composition';
export const AV2_MONEY_COMPOSITION_ROUND_LENGTH = 12;
export const AV2_MONEY_COMPOSITION_CATEGORIES = Object.freeze([
  'COMP-01', 'COMP-02', 'COMP-03', 'COMP-04', 'COMP-05', 'COMP-06',
]);

const byId = new Map(MONEY_DENOMINATIONS.map((denomination) => [denomination.id, denomination]));
const MAX_TARGET_CENTS = 2000;
const MAX_ITEMS = 12;

function denomination(id) {
  return byId.get(id) ?? null;
}

function amountLabel(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '0 reais';
  if (cents === 0) return '0 reais';
  if (cents < 100) return `${cents} centavos`;
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const realLabel = `${reais} ${reais === 1 ? 'real' : 'reais'}`;
  return centavos ? `${realLabel} e ${centavos} centavos` : realLabel;
}

export function formatMoneyCompositionTotal(cents) {
  return amountLabel(cents);
}

function freezeChallenge(challenge) {
  Object.freeze(challenge.allowedDenominationIds);
  Object.freeze(challenge.quantityLimits);
  Object.freeze(challenge.feedback);
  return Object.freeze(challenge);
}

function createChallenge({
  id,
  category,
  targetCents,
  allowedDenominationIds,
  prompt,
  hint,
  quantityLimits,
  maxItems = 8,
  exactBanknoteCount,
  requiredDistinctSolutions = 1,
  minimumDistinctDenominations = 1,
  referenceDenominationId,
}) {
  const target = amountLabel(targetCents);
  const isTwoWays = requiredDistinctSolutions === 2;
  const noteCountText = exactBanknoteCount === undefined ? '' : exactBanknoteCount === 1 ? 'uma cédula' : `${exactBanknoteCount} cédulas`;
  const correct = isTwoWays
    ? 'Conseguiu! Você encontrou duas maneiras diferentes de formar o mesmo valor.'
    : exactBanknoteCount !== undefined
      ? `Parabéns! Você formou ${target} com ${noteCountText}.`
      : `Isso mesmo! Você formou ${target}.`;
  return freezeChallenge({
    revisionId: 'av2-matematica',
    activityId: AV2_MONEY_COMPOSITION_ACTIVITY_ID,
    questionId: id,
    challengeId: id,
    type: 'money-composition',
    pedagogicalCategory: category,
    targetCents,
    allowedDenominationIds: [...allowedDenominationIds],
    quantityLimits: { ...quantityLimits },
    maxItems,
    requiredDistinctSolutions,
    minimumDistinctDenominations,
    ...(exactBanknoteCount === undefined ? {} : { exactBanknoteCount, banknoteOnly: true }),
    ...(referenceDenominationId ? { referenceDenominationId } : {}),
    prompt,
    speech: prompt,
    explanation: `O valor pedido é ${target}. Cada moeda e cédula tem um valor que entra na soma.`,
    hint,
    feedback: { correct, retry: 'Observe os valores e tente mais uma vez.' },
  });
}

function isSafeRandom(random) {
  if (typeof random !== 'function') return false;
  const value = random();
  return Number.isFinite(value) && value >= 0 && value < 1;
}

function randomIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('A função aleatória deve retornar um valor entre 0 e 1.');
  return Math.floor(value * length);
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1, random);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function sampleTwo(items, random) {
  return shuffled(items, random).slice(0, 2);
}

function makeChallengePools() {
  const whole = ['coin-1-real', 'note-2-reais', 'note-5-reais', 'note-10-reais'];
  const cents = ['coin-5-centavos', 'coin-10-centavos', 'coin-25-centavos', 'coin-50-centavos'];
  const noteSmall = ['note-2-reais', 'note-5-reais', 'note-10-reais'];
  const allCoins = ['coin-25-centavos', 'coin-50-centavos', 'coin-1-real'];
  return {
    'COMP-01': [
      createChallenge({ id: 'whole-6', category: 'COMP-01', targetCents: 600, allowedDenominationIds: whole.slice(0, 3), quantityLimits: { 'coin-1-real': 6, 'note-2-reais': 3, 'note-5-reais': 1 }, maxItems: 6, prompt: 'Forme 6 reais.', hint: 'Você pode juntar moedas de 1 real e cédulas de valores diferentes.' }),
      createChallenge({ id: 'whole-7', category: 'COMP-01', targetCents: 700, allowedDenominationIds: whole.slice(0, 3), quantityLimits: { 'coin-1-real': 7, 'note-2-reais': 3, 'note-5-reais': 1 }, maxItems: 7, prompt: 'Forme 7 reais.', hint: 'Veja se uma cédula pode ser completada com moedas de 1 real.' }),
      createChallenge({ id: 'whole-9', category: 'COMP-01', targetCents: 900, allowedDenominationIds: whole.slice(0, 3), quantityLimits: { 'coin-1-real': 6, 'note-2-reais': 4, 'note-5-reais': 1 }, maxItems: 6, prompt: 'Forme 9 reais.', hint: 'Você pode usar mais de uma cédula do mesmo valor.' }),
      createChallenge({ id: 'whole-20', category: 'COMP-01', targetCents: 2000, allowedDenominationIds: ['note-2-reais', 'note-5-reais', 'note-10-reais'], quantityLimits: { 'note-2-reais': 4, 'note-5-reais': 4, 'note-10-reais': 2 }, maxItems: 4, prompt: 'Forme 20 reais.', hint: 'Compare o valor de uma cédula com o valor pedido.' }),
    ],
    'COMP-02': [
      createChallenge({ id: 'centavos-20', category: 'COMP-02', targetCents: 20, allowedDenominationIds: cents, quantityLimits: { 'coin-5-centavos': 4, 'coin-10-centavos': 2, 'coin-25-centavos': 1, 'coin-50-centavos': 1 }, maxItems: 4, prompt: 'Forme 20 centavos usando moedas.', hint: 'Há moedas de 5 e de 10 centavos. Experimente combinar mais de uma.' }),
      createChallenge({ id: 'centavos-30', category: 'COMP-02', targetCents: 30, allowedDenominationIds: cents, quantityLimits: { 'coin-5-centavos': 6, 'coin-10-centavos': 3, 'coin-25-centavos': 1, 'coin-50-centavos': 1 }, maxItems: 6, prompt: 'Forme 30 centavos usando moedas.', hint: 'Some os valores das moedas até chegar a 30 centavos.' }),
      createChallenge({ id: 'centavos-40', category: 'COMP-02', targetCents: 40, allowedDenominationIds: cents, quantityLimits: { 'coin-5-centavos': 8, 'coin-10-centavos': 4, 'coin-25-centavos': 1, 'coin-50-centavos': 1 }, maxItems: 8, prompt: 'Forme 40 centavos usando moedas.', hint: 'Duas moedas de 10 centavos formam 20 centavos.' }),
      createChallenge({ id: 'centavos-45', category: 'COMP-02', targetCents: 45, allowedDenominationIds: cents, quantityLimits: { 'coin-5-centavos': 6, 'coin-10-centavos': 4, 'coin-25-centavos': 1, 'coin-50-centavos': 1 }, maxItems: 6, prompt: 'Forme 45 centavos usando moedas.', hint: 'Observe como a moeda de 25 centavos pode ajudar.' }),
    ],
    'COMP-03': [
      createChallenge({ id: 'mixed-1-centavos', category: 'COMP-03', targetCents: 100, allowedDenominationIds: ['coin-25-centavos', 'coin-50-centavos'], quantityLimits: { 'coin-25-centavos': 4, 'coin-50-centavos': 2 }, maxItems: 4, prompt: 'Forme 1 real usando moedas de centavos.', hint: 'Observe quais moedas podem formar 1 real.' }),
      createChallenge({ id: 'mixed-2', category: 'COMP-03', targetCents: 200, allowedDenominationIds: allCoins, quantityLimits: { 'coin-25-centavos': 8, 'coin-50-centavos': 4, 'coin-1-real': 2 }, maxItems: 8, minimumDistinctDenominations: 2, prompt: 'Forme 2 reais usando moedas de valores diferentes.', hint: 'Você pode combinar moedas de 1 real com moedas de centavos.' }),
      createChallenge({ id: 'mixed-3', category: 'COMP-03', targetCents: 300, allowedDenominationIds: allCoins, quantityLimits: { 'coin-25-centavos': 8, 'coin-50-centavos': 6, 'coin-1-real': 3 }, maxItems: 8, minimumDistinctDenominations: 2, prompt: 'Forme 3 reais usando moedas.', hint: 'Pense em uma moeda de 1 real e complete o valor com outras moedas.' }),
    ],
    'COMP-04': [
      createChallenge({ id: 'equiv-1-from-50', category: 'COMP-04', targetCents: 100, allowedDenominationIds: ['coin-50-centavos'], quantityLimits: { 'coin-50-centavos': 2 }, maxItems: 2, referenceDenominationId: 'coin-1-real', prompt: 'Quantas moedas de 50 centavos formam o mesmo valor desta moeda?', hint: 'Observe o valor da moeda mostrada e conte de 50 em 50.' }),
      createChallenge({ id: 'equiv-5-from-1', category: 'COMP-04', targetCents: 500, allowedDenominationIds: ['coin-1-real'], quantityLimits: { 'coin-1-real': 5 }, maxItems: 5, referenceDenominationId: 'note-5-reais', prompt: 'Forme o mesmo valor desta cédula usando moedas de 1 real.', hint: 'Conte quantas moedas de 1 real completam o valor mostrado.' }),
      createChallenge({ id: 'equiv-10-from-5', category: 'COMP-04', targetCents: 1000, allowedDenominationIds: ['note-5-reais'], quantityLimits: { 'note-5-reais': 2 }, maxItems: 2, referenceDenominationId: 'note-10-reais', prompt: 'Forme o mesmo valor desta cédula usando cédulas de 5 reais.', hint: 'Observe o valor de cada cédula e veja quantas você precisa para chegar ao valor mostrado.' }),
      createChallenge({ id: 'equiv-20-from-10', category: 'COMP-04', targetCents: 2000, allowedDenominationIds: ['note-10-reais'], quantityLimits: { 'note-10-reais': 2 }, maxItems: 2, referenceDenominationId: 'note-20-reais', prompt: 'Forme o mesmo valor desta cédula usando cédulas de 10 reais.', hint: 'Compare o valor de uma cédula de 10 reais com o valor mostrado.' }),
    ],
    'COMP-05': [
      createChallenge({ id: 'two-ways-6', category: 'COMP-05', targetCents: 600, allowedDenominationIds: ['coin-1-real', 'note-2-reais', 'note-5-reais'], quantityLimits: { 'coin-1-real': 6, 'note-2-reais': 3, 'note-5-reais': 1 }, maxItems: 6, requiredDistinctSolutions: 2, prompt: 'Forme 6 reais de um jeito. Depois, forme o mesmo valor de outro jeito.', hint: 'Veja se consegue trocar uma cédula por moedas ou por cédulas menores.' }),
      createChallenge({ id: 'two-ways-9', category: 'COMP-05', targetCents: 900, allowedDenominationIds: ['coin-1-real', 'note-2-reais', 'note-5-reais'], quantityLimits: { 'coin-1-real': 6, 'note-2-reais': 4, 'note-5-reais': 1 }, maxItems: 6, requiredDistinctSolutions: 2, prompt: 'Forme 9 reais de um jeito. Depois, encontre outra combinação.', hint: 'Você pode trocar uma cédula por moedas ou por outras cédulas.' }),
      createChallenge({ id: 'two-ways-10', category: 'COMP-05', targetCents: 1000, allowedDenominationIds: ['note-2-reais', 'note-5-reais'], quantityLimits: { 'note-2-reais': 5, 'note-5-reais': 2 }, maxItems: 5, requiredDistinctSolutions: 2, prompt: 'Forme 10 reais de um jeito. Depois, forme o mesmo valor com outras cédulas.', hint: 'Compare os valores das cédulas e procure outra combinação para o mesmo total.' }),
      createChallenge({ id: 'two-ways-20', category: 'COMP-05', targetCents: 2000, allowedDenominationIds: ['note-5-reais', 'note-10-reais'], quantityLimits: { 'note-5-reais': 4, 'note-10-reais': 2 }, maxItems: 4, requiredDistinctSolutions: 2, prompt: 'Forme 20 reais de um jeito. Depois, forme o mesmo valor de outro jeito.', hint: 'Veja se consegue trocar uma cédula por outras menores sem mudar o total.' }),
    ],
    'COMP-06': [
      createChallenge({ id: 'exact-17-three-notes', category: 'COMP-06', targetCents: 1700, allowedDenominationIds: noteSmall, quantityLimits: { 'note-2-reais': 2, 'note-5-reais': 3, 'note-10-reais': 1 }, maxItems: 4, exactBanknoteCount: 3, prompt: 'Forme 17 reais usando exatamente três cédulas.', hint: 'Some os valores com calma e confira se escolheu três cédulas.' }),
      createChallenge({ id: 'exact-10-two-notes', category: 'COMP-06', targetCents: 1000, allowedDenominationIds: ['note-2-reais', 'note-5-reais', 'note-10-reais'], quantityLimits: { 'note-2-reais': 2, 'note-5-reais': 2, 'note-10-reais': 1 }, maxItems: 2, exactBanknoteCount: 2, prompt: 'Forme 10 reais usando exatamente duas cédulas.', hint: 'Escolha duas cédulas e confira o total que elas formam.' }),
      createChallenge({ id: 'exact-12-three-notes', category: 'COMP-06', targetCents: 1200, allowedDenominationIds: ['note-2-reais', 'note-5-reais', 'note-10-reais'], quantityLimits: { 'note-2-reais': 3, 'note-5-reais': 2, 'note-10-reais': 1 }, maxItems: 3, exactBanknoteCount: 3, prompt: 'Forme 12 reais usando exatamente três cédulas.', hint: 'Conte as cédulas enquanto soma os valores.' }),
    ],
  };
}

/** Return an existing Block 06 challenge for reuse in another AV2 flow. */
export function getAv2MoneyCompositionChallenge(challengeId) {
  return Object.values(makeChallengePools()).flat().find(({ challengeId: id }) => id === challengeId) ?? null;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDefinition(challenge) {
  if (!challenge || challenge.revisionId !== 'av2-matematica'
    || challenge.activityId !== AV2_MONEY_COMPOSITION_ACTIVITY_ID
    || challenge.type !== 'money-composition'
    || typeof challenge.challengeId !== 'string' || challenge.challengeId.length === 0
    || !AV2_MONEY_COMPOSITION_CATEGORIES.includes(challenge.pedagogicalCategory)
    || !Number.isSafeInteger(challenge.targetCents) || challenge.targetCents < 5 || challenge.targetCents > MAX_TARGET_CENTS || challenge.targetCents % 5 !== 0
    || typeof challenge.prompt !== 'string' || challenge.prompt.length === 0
    || typeof challenge.speech !== 'string' || challenge.speech.length === 0
    || typeof challenge.hint !== 'string' || challenge.hint.length === 0
    || !isRecord(challenge.feedback) || typeof challenge.feedback.correct !== 'string' || typeof challenge.feedback.retry !== 'string'
    || !Array.isArray(challenge.allowedDenominationIds) || challenge.allowedDenominationIds.length === 0
    || new Set(challenge.allowedDenominationIds).size !== challenge.allowedDenominationIds.length
    || challenge.allowedDenominationIds.some((id) => !denomination(id))
    || !isRecord(challenge.quantityLimits)
    || !Number.isInteger(challenge.maxItems) || challenge.maxItems < 1 || challenge.maxItems > MAX_ITEMS
    || !Number.isInteger(challenge.requiredDistinctSolutions) || challenge.requiredDistinctSolutions < 1 || challenge.requiredDistinctSolutions > 2
    || !Number.isInteger(challenge.minimumDistinctDenominations) || challenge.minimumDistinctDenominations < 1 || challenge.minimumDistinctDenominations > challenge.allowedDenominationIds.length) return false;
  if (Object.keys(challenge.quantityLimits).some((id) => !challenge.allowedDenominationIds.includes(id)
    || !Number.isInteger(challenge.quantityLimits[id]) || challenge.quantityLimits[id] < 1 || challenge.quantityLimits[id] > challenge.maxItems)) return false;
  if (challenge.allowedDenominationIds.some((id) => !Number.isInteger(challenge.quantityLimits[id]))) return false;

  const types = challenge.allowedDenominationIds.map(denomination);
  const category = challenge.pedagogicalCategory;
  if (category === 'COMP-01' && (challenge.targetCents % 100 !== 0 || types.some((item) => item.valueCents % 100 !== 0))) return false;
  if (category === 'COMP-02' && (challenge.targetCents >= 100 || types.some((item) => item.kind !== 'coin' || item.valueCents >= 100 || item.valueCents % 5 !== 0))) return false;
  if (category === 'COMP-03' && (challenge.targetCents % 100 !== 0 || types.some((item) => item.kind !== 'coin'))) return false;
  if (category === 'COMP-04' && (!challenge.referenceDenominationId
    || denomination(challenge.referenceDenominationId)?.valueCents !== challenge.targetCents)) return false;
  if (category === 'COMP-05' && (challenge.targetCents % 100 !== 0 || types.some((item) => item.valueCents % 100 !== 0)
    || challenge.requiredDistinctSolutions !== 2)) return false;
  if (category !== 'COMP-05' && challenge.requiredDistinctSolutions !== 1) return false;
  if (category === 'COMP-06' && (!Number.isInteger(challenge.exactBanknoteCount) || challenge.exactBanknoteCount < 1
    || challenge.exactBanknoteCount > challenge.maxItems || challenge.banknoteOnly !== true
    || types.some((item) => item.kind !== 'note'))) return false;
  if (category !== 'COMP-06' && challenge.exactBanknoteCount !== undefined) return false;
  return true;
}

function normalizedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0).sort(([left], [right]) => left.localeCompare(right)));
}

export function countMoneyCompositionSelection(selectedItems) {
  const counts = {};
  if (!Array.isArray(selectedItems)) return counts;
  for (const item of selectedItems) {
    const id = typeof item === 'string' ? item : item?.denominationId;
    if (typeof id === 'string') counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export function canonicalizeMoneyCompositionCounts(counts) {
  if (!isRecord(counts)) return '[]';
  return JSON.stringify(normalizedCounts(Object.fromEntries(Object.entries(counts).filter(([, count]) => Number.isInteger(count) && count > 0))));
}

export function canonicalizeMoneyCompositionSelection(selectedItems) {
  return canonicalizeMoneyCompositionCounts(countMoneyCompositionSelection(selectedItems));
}

export function totalMoneyCompositionCents(counts) {
  if (!isRecord(counts)) return 0;
  return Object.entries(counts).reduce((total, [id, count]) => {
    const item = denomination(id);
    return Number.isSafeInteger(count) && count > 0 && item ? total + item.valueCents * count : total;
  }, 0);
}

function solutionCanSatisfy(challenge, counts, total, itemCount, noteCount, distinctCount) {
  return total === challenge.targetCents
    && itemCount > 0
    && noteCount === (challenge.exactBanknoteCount ?? noteCount)
    && distinctCount >= challenge.minimumDistinctDenominations;
}

export function findMoneyCompositionSolutions(challenge, { limit = challenge?.requiredDistinctSolutions ?? 1 } = {}) {
  if (!validDefinition(challenge) || !Number.isInteger(limit) || limit < 1 || limit > 2) return [];
  const items = [...challenge.allowedDenominationIds]
    .map((id) => denomination(id))
    .sort((left, right) => left.valueCents - right.valueCents || left.id.localeCompare(right.id));
  const found = [];
  const counts = {};

  function search(index, total, itemCount, noteCount, distinctCount) {
    if (found.length >= limit || total > challenge.targetCents || itemCount > challenge.maxItems) return;
    if (index === items.length) {
      if (solutionCanSatisfy(challenge, counts, total, itemCount, noteCount, distinctCount)) found.push(normalizedCounts(counts));
      return;
    }
    const item = items[index];
    const inventory = challenge.quantityLimits[item.id];
    const byValue = Math.floor((challenge.targetCents - total) / item.valueCents);
    const byRemainingItems = challenge.maxItems - itemCount;
    const maxQuantity = Math.min(inventory, byValue, byRemainingItems);
    for (let quantity = 0; quantity <= maxQuantity && found.length < limit; quantity += 1) {
      if (quantity > 0) counts[item.id] = quantity;
      else delete counts[item.id];
      search(index + 1,
        total + quantity * item.valueCents,
        itemCount + quantity,
        noteCount + (item.kind === 'note' ? quantity : 0),
        distinctCount + (quantity > 0 ? 1 : 0));
    }
    delete counts[item.id];
  }

  search(0, 0, 0, 0, 0);
  return found;
}

export function validateAv2MoneyCompositionChallenge(challenge) {
  return validDefinition(challenge)
    && findMoneyCompositionSolutions(challenge, { limit: challenge.requiredDistinctSolutions }).length >= challenge.requiredDistinctSolutions;
}

export function validateAv2MoneyCompositionSelection(challenge, selectedCounts, acceptedCombinations = []) {
  const base = { correct: false, totalCents: totalMoneyCompositionCents(selectedCounts), reason: null, canonicalCombination: canonicalizeMoneyCompositionCounts(selectedCounts) };
  if (!validateAv2MoneyCompositionChallenge(challenge)) return { ...base, reason: 'invalid-challenge' };
  if (!isRecord(selectedCounts)) return { ...base, reason: 'invalid-quantities' };
  const allowed = new Set(challenge.allowedDenominationIds);
  if (Object.keys(selectedCounts).some((id) => !allowed.has(id))) return { ...base, reason: 'unauthorized-denomination' };
  if (Object.values(selectedCounts).some((count) => !Number.isSafeInteger(count) || count < 0)) return { ...base, reason: 'invalid-quantities' };
  const itemCount = Object.values(selectedCounts).reduce((sum, count) => sum + count, 0);
  if (Object.entries(selectedCounts).some(([id, count]) => count > (challenge.quantityLimits[id] ?? 0)) || itemCount > challenge.maxItems) {
    return { ...base, reason: 'inventory-limit' };
  }
  const selected = Object.entries(selectedCounts).filter(([, count]) => count > 0);
  if (challenge.pedagogicalCategory === 'COMP-03' && selected.some(([id]) => denomination(id)?.kind !== 'coin')) return { ...base, reason: 'wrong-money-kind' };
  if (challenge.pedagogicalCategory === 'COMP-06' && selected.some(([id]) => denomination(id)?.kind !== 'note')) return { ...base, reason: 'wrong-money-kind' };
  if (base.totalCents < challenge.targetCents) return { ...base, reason: 'below-target' };
  if (base.totalCents > challenge.targetCents) return { ...base, reason: 'above-target' };
  const banknoteCount = selected.reduce((sum, [id, count]) => sum + (denomination(id).kind === 'note' ? count : 0), 0);
  if (challenge.exactBanknoteCount !== undefined && banknoteCount !== challenge.exactBanknoteCount) return { ...base, reason: 'wrong-banknote-count' };
  if (selected.length < challenge.minimumDistinctDenominations) return { ...base, reason: 'not-enough-denominations' };
  if (challenge.requiredDistinctSolutions > 1) {
    const seen = new Set(acceptedCombinations.map((combination) => typeof combination === 'string' ? combination : canonicalizeMoneyCompositionCounts(combination)));
    if (seen.has(base.canonicalCombination)) return { ...base, reason: 'duplicate-combination' };
    if (seen.size >= challenge.requiredDistinctSolutions) return { ...base, reason: 'too-many-combinations' };
  }
  return { ...base, correct: true, reason: 'correct' };
}

export function isAv2MoneyCompositionRound(round) {
  return Array.isArray(round)
    && round.length === AV2_MONEY_COMPOSITION_ROUND_LENGTH
    && round.every(validateAv2MoneyCompositionChallenge)
    && new Set(round.map(({ challengeId }) => challengeId)).size === round.length
    && AV2_MONEY_COMPOSITION_CATEGORIES.every((category) => round.filter(({ pedagogicalCategory }) => pedagogicalCategory === category).length === 2);
}

export function createAv2MoneyCompositionRound(random = Math.random) {
  if (!isSafeRandom(random)) throw new RangeError('A função aleatória deve retornar um valor entre 0 e 1.');
  const pools = makeChallengePools();
  const selected = AV2_MONEY_COMPOSITION_CATEGORIES.flatMap((category) => sampleTwo(pools[category], random));
  const round = shuffled(selected, random);
  if (!isAv2MoneyCompositionRound(round)) throw new Error('A rodada de formar quantias contém um desafio inválido.');
  return Object.freeze(round);
}
