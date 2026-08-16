import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.js';
import {
  COLORING_PAGES,
  REWARD_MESSAGE,
  isLocalColoringPage,
  pickColoringPage,
} from '../src/data/coloringPages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = await fs.readFile(path.join(root, 'app.js'), 'utf8');
const cssSource = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
const attributions = await fs.readFile(path.join(root, 'public/coloring-pages/ATTRIBUTIONS.md'), 'utf8');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('o catálogo tem de quatro a oito desenhos locais', async () => {
  assert.ok(COLORING_PAGES.length >= 4 && COLORING_PAGES.length <= 8);
  for (const page of COLORING_PAGES) {
    assert.equal(isLocalColoringPage(page), true);
    assert.equal(/^https?:\/\//i.test(page.src), false);
    await assert.doesNotReject(fs.access(path.join(root, page.src.replace(/^\//, ''))));
  }
});

test('cada desenho tem origem, licença e registro correspondente', () => {
  for (const page of COLORING_PAGES) {
    assert.ok(page.title);
    assert.ok(page.author);
    assert.match(page.sourceUrl, /^https?:\/\//);
    assert.match(page.sourceFileUrl, /^https?:\/\//);
    assert.ok(page.license);
    assert.match(page.licenseUrl, /^https?:\/\//);
    assert.match(attributions, new RegExp(`## ${page.src.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    if (page.attributionRequired) {
      assert.match(attributions, new RegExp(`${page.author}`));
      assert.match(attributions, new RegExp(`${page.license.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
  }
});

test('o servidor entrega o catálogo e os quatro SVGs localmente', async () => {
  const server = createServer({ env: {}, fetchImpl: async () => new Response('audio', { status: 200, headers: { 'content-type': 'audio/wav' } }) });
  const base = await listen(server);
  try {
    for (const page of COLORING_PAGES) {
      const response = await fetch(`${base}${page.src}`);
      assert.equal(response.status, 200, page.src);
      assert.equal(response.headers.get('content-type'), 'image/svg+xml');
    }
    const manifestResponse = await fetch(`${base}/src/data/coloringPages.js`);
    assert.equal(manifestResponse.status, 200);
    const profileResponse = await fetch(`${base}/src/child-profile.js`);
    assert.equal(profileResponse.status, 200);
    const attributionResponse = await fetch(`${base}/public/coloring-pages/ATTRIBUTIONS.md`);
    assert.equal(attributionResponse.status, 200);
  } finally {
    await close(server);
  }
});

test('a seleção evita repetição imediata e continua aleatória', () => {
  const first = pickColoringPage({ random: () => 0 });
  const second = pickColoringPage({ excludeId: first.id, random: () => 0 });
  assert.notEqual(first.id, second.id);

  const selectedIds = new Set(Array.from({ length: COLORING_PAGES.length }, (_, index) => (
    pickColoringPage({ random: () => (index + 0.5) / COLORING_PAGES.length }).id
  )));
  assert.ok(selectedIds.size > 1);
});

test('a seleção pula assets indisponíveis e usa outro item válido', () => {
  const first = COLORING_PAGES[0];
  const second = COLORING_PAGES[1];
  const next = pickColoringPage({
    excludeId: first.id,
    unavailableIds: new Set([second.id]),
    random: () => 0,
  });
  assert.ok(next);
  assert.notEqual(next.id, first.id);
  assert.notEqual(next.id, second.id);
});

test('a recompensa expõe mensagem, outro desenho, fallback e impressão sem internet', () => {
  assert.equal(REWARD_MESSAGE, 'Você terminou a revisão! Parabéns, {name}! Escolha suas cores e divirta-se! 🎉');
  assert.match(appSource, /<h1 id="reward-title">\$\{escapeHtml\(rewardMessage\.visualText\)\}<\/h1>/);
  assert.match(appSource, /data-action="another-coloring-page"/);
  assert.match(appSource, /data-coloring-image/);
  assert.match(appSource, /handleColoringAssetError/);
  assert.match(appSource, /renderOriginalColoringSheet/);
  assert.doesNotMatch(appSource, /images\.google|google\.com\/images/i);
  assert.match(cssSource, /body \* \{ visibility: hidden !important; \}/);
  assert.match(cssSource, /\.print-sheet,\s*\.print-sheet \* \{ visibility: visible !important; \}/);
  assert.match(cssSource, /\.reward-card > \*:not\(.print-sheet\) \{ display: none !important; \}/);
});

test('os assets são SVGs verticais, autossuficientes e adequados ao A4', async () => {
  for (const page of COLORING_PAGES) {
    assert.equal(page.orientation, 'portrait');
    const source = await fs.readFile(path.join(root, page.src.replace(/^\//, '')), 'utf8');
    const viewBox = source.match(/viewBox=["']\s*([\d.e+-]+)[ ,]+([\d.e+-]+)[ ,]+([\d.e+-]+)[ ,]+([\d.e+-]+)\s*["']/i);
    assert.ok(viewBox, `${page.id} precisa de viewBox`);
    assert.ok(Number(viewBox[3]) < Number(viewBox[4]), `${page.id} precisa ser vertical`);
    assert.doesNotMatch(source, /<image\b|<text\b|foreignObject|pinterest|watermark|disney|pixar|mickey/i);
    assert.doesNotMatch(source, /(?:href|xlink:href)=["']https?:/i);
  }
  assert.match(cssSource, /@page \{ size: A4 portrait; margin: 10mm; \}/);
  assert.match(cssSource, /max-width: 100%;[\s\S]*max-height: calc\(100% - 8mm\)/);
  assert.match(cssSource, /object-fit: contain/);
  assert.match(cssSource, /width: auto;[\s\S]*height: auto/);
});
