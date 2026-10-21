import {
  AV2_REVISION_ID,
  MONEY_DENOMINATIONS,
  formatMoneyAmount,
} from './money.js';

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
const CENTAVO_PRICES = [25, 50, 75, 125, 150, 175, 225, 250, 275, 350, 450, 550, 650, 750];

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

function pricesForLevel(level) {
  return level === 1 ? WHOLE_REAL_PRICES : level === 2 ? CENTAVO_PRICES : [...WHOLE_REAL_PRICES, ...CENTAVO_PRICES];
}

function storyPricesForLevel(level) {
  return level === 1 ? WHOLE_REAL_PRICES : level === 2 ? [25, 50, 75, 100] : [...WHOLE_REAL_PRICES, ...CENTAVO_PRICES];
}

function getProduct(random, usedIds = new Set()) {
  const available = SHOPPING_PRODUCTS.filter(({ id }) => !usedIds.has(id));
  return pick(random, available.length ? available : SHOPPING_PRODUCTS);
}

function withProductArticle(product) {
  return `${product.article} ${product.name}`;
}

function makeNumericOptions(answer, random) {
  const steps = answer >= 100 && answer % 100 === 0 ? [100, 200, 300] : [100, 200, 50, 25, 300];
  const candidates = steps.flatMap((step) => [answer - step, answer + step]);
  const distractors = [...new Set(candidates.filter((value) => Number.isSafeInteger(value) && value >= 0 && value !== answer))].slice(0, 3);
  if (distractors.length < 3) {
    for (let value = 0; distractors.length < 3; value += 25) {
      if (value !== answer && !distractors.includes(value)) distractors.push(value);
    }
  }
  const options = shuffle(random, [answer, ...distractors]).map((value) => ({ value, label: formatMoney(value) }));
  return { options, correctIndex: options.findIndex(({ value }) => value === answer) };
}

function finishNumericQuestion({ family, subtype, answer, explanation, prompt, speech, signature, values, random }) {
  const { options, correctIndex } = makeNumericOptions(answer, random);
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
    options,
    correctIndex,
    operation: ['money-addition', 'price-addition'].includes(family) ? 'addition'
      : family === 'compare' ? 'comparison'
        : 'subtraction',
    explanation,
    values,
    fingerprint: JSON.stringify([family, subtype, ...signature]),
  };
}

function createMoneyAddition(random, level, variant) {
  const count = level === 1 ? 2 : 3;
  const bills = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'bill' && value <= 1000);
  const coins = CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'coin' && value >= 25 && value <= 100);
  let denominations;
  let items;
  if (variant === 0 || level === 1) {
    denominations = bills;
    items = Array.from({ length: count }, () => {
      const denomination = pick(random, denominations);
      return { denomination, value: denomination.value };
    });
  } else if (level === 2) {
    denominations = coins;
    items = Array.from({ length: count }, () => {
      const denomination = pick(random, denominations);
      return { denomination, value: denomination.value };
    });
  } else {
    const coin = pick(random, coins);
    const bill = pick(random, bills);
    const third = pick(random, [...coins, ...bills]);
    items = [coin, bill, third].map((denomination) => ({ denomination, value: denomination.value }));
  }
  const answer = addMoney(...items.map((item) => item.value));
  const descriptions = items.map(({ value }) => formatMoney(value));
  return finishNumericQuestion({
    family: 'money-addition',
    subtype: 'sum-currency-items',
    answer,
    prompt: 'Quanto dinheiro temos ao todo?',
    speech: 'Quanto dinheiro temos ao todo?',
    explanation: `Vamos juntar os valores: ${descriptions.join(' mais ')} são ${formatMoney(answer)}.`,
    values: { items, total: answer },
    signature: [items.map(({ denomination }) => denomination.id).sort().join(',')],
    random,
  });
}

function createPriceQuestion(random, level, variant, childName) {
  if (variant === 0) {
    const product = getProduct(random);
    const price = pick(random, pricesForLevel(level));
    return finishNumericQuestion({
      family: 'price-addition',
      subtype: 'read-price',
      answer: price,
      prompt: `Quanto custa ${product.article} ${product.name}?`,
      speech: `Quanto custa ${product.article} ${product.name}?`,
      explanation: `O preço d${product.article === 'a' ? 'a' : 'o'} ${product.name} é ${formatMoney(price)}.`,
      values: { products: [{ ...product, price }], total: price },
      signature: [product.id, price],
      random,
    });
  }

  const first = getProduct(random);
  const second = getProduct(random, new Set([first.id]));
  const prices = pricesForLevel(level);
  const firstPrice = pick(random, prices);
  const secondPrice = pick(random, prices);
  const answer = addMoney(firstPrice, secondPrice);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'price-addition',
    subtype: 'add-prices',
    answer,
    prompt: `${character} comprou ${withProductArticle(first)} por ${formatMoney(firstPrice)} e ${withProductArticle(second)} por ${formatMoney(secondPrice)}. Quanto gastou ao todo?`,
    speech: `Uma criança comprou ${withProductArticle(first)} por ${formatMoney(firstPrice)} e ${withProductArticle(second)} por ${formatMoney(secondPrice)}. Quanto gastou ao todo?`,
    explanation: `Para descobrir o total, somamos os preços: ${formatMoney(firstPrice)} mais ${formatMoney(secondPrice)} são ${formatMoney(answer)}.`,
    values: { products: [{ ...first, price: firstPrice }, { ...second, price: secondPrice }], total: answer },
    signature: [[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort().join(',')],
    random,
  });
}

function createRemainingQuestion(random, level, childName) {
  const prices = storyPricesForLevel(level);
  let available = pick(random, prices);
  let cost = pick(random, prices);
  for (let attempt = 0; available <= cost && attempt < 20; attempt += 1) {
    available = pick(random, prices);
    cost = pick(random, prices);
  }
  if (available <= cost) {
    available = level === 1 ? 1000 : 750;
    cost = level === 1 ? 500 : 250;
  }
  const product = getProduct(random);
  const answer = subtractMoney(available, cost);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'remaining',
    subtype: 'spend-and-keep',
    answer,
    prompt: `${character} tinha ${formatMoney(available)} e comprou ${withProductArticle(product)} por ${formatMoney(cost)}. Quanto dinheiro sobrou?`,
    speech: 'Uma criança tinha dinheiro e comprou um produto. Quanto dinheiro sobrou?',
    explanation: `Para saber quanto sobrou, tiramos o que foi gasto: ${formatMoney(available)} menos ${formatMoney(cost)} são ${formatMoney(answer)}.`,
    values: { available, cost, product: { ...product, price: cost }, remaining: answer },
    signature: [available, cost, product.id],
    random,
  });
}

function createMissingQuestion(random, level, childName) {
  const prices = storyPricesForLevel(level);
  let price = pick(random, prices);
  let available = pick(random, prices);
  for (let attempt = 0; available >= price && attempt < 20; attempt += 1) {
    price = pick(random, prices);
    available = pick(random, prices);
  }
  if (available >= price) {
    price = level === 1 ? 1000 : 750;
    available = level === 1 ? 500 : 250;
  }
  const product = getProduct(random);
  const answer = subtractMoney(price, available);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'missing',
    subtype: 'save-toward-price',
    answer,
    prompt: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)}. ${character} tem ${formatMoney(available)}. Quanto falta para comprar?`,
    speech: `Um produto custa ${formatMoney(price)}. Uma criança tem ${formatMoney(available)}. Quanto falta para comprar?`,
    explanation: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)} e você tem ${formatMoney(available)}. Faltam ${formatMoney(answer)}.`,
    values: { price, available, product: { ...product, price }, missing: answer },
    signature: [price, available, product.id],
    random,
  });
}

function paymentDenominations(level) {
  if (level === 1) return CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'bill' && value <= 1000);
  if (level === 2) return CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'coin' && value >= 50 && value <= 100);
  return CURRENCY_DENOMINATIONS.filter(({ value }) => value <= 1000);
}

function createChangeQuestion(random, level, childName) {
  if (level >= 3) {
    const useWholeReais = random() < 0.5;
    const payment = useWholeReais
      ? pick(random, CURRENCY_DENOMINATIONS.filter(({ kind, value }) => kind === 'bill' && value >= 500 && value <= 1000))
      : CURRENCY_DENOMINATIONS.find(({ id }) => id === 'coin-1-real');
    const priceCatalog = useWholeReais ? [200, 300, 400, 500, 700, 800] : [25, 50, 75];
    const price = pick(random, priceCatalog.filter((value) => value < payment.value));
    const product = getProduct(random);
    const answer = subtractMoney(payment.value, price);
    const character = childName || pick(random, CHARACTERS);
    return finishNumericQuestion({
      family: 'change',
      subtype: 'pay-and-receive-change',
      answer,
      prompt: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)}. ${character} pagou com ${formatMoney(payment.value)}. Quanto recebeu de troco?`,
      speech: `Um produto custa ${formatMoney(price)}. Uma criança pagou com ${formatMoney(payment.value)}. Quanto recebeu de troco?`,
      explanation: `O troco é o dinheiro que volta. Você pagou ${formatMoney(payment.value)} por algo que custa ${formatMoney(price)}. O troco é ${formatMoney(answer)}.`,
      values: { product: { ...product, price }, payment: { ...payment, value: payment.value }, change: answer },
      signature: [price, payment.id, product.id],
      random,
    });
  }
  const priceCatalog = level === 2 ? [25, 50, 75] : pricesForLevel(level);
  let payment = pick(random, paymentDenominations(level));
  let price = pick(random, priceCatalog);
  for (let attempt = 0; price >= payment.value && attempt < 20; attempt += 1) {
    payment = pick(random, paymentDenominations(level));
    price = pick(random, priceCatalog);
  }
  if (price >= payment.value) {
    payment = CURRENCY_DENOMINATIONS.find(({ id }) => id === (level === 1 ? 'note-10-reais' : 'coin-1-real'));
    price = level === 1 ? 700 : 50;
  }
  const product = getProduct(random);
  const answer = subtractMoney(payment.value, price);
  const character = childName || pick(random, CHARACTERS);
  return finishNumericQuestion({
    family: 'change',
    subtype: 'pay-and-receive-change',
    answer,
    prompt: `${product.article[0].toUpperCase()}${product.article.slice(1)} ${product.name} custa ${formatMoney(price)}. ${character} pagou com ${formatMoney(payment.value)}. Quanto recebeu de troco?`,
    speech: `Um produto custa ${formatMoney(price)}. Uma criança pagou com ${formatMoney(payment.value)}. Quanto recebeu de troco?`,
    explanation: `O troco é o dinheiro que volta. Você pagou ${formatMoney(payment.value)} por algo que custa ${formatMoney(price)}. O troco é ${formatMoney(answer)}.`,
    values: { product: { ...product, price }, payment: { ...payment, value: payment.value }, change: answer },
    signature: [price, payment.id, product.id],
    random,
  });
}

function createComparisonQuestion(random, level, variant) {
  const first = getProduct(random);
  const second = getProduct(random, new Set([first.id]));
  const prices = pricesForLevel(level);
  let firstPrice = pick(random, prices);
  let secondPrice = pick(random, prices);
  for (let attempt = 0; firstPrice === secondPrice && attempt < 20; attempt += 1) {
    secondPrice = pick(random, prices);
  }
  if (firstPrice === secondPrice) secondPrice = firstPrice === 100 ? 200 : 100;
  const products = [{ ...first, price: firstPrice }, { ...second, price: secondPrice }];
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
      speech: `Qual produto é ${target}?`,
      answer,
      answerType: 'product',
      options,
      correctIndex: options.findIndex(({ value }) => value === answer),
      operation: 'comparison',
      explanation: `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} custa ${formatMoney(moreExpensive.price)} e ${lessExpensive.article} ${lessExpensive.name} custa ${formatMoney(lessExpensive.price)}. ${asksMore ? `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} é ${comparisonText}` : `${lessExpensive.article[0].toUpperCase()}${lessExpensive.article.slice(1)} ${lessExpensive.name} é ${comparisonText}`}.`,
      values: { products, moreExpensiveId: moreExpensive.id, lessExpensiveId: lessExpensive.id },
      fingerprint: JSON.stringify(['compare', 'choose-product', ...[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort(), target]),
    };
  }

  const answer = subtractMoney(Math.max(firstPrice, secondPrice), Math.min(firstPrice, secondPrice));
  return finishNumericQuestion({
    family: 'compare',
    subtype: 'find-price-difference',
    answer,
    prompt: `${first.article[0].toUpperCase()}${first.article.slice(1)} ${first.name} custa ${formatMoney(firstPrice)} e ${second.article} ${second.name} custa ${formatMoney(secondPrice)}. Qual é a diferença entre os preços?`,
    speech: `${first.article[0].toUpperCase()}${first.article.slice(1)} ${first.name} custa ${formatMoney(firstPrice)} e ${second.article} ${second.name} custa ${formatMoney(secondPrice)}. Qual é a diferença entre os preços?`,
    explanation: `${moreExpensive.article[0].toUpperCase()}${moreExpensive.article.slice(1)} ${moreExpensive.name} custa ${formatMoney(Math.max(firstPrice, secondPrice))} e ${lessExpensive.article} ${lessExpensive.name} custa ${formatMoney(Math.min(firstPrice, secondPrice))}. A diferença é de ${formatMoney(answer)}.`,
    values: { products, difference: answer },
    signature: [[`${first.id}:${firstPrice}`, `${second.id}:${secondPrice}`].sort().join(',')],
    random,
  });
}

export function createShoppingQuestion(family, {
  random = Math.random,
  level = 1,
  variant = 0,
  childName = '',
  salt = 0,
} = {}) {
  const source = randomWithSalt(random, salt);
  if (family === 'money-addition') return createMoneyAddition(source, level, variant);
  if (family === 'price-addition') return createPriceQuestion(source, level, variant, childName);
  if (family === 'remaining') return createRemainingQuestion(source, level, childName);
  if (family === 'missing') return createMissingQuestion(source, level, childName);
  if (family === 'change') return createChangeQuestion(source, level, childName);
  if (family === 'compare') return createComparisonQuestion(source, level, variant);
  throw new RangeError(`Família de exercício desconhecida: ${family}`);
}

export function validateShoppingAnswer(question, answer) {
  if (question?.type !== 'shopping'
    || question.revisionId !== AV2_REVISION_ID
    || question.activityId !== AV2_SHOPPING_ACTIVITY_ID
    || !Array.isArray(question.options)) return false;
  if (question.answerType === 'product') {
    const products = question.values?.products;
    if (question.family !== 'compare' || question.options.length !== 2
      || new Set(question.options.map(({ value }) => value)).size !== 2
      || products?.length !== 2
      || !products.every(({ price }) => Number.isSafeInteger(price) && price >= 0)
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
      && question.answer === expectedAnswer
      && answer === expectedAnswer;
  }
  const values = question.options.map(({ value }) => value);
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)
    || new Set(values).size !== values.length
    || values.filter((value) => value === question.answer).length !== 1) return false;
  let expectedAnswer;
  try {
    if (question.family === 'money-addition') {
      const items = question.values?.items;
      if (!Array.isArray(items) || items.length < 2 || items.length > 3) return false;
      expectedAnswer = addMoney(...items.map(({ value, denomination }) => {
        if (!Number.isSafeInteger(value) || value !== denomination?.value) throw new RangeError();
        return value;
      }));
    } else if (question.family === 'price-addition') {
      const products = question.values?.products;
      if (!Array.isArray(products) || products.length < 1 || products.length > 2) return false;
      expectedAnswer = addMoney(...products.map(({ price }) => price));
    } else if (question.family === 'remaining') {
      if (question.values.available <= question.values.cost) return false;
      expectedAnswer = subtractMoney(question.values.available, question.values.cost);
    } else if (question.family === 'missing') {
      if (question.values.price <= question.values.available) return false;
      expectedAnswer = subtractMoney(question.values.price, question.values.available);
    } else if (question.family === 'change') {
      if (question.values.payment?.value < question.values.product?.price) return false;
      expectedAnswer = subtractMoney(question.values.payment?.value, question.values.product?.price);
    } else if (question.family === 'compare') {
      const products = question.values?.products;
      if (!Array.isArray(products) || products.length !== 2 || products[0].price === products[1].price) return false;
      expectedAnswer = subtractMoney(
        Math.max(...products.map(({ price }) => price)),
        Math.min(...products.map(({ price }) => price)),
      );
    } else return false;
  } catch {
    return false;
  }
  const numericAnswer = typeof answer === 'string' && answer.trim() !== '' ? Number(answer) : answer;
  return Number.isSafeInteger(expectedAnswer)
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
