import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../server.js';
import {
  COLORING_PAGE_HISTORY_KEY,
  COLORING_PAGES,
  LOCAL_COLORING_PAGE_HISTORY_LIMIT,
  REWARD_MESSAGE,
  createRecentIdStore,
  isDisplayableColoringPage,
  pickColoringPage,
} from '../src/data/coloringPages.js';
import {
  OFFICIAL_COLORING_PAGE_HISTORY_KEY,
  OFFICIAL_COLORING_PAGE_HISTORY_LIMIT,
  OFFICIAL_COLORING_PAGES,
  pickOfficialColoringPage,
} from '../src/data/officialColoringPages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = await fs.readFile(path.join(root, 'app.js'), 'utf8');
const cssSource = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
const attributions = await fs.readFile(path.join(root, 'public/coloring-pages/ATTRIBUTIONS.md'), 'utf8');

class StaticResponse extends Writable {
  constructor() {
    super();
    this.chunks = [];
  }

  writeHead(status, headers) {
    this.status = status;
    this.headers = headers;
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  get body() { return Buffer.concat(this.chunks); }
}

async function requestStatic(url, method = 'GET') {
  const response = new StaticResponse();
  const finished = once(response, 'finish');
  await serveStatic({ method, url }, response);
  await finished;
  return response;
}

test('o catálogo ativo tem páginas de colorir em imagem raster e IDs únicos', () => {
  assert.ok(COLORING_PAGES.length >= 8);
  assert.equal(new Set(COLORING_PAGES.map((page) => page.id)).size, COLORING_PAGES.length);
  assert.equal(new Set(COLORING_PAGES.map((page) => page.src)).size, COLORING_PAGES.length);
  for (const page of COLORING_PAGES) {
    assert.equal(isDisplayableColoringPage(page), true);
    const imageUrl = new URL(page.src);
    assert.ok(['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(imageUrl.hostname));
    assert.match(imageUrl.pathname, /\.(?:png|jpe?g|webp)$/i);
  }
});

test('cada desenho tem origem, licença e registro correspondente', () => {
  for (const page of COLORING_PAGES) {
    assert.ok(page.title);
    assert.ok(page.alt);
    assert.ok(page.author);
    assert.match(page.sourceUrl, /^https?:\/\//);
    assert.match(page.sourceFileUrl, /^https?:\/\//);
    assert.ok(page.license);
    assert.match(page.licenseUrl, /^https?:\/\//);
    const fileName = new URL(page.sourceFileUrl).pathname.split('/').pop();
    assert.match(attributions, new RegExp(`## ${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    if (page.attributionRequired) {
      assert.match(attributions, new RegExp(`${page.author}`));
      assert.match(attributions, new RegExp(`${page.license.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
  }
});

test('o servidor entrega os módulos do catálogo; as imagens vêm do Wikimedia Commons', async () => {
  for (const page of COLORING_PAGES) {
    assert.equal(isDisplayableColoringPage(page), true);
  }
  for (const sourcePath of [
    '/src/data/coloringPages.js',
    '/src/data/searchColoringPages.js',
    '/src/data/officialColoringPages.js',
    '/src/child-profile.js',
    '/src/av2/money.js',
    '/src/av2/progress.js',
    '/public/coloring-pages/ATTRIBUTIONS.md',
  ]) {
    const response = await requestStatic(sourcePath);
    assert.equal(response.status, 200, sourcePath);
  }
  assert.equal((await requestStatic('/src/av2/money.js')).headers['Content-Type'], 'text/javascript; charset=utf-8');
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

test('a seleção local evita os cinco IDs recentes quando há alternativas', () => {
  const recentIds = COLORING_PAGES.slice(0, 5).map((page) => page.id);
  const selected = pickColoringPage({ recentIds, random: () => 0 });
  assert.equal(recentIds.includes(selected.id), false);

  const current = selected;
  const next = pickColoringPage({
    excludeId: current.id,
    recentIds: [current.id],
    random: () => 0,
  });
  assert.notEqual(next.id, current.id);
});

test('o histórico local persiste somente IDs e cai para memória se o storage falhar', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createRecentIdStore({ key: COLORING_PAGE_HISTORY_KEY, limit: LOCAL_COLORING_PAGE_HISTORY_LIMIT, storage });
  store.remember('cat-line-art');
  store.remember('owl-line-art');
  assert.deepEqual(JSON.parse(values.get(COLORING_PAGE_HISTORY_KEY)), ['owl-line-art', 'cat-line-art']);
  assert.deepEqual(createRecentIdStore({ key: COLORING_PAGE_HISTORY_KEY, limit: LOCAL_COLORING_PAGE_HISTORY_LIMIT, storage }).get(), ['owl-line-art', 'cat-line-art']);

  const brokenStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const memoryStore = createRecentIdStore({ key: COLORING_PAGE_HISTORY_KEY, limit: LOCAL_COLORING_PAGE_HISTORY_LIMIT, storage: brokenStorage });
  memoryStore.remember('bunny-outline');
  assert.deepEqual(memoryStore.get(), ['bunny-outline']);
});

test('o catálogo oficial é separado, HTTPS, oficial e não leva dados pessoais', () => {
  const allowedHosts = new Set(['books.disney.com', 'news.disney.com', 'www.legoland.com', 'www.pbs.org', 'www.crayola.com']);
  assert.ok(OFFICIAL_COLORING_PAGES.length >= 7);
  for (const page of OFFICIAL_COLORING_PAGES) {
    const url = new URL(page.url);
    const sourcePage = new URL(page.sourcePage);
    assert.equal(page.external, true);
    assert.equal(url.protocol, 'https:');
    assert.equal(sourcePage.protocol, 'https:');
    assert.equal(allowedHosts.has(url.hostname), true, page.url);
    assert.equal(allowedHosts.has(sourcePage.hostname), true, page.sourcePage);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal('src' in page, false);
    assert.doesNotMatch(page.url, /name|child|criança|nome|tracking|utm_/i);
  }
  assert.equal(OFFICIAL_COLORING_PAGE_HISTORY_KEY, 'revisao-matematica.officialColoringPages.v1');
  assert.equal(OFFICIAL_COLORING_PAGE_HISTORY_LIMIT, 3);
});

test('o sorteio oficial evita o último destino e o histórico recente', () => {
  const recentIds = OFFICIAL_COLORING_PAGES.slice(0, 3).map((page) => page.id);
  const selected = pickOfficialColoringPage({ recentIds, random: () => 0 });
  assert.equal(recentIds.includes(selected.id), false);
  const next = pickOfficialColoringPage({ excludeId: selected.id, recentIds: [selected.id], random: () => 0 });
  assert.notEqual(next.id, selected.id);
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

test('a recompensa expõe imagem externa, outro desenho, fallback e impressão', () => {
  assert.equal(REWARD_MESSAGE, 'Você terminou a revisão! Parabéns, {name}! Escolha suas cores e divirta-se! 🎉');
  assert.match(appSource, /<h1 id="reward-title">\$\{escapeHtml\(rewardMessage\.visualText\)\}<\/h1>/);
  assert.match(appSource, /data-action="another-coloring-page"/);
  assert.match(appSource, /data-coloring-image/);
  assert.match(appSource, /handleColoringAssetError/);
  assert.doesNotMatch(appSource, /renderOriginalColoringSheet|coloring-svg/);
  assert.match(appSource, /Não foi possível carregar o desenho/);
  assert.match(appSource, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(appSource, /images\.google|google\.com\/images/i);
  assert.match(cssSource, /body \* \{ visibility: hidden !important; \}/);
  assert.match(cssSource, /\.print-sheet,\s*\.print-sheet \* \{ visibility: visible !important; \}/);
  assert.match(cssSource, /\.reward-card > \*:not\(.print-sheet\) \{ display: none !important; \}/);
});

test('as imagens raster têm orientação de impressão A4', () => {
  for (const page of COLORING_PAGES) {
    assert.match(page.orientation, /^(portrait|landscape)$/);
    assert.equal(isDisplayableColoringPage(page), true);
    assert.ok(page.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  }
  assert.match(cssSource, /@page \{ size: A4 portrait; margin: 10mm; \}/);
  assert.match(cssSource, /@page coloring-landscape \{ size: A4 landscape; margin: 10mm; \}/);
  assert.match(cssSource, /\.print-sheet\[data-orientation="landscape"\] \{ page: coloring-landscape; \}/);
  assert.match(cssSource, /max-width: 100%;[\s\S]*max-height: calc\(100% - 8mm\)/);
  assert.match(cssSource, /object-fit: contain/);
  assert.match(cssSource, /width: auto;[\s\S]*height: auto/);
});

test('a opção externa só abre após clique, em nova aba segura, e oferece fallback acessível', () => {
  assert.match(appSource, /data-action="open-official-coloring"/);
  assert.match(appSource, /window\.open\(page\.url, '_blank', 'noopener,noreferrer'\)/);
  assert.match(appSource, /officialOpenFailure/);
  assert.match(appSource, /Toque aqui para acessar o desenho oficial/);
  assert.match(appSource, /action === 'open-official-coloring'/);
  assert.doesNotMatch(appSource, /openOfficialColoringPage\(\)\s*;[\s\S]{0,80}setTimeout/);
  assert.match(cssSource, /\.official-reward-option/);
  assert.match(cssSource, /\.official-reward-option,\s*\.official-open-message \{ display: none !important; \}/);
});

test('os assets externos não foram copiados para o catálogo local', async () => {
  const files = await fs.readdir(path.join(root, 'public/coloring-pages'));
  assert.equal(files.some((file) => /disney|pixar|bluey|lego|pbs|daniel/i.test(file)), false);
  assert.equal(files.some((file) => file.endsWith('.jpg') || file.endsWith('.pdf') || file.endsWith('.png')), false);
});
