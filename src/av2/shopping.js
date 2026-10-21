import {
  AV2_REVISION_ID,
  MONEY_DENOMINATIONS,
  formatMoneyAmount,
} from './money.js';
import {
  AV2_MAT_RULE_AV2_MAT_01,
  AV2_MAT_RULE_AV2_MAT_02,
  isMoneyAmountInUnit,
  isMoneyOperationInUnit,
} from './money-rules.js';

export { AV2_MAT_RULE_AV2_MAT_01, AV2_MAT_RULE_AV2_MAT_02 } from './money-rules.js';

export const AV2_SHOPPING_ACTIVITY_ID = 'compras-e-troco';
export const AV2_SHOPPING_PROGRESS_STORAGE_KEY = 'av2-matematica.block-02.compras-troco.progress.v1';
export const AV2_SHOPPING_ACTIVITY = Object.freeze({
  id: AV2_SHOPPING_ACTIVITY_ID,
  title: 'Compras e troco',
  description: 'Some valores, compare preços e descubra quanto sobra ou falta.',
});

export const SHOPPING_FAMILIES = Object.freeze([
  { id: 'money-addition', title: 'Juntar dinheiro' },
  { id: 'price-addition', title: 'Preços de produtos' },
  { id: 'remaining', title: 'Quanto sobrou?' },
  { id: 'missing', title: 'Quanto falta?' },
  { id: 'change', title: 'Troco' },
  { id: 'compare', title: 'Comparar preços' },
]);

const CURRENCY_DENOMINATIONS = Object.freeze(MONEY_DENOMINATIONS.map((money) => Object.freeze({
  id: money.id,
  kind: money.kind === 'note' ? 'bill' : 'coin',
  value: money.valueCents,
  name: money.spokenLabel,
  label: money.label,
  imageUrl: money.imageUrl,
  description: money.description,
})));

export const SHOPPING_PRODUCTS = Object.freeze([
  { id: 'pencil', name: 'lápis', article: 'o', icon: '✏️' },
  { id: 'eraser', name: 'borracha', article: 'a', icon: '🧽' },
  { id: 'notebook', name: 'caderno', article: 'o', icon: '📒' },
  { id: 'ball', name: 'bola', article: 'a', icon: '⚽' },
  { id: 'shuttlecock', name: 'peteca', article: 'a', icon: '🏸' },
  { id: 'book', name: 'livro', article: 'o', icon: '📚' },
  { id: 'juice', name: 'suco', article: 'o', icon: '🧃' },
  { id: 'toy', name: 'brinquedo', article: 'o', icon: '🧸' },
  { id: 'sticker', name: 'figurinha', article: 'a', icon: '⭐' },
  { id: 'cookie', name: 'biscoito', article: 'o', icon: '🍪' },
]);

const CHARACTERS = ['Bia', 'Davi', 'Lia', 'Ravi'];
const WHOLE_REAL_PRICES = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500];
const CENTAVO_PRICES = [25, 50, 75];

// AV2-MAT-01: each generated operation and its answer choices stay in one unit.
function unitForLevel(level, random) {
  if (level <= 1) return 'reais';
  if (level === 2) return 'centavos';
  return random() < 0.5 ? 'reais' : 'centavos';
}

function pricesForUnit(unit) {
  return unit === 'reais' ? WHOLE_REAL_PRICES : CENTAVO_PRICES;
}

function domainForUnit(unit) {
  return unit === 'reais' ? 'BRL_INTEIROS' : 'CENTAVOS';
}

function representMoney(amount, unit) {
  let remaining = amount;
  const denominations = CURRENCY_DENOMINATIONS
    .filter(({ value }) => unit === 'reais' ? value % 100 === 0 : value > 0 && value < 100)
    .sort((first, second) => second.value - first.value);
  const items = [];
  for (const denomination of denominations) {
    while (remaining >= denomination.value) {
      items.push({ denomination, value: denomination.value });
      remaining -= denomination.value;
    }
  }
  if (remaining !== 0 || !items.length) throw new RangeError('Não foi possível representar o valor com uma única unidade monetária.');
  return items;
}

function chooseTwoPrices(random, unit) {
  const prices = pricesForUnit(unit);
  const pairs = prices.flatMap((first) => prices
    .filter((second) => isMoneyOperationInUnit([first, second], first + second, unit))
    .map((second) => [first, second]));
  return pick(random, pairs);
}

function randomIndex(random, length) {
  const value = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  return Math.floor(value * length);
}

function pick(random, values) {
  return values[randomIndex(random, values.length)];
}

function shuffle(random, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(random, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomWithSalt(random, salt) {
  if (!salt) return random;
  const offset = ((salt * 0.6180339887498949) % 1 + 1) % 1;
  return () => ((Number(random()) || 0) + offset) % 1;
}

export function formatMoney(centavos) {
  return formatMoneyAmount(centavos);
}

export function addMoney(...amounts) {
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    throw new RangeError('Cada valor deve ser um número inteiro e não negativo de centavos.');
  }
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) throw new RangeError('A soma excede o limite seguro de centavos.');
  return total;
}

export function subtractMoney(minuend, subtrahend) {
  if (!Number.isSafeInteger(minuend) || minuend < 0 || !Number.isSafeInteger(subtrahend) || subtrahend < 0 || subtrahend > minuend) {
    throw new RangeError('A subtração precisa usar centavos inteiros e não pode resultar em valor negativo.');
  }
  return minuend - subtrahend;
}

function getProduct(random, usedIds = new Set()) {
  const available = SHOPPING_PRODUCTS.filter(({ id }) => !usedIds.has(id));
  return pick(random, available.length ? available : SHOPPING_PRODUCTS);
}

function withProductArticle(product) {
  return `${product.article} ${product.name}`;
}

function makeNumericOptions(answer, unit, random) {
  const steps = unit === 'reais' ? [100, 200, 300] : [5, 10, 15, 20, 25];
  const candidates = steps.flatMap((step) => [answer - step, answer + step]);
  const distractors = [...new Set(candidates.filter((value) => isMoneyAmountInUnit(value, unit) && value !== answer))].slice(0, 3);
  if (distractors.length < 3) {
    const step = unit === 'reais' ? 100 : 5;
    const limit = unit === 'reais' ? Number.MAX_SAFE_INTEGER : 100;
    for (let value = 0; value < limit && distractors.length < 3; value += step) {
      if (value !== answer && !distractors.includes(value)) distractors.push(value);
    }
  }
  const options = shuffle(random, [answer, ...distractors]).map((value) => ({ value, label: formatMoney(value) }));
  return { options, correctIndex: options.findIndex(({ value }) => value === answer) };
}

function finishNumericQuestion({ family, subtype, answer, operationUnit, operationAmounts, explanation, prompt, speech, signature, values, random }) {
  if (!isMoneyOperationInUnit(operationAmounts, answer, operationUnit)) {
    throw new Error(`${AV2_MAT_RULE_AV2_MAT_01} / ${AV2_MAT_RULE_AV2_MAT_02} rejeitaram uma questão com unidade inconsistente.`);
  }
  const { options, correctIndex } = makeNumericOptions(answer, operationUnit, random);
  const products = values.products ?? (values.product ? [values.product] : []);
  const money = family === 'remaining'
    ? [{ label: `${values.character} tinha`, amount: values.available, items: values.availableItems }]
    : family === 'missing'
      ? [{ label: `${values.character} tem`, amount: values.available, items: values.availableItems }]
      : family === 'change'
        ? [{ label: `${values.character} pagou`, amount: values.payment.value, items: values.payment.items }]
        : [];
  return {
    revisionId: AV2_REVISION_ID,
    activityId: AV2_SHOPPING_ACTIVITY_ID,
    questionId: JSON.stringify([family, subtype, ...signature]),
    type: 'shopping',
    family,
    subtype,
    prompt,
    speech,
    answer,
    answerType: 'money',
    operationUnit,
    domain: domainForUnit(operationUnit),
    ruleId: AV2_MAT_RULE_AV2_MAT_01,
    rulesApplied: [AV2_MAT_RULE_AV2_MAT_01, AV2_MAT_RULE_AV2_MAT_02],
    options,
    correctIndex,
    operation: ['money-addition', 'price-addition'].includes(family) ? 'addition'
      : family === 'compare' ? 'comparison'
        : 'subtraction',
    explanation,
    values,
    visuals: family === 'money-addition'
      ? { moneyItems: values.items }
      : { products, money },
    fingerprint: JSON.stringify([family, subtype, ...signature]),
  };
}

function createMoneyAddition(random, level, variant) {
  const count = level === 1 ? 2 : 3;
  const operationUnit = variant === 0 || level === 1 || level >= 3 ? 'reais' : 'centavos';
  const bills = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'bill' && value <= 1000);
  const centavoCoins = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'coin' && value >= 10 && value < 100);
  const realCoins = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'coin' && value === 100);
  let items;
  if (variant === 0 || level === 1) {
    items = Array.from({ length: count }, () => {
      const denomination = pick(random, bills);
      return { denomination, value: denomination.value };
    });
  } else if (level === 2) {
    // AV2-MAT-02: keep the centavo total below one real, even with three coins.
    const combinations = Array.from({ length: 500 }, () => Array.from({ length: count }, () => {
      const denomination = pick(random, centavoCoins);
      return { denomination, value: denomination.value };
    })).filter((group) => isMoneyOperationInUnit(
      group.map(({ value }) => value),
      group.reduce((total, item) => total + item.value, 0),
      'centavos',
    ));
    items = combinations.length
      ? pick(random, combinations)
      : Array.from({ length: count }, () => {
        const denomination = centavoCoins.find(({ value }) => value === 10);
        return { denomination, value: denomination.value };
      });
  } else {
    const coin = pick(random, realCoins);
    const bill = pick(random, bills);
    const third = pick(random, [...realCoins, ...bills]);
    items = [coin, bill, third].map((denomination) => ({ denomination, value: denomination.value }));
  }
  const answer = addMoney(...items.map((item) => item.value));
  if (!isMoneyOperationInUnit(items.map(({ value }) => value), answer, operationUnit)) {
    throw new Error(`${AV2_MAT_RULE_AV2_MAT_02} rejeitou uma soma de dinheiro fora da unidade.`);
  }
  const descriptions = items.map(({ value }) => formatMoney(value));
  return finishNumericQuestion({
    family: 'money-addition',
    subtype: 'sum-currency-items',
    answer,
    operationUnit,
    operationAmounts: items.map(({ value }) => value),
    prompt: 'Quanto dinheiro temos ao todo?',
    speech: 'Quanto dinheiro temos ao todo?',
    explanation: `Vamos juntar os valores: ${descriptions.join(' mais ')} são ${formatMoney(answer)}.`,
    values: { items, total: answer },
    signature: [items.map(({ denomination }) => denomination.id).sort().join(',')],
    random,
  });
}

function createPriceQuestion(random, level, variant, childName) {
  // Whole-real prices keep repeated addition within the taught operation domain.
  if (variant === 0) {
    const product = getProduct(random);
    const price = pick(random, WHOLE_REAL_PRICES);
    const character = childName || pick(random, CHARACTERS);
    const answer = addMoney(price, price);
    return finishNumericQuestion({
      family: 'price-addition',
      subtype: 'add-identical-prices',
      answer,
      operationUnit: 'reais',
      operationAmounts: [price, price],
      prompt: `${character} comprou dois produtos iguais. Quanto gastou?`,
      speech: `${character} comprou dois produtos iguais. Cada um custa ${formatMoney(price)}. Quanto gastou?`,
      explanation: `Cada produto custa ${formatMoney(price)}. Somamos os dois preços: ${formatMoney(price)} mais ${formatMoney(price)} são ${formatMoney(answer)}.`,
      values: { products: [{ ...product, price }, { ...product, price }], total: answer },
      signature: [product.id, price, 'twice'],
      random,
    });
  }

  const operationUnit = unitForLevel(level, random);
  const prices = pricesForUnit(operationUnit);
  const first = getProduct(random);
  const second = getProduct(random, new Set([first.id]));
  const [firstPrice, secondPrice] = chooseTwoPrices(random, operationUnit);
  const answer = addMoney(firstPrice, secondPrice);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'price-addition',
    subtype: 'add-prices',
    answer,
    operationUnit,
    operationAmounts: [firstPrice, secondPrice],
    prompt: `${character} comprou estes dois produtos. Quanto gastou?`,
    speech: `${character} comprou ${withProductArticle(first)} por ${formatMoney(firstPrice)} e ${withProductArticle(second)} por ${formatMoney(secondPrice)}. Quanto gastou?`,
    explanation: `Para descobrir o total, somamos os preços: ${formatMoney(firstPrice)} mais ${formatMoney(secondPrice)} são ${formatMoney(answer)}.`,
    values: { products: [{ ...first, price: firstPrice }, { ...second, price: secondPrice }], total: answer },
    signature: [[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort().join(',')],
    random,
  });
}

function createRemainingQuestion(random, level, childName) {
  const operationUnit = unitForLevel(level, random);
  const prices = pricesForUnit(operationUnit);
  let available = pick(random, prices);
  let cost = pick(random, prices);
  for (let attempt = 0; available <= cost && attempt < 20; attempt += 1) {
    available = pick(random, prices);
    cost = pick(random, prices);
  }
  if (available <= cost) {
    [available, cost] = operationUnit === 'reais' ? [1000, 500] : [75, 25];
  }
  const product = getProduct(random);
  const answer = subtractMoney(available, cost);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'remaining',
    subtype: 'spend-and-keep',
    answer,
    operationUnit,
    operationAmounts: [available, cost],
    prompt: `${character} comprou ${withProductArticle(product)}. Quanto dinheiro sobrou?`,
    speech: `${character} tinha ${formatMoney(available)} e comprou ${withProductArticle(product)} por ${formatMoney(cost)}. Quanto dinheiro sobrou?`,
    explanation: `Para saber quanto sobrou, tiramos o que foi gasto: ${formatMoney(available)} menos ${formatMoney(cost)} são ${formatMoney(answer)}.`,
    values: { character, available, availableItems: representMoney(available, operationUnit), cost, product: { ...product, price: cost }, remaining: answer },
    signature: [available, cost, product.id],
    random,
  });
}

function createMissingQuestion(random, level, childName) {
  const operationUnit = unitForLevel(level, random);
  const prices = pricesForUnit(operationUnit);
  let price = pick(random, prices);
  let available = pick(random, prices);
  for (let attempt = 0; available >= price && attempt < 20; attempt += 1) {
    price = pick(random, prices);
    available = pick(random, prices);
  }
  if (available >= price) {
    [price, available] = operationUnit === 'reais' ? [1000, 500] : [75, 25];
  }
  const product = getProduct(random);
  const answer = subtractMoney(price, available);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'missing',
    subtype: 'save-toward-price',
    answer,
    operationUnit,
    operationAmounts: [price, available],
    prompt: `${character} quer comprar ${withProductArticle(product)}. Quanto dinheiro falta?`,
    speech: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)}. ${character} tem ${formatMoney(available)}. Quanto dinheiro falta?`,
    explanation: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)} e você tem ${formatMoney(available)}. Faltam ${formatMoney(answer)}.`,
    values: { character, price, available, availableItems: representMoney(available, operationUnit), product: { ...product, price }, missing: answer },
    signature: [price, available, product.id],
    random,
  });
}

function createChangeQuestion(random, level, childName) {
  const operationUnit = unitForLevel(level, random);
  let payment;
  if (operationUnit === 'reais') {
    const notes = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'bill' && value <= 1000);
    const denomination = pick(random, notes);
    payment = {
      ...denomination,
      value: denomination.value,
      items: [{ denomination, value: denomination.value }],
    };
  } else {
    const coins = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'coin' && value > 0 && value < 100);
    let items = [];
    let total = 100;
    for (let attempt = 0; attempt < 100 && (total >= 100 || total < 50); attempt += 1) {
      items = Array.from({ length: 2 + randomIndex(random, 2) }, () => {
        const denomination = pick(random, coins);
        return { denomination, value: denomination.value };
      });
      total = items.reduce((sum, item) => sum + item.value, 0);
    }
    if (total >= 100 || total < 50) {
      const denomination = coins.find(({ value }) => value === 25);
      items = [{ denomination, value: 25 }, { denomination, value: 25 }];
      total = 50;
    }
    payment = {
      id: items.map(({ denomination }) => denomination.id).join('+'),
      kind: 'group',
      value: total,
      items,
      description: `Grupo de moedas que totaliza ${formatMoney(total)}.`,
    };
  }
  const validPrices = pricesForUnit(operationUnit).filter((value) => value < payment.value);
  const price = pick(random, validPrices);
  const product = getProduct(random);
  const answer = subtractMoney(payment.value, price);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'change',
    subtype: 'pay-and-receive-change',
    answer,
    operationUnit,
    operationAmounts: [payment.value, price],
    prompt: `${character} comprou ${withProductArticle(product)}. Quanto recebeu de troco?`,
    speech: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)}. ${character} pagou com ${formatMoney(payment.value)}. Quanto recebeu de troco?`,
    explanation: `O troco é o dinheiro que volta. Você pagou ${formatMoney(payment.value)} por algo que custa ${formatMoney(price)}. O troco é ${formatMoney(answer)}.`,
    values: { character, product: { ...product, price }, payment, change: answer },
    signature: [price, payment.id, product.id],
    random,
  });
}

function createComparisonQuestion(random, level, variant) {
  const first = getProduct(random);
  const second = getProduct(random, new Set([first.id]));
  const operationUnit = unitForLevel(level, random);
  const prices = pricesForUnit(operationUnit);
  let firstPrice = pick(random, prices);
  let secondPrice = pick(random, prices);
  for (let attempt = 0; firstPrice === secondPrice && attempt < 20; attempt += 1) {
    secondPrice = pick(random, prices);
  }
  if (firstPrice === secondPrice) secondPrice = prices.find((price) => price !== firstPrice);
  const products = [{ ...first, price: firstPrice }, { ...second, price: secondPrice }];
  if (!products.every(({ price }) => isMoneyAmountInUnit(price, operationUnit))) {
    throw new Error(`${AV2_MAT_RULE_AV2_MAT_01} rejeitou uma comparação com unidades misturadas.`);
  }
  const moreExpensive = firstPrice > secondPrice ? products[0] : products[1];
  const lessExpensive = firstPrice < secondPrice ? products[0] : products[1];

  if (variant === 0) {
    const asksMore = random() < 0.5;
    const answer = asksMore ? moreExpensive.id : lessExpensive.id;
    const target = asksMore ? 'mais caro' : 'mais barato';
    const comparisonText = asksMore
      ? (moreExpensive.article === 'a' ? 'a mais cara' : 'o mais caro')
      : (lessExpensive.article === 'a' ? 'a mais barata' : 'o mais barato');
    const options = shuffle(random, products.map(({ id, name, icon, price }) => ({ value: id, label: name, product: { id, name, icon, price } })));
    return {
      revisionId: AV2_REVISION_ID,
      activityId: AV2_SHOPPING_ACTIVITY_ID,
      questionId: JSON.stringify(['compare', 'choose-product', ...[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort(), target]),
      type: 'shopping',
      family: 'compare',
      subtype: asksMore ? 'choose-more-expensive' : 'choose-cheaper',
      prompt: `Qual produto é ${target}?`,
      speech: `${first.article[0].toUpperCase()}${first.article.slice(1)} ${first.name} custa ${formatMoney(firstPrice)} e ${second.article} ${second.name} custa ${formatMoney(secondPrice)}. Qual produto é ${target}?`,
      answer,
      answerType: 'product',
      operationUnit,
      domain: domainForUnit(operationUnit),
      ruleId: AV2_MAT_RULE_AV2_MAT_01,
      rulesApplied: [AV2_MAT_RULE_AV2_MAT_01, AV2_MAT_RULE_AV2_MAT_02],
      options,
      correctIndex: options.findIndex(({ value }) => value === answer),
      operation: 'comparison',
      explanation: `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} custa ${formatMoney(moreExpensive.price)} e ${lessExpensive.article} ${lessExpensive.name} custa ${formatMoney(lessExpensive.price)}. ${asksMore ? `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} é ${comparisonText}` : `${lessExpensive.article[0].toUpperCase()}${lessExpensive.article.slice(1)} ${lessExpensive.name} é ${comparisonText}`}.`,
      values: { products, moreExpensiveId: moreExpensive.id, lessExpensiveId: lessExpensive.id },
      visuals: { products, money: [] },
      fingerprint: JSON.stringify(['compare', 'choose-product', ...[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort(), target]),
    };
  }

  const answer = subtractMoney(Math.max(firstPrice, secondPrice), Math.min(firstPrice, secondPrice));
  return finishNumericQuestion({
    family: 'compare',
    subtype: 'find-price-difference',
    answer,
    operationUnit,
    operationAmounts: [firstPrice, secondPrice],
    prompt: 'Qual é a diferença entre os preços destes produtos?',
    speech: `${first.article[0].toUpperCase()}${first.article.slice(1)} ${first.name} custa ${formatMoney(firstPrice)} e ${second.article} ${second.name} custa ${formatMoney(secondPrice)}. Qual é a diferença entre os preços?`,
    explanation: `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} custa ${formatMoney(Math.max(firstPrice, secondPrice))} e ${lessExpensive.article} ${lessExpensive.name} custa ${formatMoney(Math.min(firstPrice, secondPrice))}. A diferença é de ${formatMoney(answer)}.`,
    values: { products, difference: answer },
    signature: [[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort().join(',')],
    random,
  });
}

function isValidMoneyRepresentation(items, total, unit) {
  if (!Array.isArray(items) || items.length === 0 || !Number.isSafeInteger(total)) return false;
  const represented = items.reduce((sum, { denomination, value }) => {
    const canonical = CURRENCY_DENOMINATIONS.find(({ id }) => id === denomination?.id);
    if (!canonical || canonical.value !== value || denomination.value !== value) return Number.NaN;
    if (unit === 'reais' && value % 100 !== 0) return Number.NaN;
    if (unit === 'centavos' && (denomination.kind !== 'coin' || value >= 100)) return Number.NaN;
    return sum + value;
  }, 0);
  return represented === total;
}

function matchesDomain(question) {
  return question.domain === domainForUnit(question.operationUnit);
}

function sameProducts(first, second) {
  return Array.isArray(first) && Array.isArray(second) && first.length === second.length
    && first.every((product, index) => product?.id === second[index]?.id
      && product?.name === second[index]?.name
      && product?.price === second[index]?.price);
}

function sameMoneyItems(first, second) {
  return Array.isArray(first) && Array.isArray(second) && first.length === second.length
    && first.every((item, index) => item?.value === second[index]?.value
      && item?.denomination?.id === second[index]?.denomination?.id);
}

function isVisualModelAligned(question) {
  const values = question.values ?? {};
  const visuals = question.visuals;
  if (!visuals || typeof visuals !== 'object') return false;
  if (question.family === 'money-addition') {
    return sameMoneyItems(visuals.moneyItems, values.items)
      && (!visuals.products || visuals.products.length === 0)
      && (!visuals.money || visuals.money.length === 0);
  }
  const expectedProducts = values.products ?? (values.product ? [values.product] : []);
  if (!sameProducts(visuals.products, expectedProducts)) return false;
  let expectedMoney = [];
  if (question.family === 'remaining') expectedMoney = [{ label: `${values.character} tinha`, amount: values.available, items: values.availableItems }];
  else if (question.family === 'missing') expectedMoney = [{ label: `${values.character} tem`, amount: values.available, items: values.availableItems }];
  else if (question.family === 'change') expectedMoney = [{ label: `${values.character} pagou`, amount: values.payment?.value, items: values.payment?.items }];
  if (!Array.isArray(visuals.money) || visuals.money.length !== expectedMoney.length) return false;
  return expectedMoney.every((item, index) => visuals.money[index]?.label === item.label
    && visuals.money[index]?.amount === item.amount
    && sameMoneyItems(visuals.money[index]?.items, item.items));
}

export function createShoppingQuestion(family, {
  random = Math.random,
  level = 1,
  variant = 0,
  childName = '',
  salt = 0,
} = {}) {
  const source = randomWithSalt(random, salt);
  let question;
  if (family === 'money-addition') question = createMoneyAddition(source, level, variant);
  else if (family === 'price-addition') question = createPriceQuestion(source, level, variant, childName);
  else if (family === 'remaining') question = createRemainingQuestion(source, level, childName);
  else if (family === 'missing') question = createMissingQuestion(source, level, childName);
  else if (family === 'change') question = createChangeQuestion(source, level, childName);
  else if (family === 'compare') question = createComparisonQuestion(source, level, variant);
  else throw new RangeError(`Família de exercício desconhecida: ${family}`);

  if (!validateShoppingAnswer(question, question.answer)) {
    throw new TypeError('A questão viola as regras pedagógicas de Compras e Troco.');
  }
  return question;
}

export function validateShoppingAnswer(question, answer) {
  if (question?.type !== 'shopping'
    || question.revisionId !== AV2_REVISION_ID
    || question.activityId !== AV2_SHOPPING_ACTIVITY_ID
    || !isVisualModelAligned(question)
    || !Array.isArray(question.options)) return false;
  if (question.answerType === 'product') {
    const products = question.values?.products;
    if (question.family !== 'compare' || question.options.length !== 2
      || new Set(question.options.map(({ value }) => value)).size !== 2
      || products?.length !== 2
      || !products.every(({ price }) => Number.isSafeInteger(price) && price >= 0)
      || question.ruleId !== AV2_MAT_RULE_AV2_MAT_01
      || !question.rulesApplied?.includes(AV2_MAT_RULE_AV2_MAT_02)
      || !['reais', 'centavos'].includes(question.operationUnit)
      || !matchesDomain(question)
      || !products.every(({ price }) => isMoneyAmountInUnit(price, question.operationUnit))
      || products[0].price === products[1].price) return false;
    const moreExpensive = products[0].price > products[1].price ? products[0] : products[1];
    const lessExpensive = products[0].price < products[1].price ? products[0] : products[1];
    const expectedAnswer = question.subtype === 'choose-more-expensive'
      ? moreExpensive.id
      : question.subtype === 'choose-cheaper'
        ? lessExpensive.id
        : null;
    return expectedAnswer !== null
      && question.values.moreExpensiveId === moreExpensive.id
      && question.values.lessExpensiveId === lessExpensive.id
      && question.options.filter(({ value }) => value === expectedAnswer).length === 1
      && question.options.every((option) => products.some((product) => option.value === product.id
        && option.product?.id === product.id && option.product?.price === product.price))
      && question.correctIndex === question.options.findIndex(({ value }) => value === expectedAnswer)
      && question.answer === expectedAnswer
      && answer === expectedAnswer;
  }
  const values = question.options.map(({ value }) => value);
  if (question.ruleId !== AV2_MAT_RULE_AV2_MAT_01
    || !question.rulesApplied?.includes(AV2_MAT_RULE_AV2_MAT_02)
    || !['reais', 'centavos'].includes(question.operationUnit)
    || !matchesDomain(question)
    || !values.every((value) => isMoneyAmountInUnit(value, question.operationUnit))
    || new Set(values).size !== values.length
    || values.filter((value) => value === question.answer).length !== 1
    || question.correctIndex !== question.options.findIndex(({ value }) => value === question.answer)) return false;
  let expectedAnswer;
  let operationAmounts = [];
  try {
    if (question.family === 'money-addition') {
      const items = question.values?.items;
      if (!Array.isArray(items) || items.length < 2 || items.length > 3) return false;
      operationAmounts = items.map(({ value, denomination }) => {
        if (!Number.isSafeInteger(value) || value !== denomination?.value) throw new RangeError();
        return value;
      });
      if (!isValidMoneyRepresentation(items, question.answer, question.operationUnit)) return false;
      expectedAnswer = addMoney(...operationAmounts);
    } else if (question.family === 'price-addition') {
      const products = question.values?.products;
      if (!Array.isArray(products) || products.length !== 2
        || !products.every(({ price }) => Number.isSafeInteger(price) && price > 0)
        || !['add-prices', 'add-identical-prices'].includes(question.subtype)) return false;
      if (question.subtype === 'add-identical-prices'
        && (products[0].id !== products[1].id || products[0].price !== products[1].price || question.operationUnit !== 'reais')) return false;
      if (question.subtype === 'add-prices' && products[0].id === products[1].id) return false;
      operationAmounts = products.map(({ price }) => price);
      expectedAnswer = addMoney(...operationAmounts);
    } else if (question.family === 'remaining') {
      if (question.values.available <= question.values.cost) return false;
      if (!isValidMoneyRepresentation(question.values.availableItems, question.values.available, question.operationUnit)) return false;
      operationAmounts = [question.values.available, question.values.cost];
      expectedAnswer = subtractMoney(question.values.available, question.values.cost);
    } else if (question.family === 'missing') {
      if (question.values.price <= question.values.available) return false;
      if (!isValidMoneyRepresentation(question.values.availableItems, question.values.available, question.operationUnit)) return false;
      operationAmounts = [question.values.price, question.values.available];
      expectedAnswer = subtractMoney(question.values.price, question.values.available);
    } else if (question.family === 'change') {
      if (question.values.payment?.value < question.values.product?.price) return false;
      const paymentItems = question.values.payment.items;
      if (!isValidMoneyRepresentation(paymentItems, question.values.payment.value, question.operationUnit)) return false;
      operationAmounts = [question.values.payment.value, question.values.product.price];
      expectedAnswer = subtractMoney(question.values.payment?.value, question.values.product?.price);
    } else if (question.family === 'compare') {
      const products = question.values?.products;
      if (!Array.isArray(products) || products.length !== 2 || products[0].price === products[1].price) return false;
      operationAmounts = products.map(({ price }) => price);
      expectedAnswer = subtractMoney(
        Math.max(...products.map(({ price }) => price)),
        Math.min(...products.map(({ price }) => price)),
      );
    } else return false;
  } catch {
    return false;
  }
  const numericAnswer = typeof answer === 'string' && answer.trim() !== '' ? Number(answer) : answer;
  return isMoneyOperationInUnit(operationAmounts, expectedAnswer, question.operationUnit)
    && Number.isSafeInteger(expectedAnswer)
    && expectedAnswer === question.answer
    && Number.isSafeInteger(numericAnswer)
    && numericAnswer === expectedAnswer;
}

export function createShoppingRound({
  random = Math.random,
  roundNumber = 1,
  childName = '',
  recentFingerprints = [],
} = {}) {
  const seen = new Set(recentFingerprints);
  const questions = [];
  SHOPPING_FAMILIES.forEach(({ id }, familyIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const level = Math.min(3, 1 + variant + Math.floor(Math.max(0, roundNumber - 1) / 2));
      let question;
      for (let attempt = 0; attempt < 300; attempt += 1) {
        question = createShoppingQuestion(id, {
          random,
          level,
          variant,
          childName,
          salt: roundNumber * 101 + familyIndex * 37 + variant * 19 + attempt * 13,
        });
        if (!seen.has(question.fingerprint)) break;
      }
      seen.add(question.fingerprint);
      questions.push(question);
    }
  });
  return shuffle(random, questions);
}
