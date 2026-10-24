import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.js';
import {
  AV2_PRODUCT_ILLUSTRATIONS,
  getAv2ProductIllustration,
  getAv2ProductIllustrationId,
} from '../src/av2/product-illustrations.js';
import { createAv2ShoppingRound, validateAv2Answer } from '../src/av2/money.js';
import { numberToPortuguese } from '../src/game.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

test('o catálogo contém identificadores únicos e ilustrações SVG locais para os produtos do módulo', async () => {
  const ids = AV2_PRODUCT_ILLUSTRATIONS.map(({ id }) => id);
  assert.equal(ids.length, 21, 'o catálogo cobre materiais escolares e os brinquedos da revisão oficial');
  assert.equal(new Set(ids).size, ids.length, 'não há identificadores duplicados');

  const expected = new Map([
    ['Caderno', 'notebook'], ['Livro', 'book'], ['Lápis', 'pencil'], ['Cola', 'glue'],
    ['Tesoura', 'scissors'], ['Borracha', 'eraser'], ['Régua', 'ruler'], ['Giz de cera', 'crayon'],
    ['Boneca', 'doll'], ['Carrinho', 'toy-car'], ['Bola', 'ball'], ['Urso', 'teddy-bear'],
    ['Jogo', 'board-game'], ['Brinquedo', 'toy'], ['Suco', 'juice'], ['Sanduíche', 'sandwich'],
    ['Pipoca', 'popcorn'], ['Chiclete', 'gum'], ['Caminhão', 'truck'],
    ['Blocos', 'building-blocks'], ['Dinossauro', 'dinosaur'],
  ]);
  for (const [label, id] of expected) assert.equal(getAv2ProductIllustrationId(label), id, label);

  for (const item of AV2_PRODUCT_ILLUSTRATIONS) {
    assert.match(item.src, /^\/public\/av2-products\/[a-z-]+\.svg$/);
    const file = path.join(root, item.src.slice(1));
    const svg = await fs.readFile(file, 'utf8');
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<title>[^<]+<\/title>/);
    assert.equal(getAv2ProductIllustration(item.id), item);
  }
});

test('todos os geradores de compras usam ilustração por tipo estável de produto', () => {
  for (let seed = 1; seed <= 80; seed += 1) {
    const round = createAv2ShoppingRound(seededRandom(seed));
    assert.equal(round.length, 10);
    for (const question of round) {
      for (const product of question.data.products ?? []) {
        assert.ok(getAv2ProductIllustration(product.illustrationId), `${question.questionId}: ${product.label}`);
        assert.equal(product.illustrationId, getAv2ProductIllustrationId(product.label));
        assert.equal(Number.isInteger(product.priceReais), true);
      }
    }
  }
});

test('os cartões mantêm destaque individual e grades responsivas para vários produtos', async () => {
  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  assert.match(styles, /\.av2-exercise-area\.is-shopping-question \{ min-height: 0;/);
  assert.ok(styles.includes('.av2-products[data-product-count="1"] { grid-template-columns: minmax(0, 270px); justify-content: center; }'));
  assert.ok(styles.includes('.av2-products[data-product-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }'));
  assert.ok(styles.includes('.av2-products[data-product-count="3"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }'));
  assert.ok(styles.includes('.av2-products[data-product-count="3"] > :last-child:nth-child(odd)'));
});

test('os novos exercícios do Simulado têm controles grandes e layouts responsivos sem arrastar', async () => {
  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  assert.match(styles, /\.simulado-pairing-columns \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.simulado-match-group \{[^}]*min-height: 94px/);
  assert.match(styles, /\.simulado-answer-entry input \{[^}]*min-height: 58px/);
  assert.match(styles, /\.simulado-number-table \{[^}]*width: min\(100%, 760px\)/);
  assert.match(styles, /\.simulado-product-board \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.simulado-pairing-columns \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles, /\.simulado-product-board \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(styles, /\.simulado-(?:match|pairing)[^{]*\{[^}]*drag/i);
});

test('somas, troco e alternativas preservam nomes, preços, seleção e fala com os dados necessários', () => {
  const questions = createAv2ShoppingRound(seededRandom(1));
  const availableTotal = questions.find(({ questionId }) => questionId === 'shopping-total-24-oficial');
  assert.ok(availableTotal);
  assert.match(availableTotal.speech, /cédula de cinco reais/i);
  assert.match(availableTotal.speech, /cédula de dois reais/i);
  assert.doesNotMatch(availableTotal.speech, /vinte e quatro reais/);

  const twoItemSum = questions.find(({ questionId }) => questionId === 'shopping-products-10-7-oficial');
  assert.ok(twoItemSum);
  assert.deepEqual(twoItemSum.data.selectedProductIds, ['caderno-10', 'cola-7']);
  assert.deepEqual(twoItemSum.data.products.map(({ label, priceReais }) => [label, priceReais]), [
    ['Caderno', 10], ['Cola', 7], ['Tesoura', 4],
  ]);
  assert.match(twoItemSum.prompt, /caderno.*cola/i);
  assert.match(twoItemSum.speech, /Caderno custa dez reais/i);
  assert.match(twoItemSum.speech, /Cola custa sete reais/i);
  assert.doesNotMatch(twoItemSum.speech, /Tesoura|dezessete/);
  assert.equal(validateAv2Answer(twoItemSum, 17), true);
  assert.equal(validateAv2Answer(twoItemSum, 16), false);

  const threeItemSum = questions.find(({ questionId }) => questionId === 'shopping-products-3-2-4-oficial');
  assert.ok(threeItemSum);
  assert.deepEqual(threeItemSum.data.selectedProductIds, ['borracha-3', 'lapis-2', 'tesoura-4']);
  for (const phrase of ['Borracha custa três reais', 'Lápis custa dois reais', 'Tesoura custa quatro reais']) {
    assert.match(threeItemSum.speech, new RegExp(phrase, 'i'));
  }
  assert.doesNotMatch(threeItemSum.speech, /nove reais/);

  const change = questions.find(({ questionId }) => questionId === 'shopping-change-change-22-14');
  assert.ok(change);
  assert.equal(change.data.availableReais, 22);
  assert.equal(change.data.products.find(({ id }) => id === change.data.purchaseProductId).label, 'Boneca');
  assert.match(change.speech, /vinte e dois reais/);
  assert.match(change.speech, /Boneca custa quatorze reais/i);
  assert.doesNotMatch(change.speech, /Carrinho|oito reais/);
  assert.equal(validateAv2Answer(change, 8), true);
  assert.equal(validateAv2Answer(change, 7), false);

  const affordability = questions.find(({ questionId }) => questionId === 'shopping-afford-24-oficial');
  assert.ok(affordability);
  for (const product of affordability.data.products) {
    assert.ok(affordability.speech.toLocaleLowerCase('pt-BR').includes(product.label.toLocaleLowerCase('pt-BR')));
    assert.ok(affordability.speech.includes(`${numberToPortuguese(product.priceReais)} reais`));
  }
  assert.ok(affordability.options.every((id) => affordability.data.products.some((product) => product.id === id)));
  assert.equal(validateAv2Answer(affordability, affordability.correctAnswers), true);
});

test('o build estático copia todas as ilustrações para dist', async () => {
  await build();
  for (const item of AV2_PRODUCT_ILLUSTRATIONS) {
    const output = path.join(root, 'dist', item.src.slice(1));
    const file = await fs.stat(output);
    assert.equal(file.isFile(), true, `${item.id} foi incluída no build`);
  }
});
