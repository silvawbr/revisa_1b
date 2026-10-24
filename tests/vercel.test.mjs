import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiHandler, { createVercelHandler } from '../api/tts.js';
import { COLORING_PAGES } from '../src/data/coloringPages.js';
import { build } from '../scripts/build.js';
import { createTtsHandler } from '../server/tts-handler.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

async function runBuild() {
  await build();
}

async function listFiles(directory, prefix = '') {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolutePath, relativePath));
    else files.push(relativePath);
  }
  return files.sort();
}

function responseMock() {
  return {
    destroyed: false,
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
    },
  };
}

function requestMock({ method = 'POST', payload = { text: 'Olá, criança!' } } = {}) {
  const body = JSON.stringify(payload);
  return {
    method,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  };
}

function configuredEnv() {
  return {
    api_url: 'https://openrouter.ai/api/v1/audio/speech',
    api_key: 'server-secret',
    tts_model: 'google/gemini-3.1-flash-tts-preview',
    tts_voice: 'Zephyr',
    tts_response_format: 'pcm',
  };
}

function pcmResponse() {
  return new Response(Buffer.from([0, 0, 1, 0]), {
    status: 200,
    headers: { 'content-type': 'audio/pcm' },
  });
}

test('npm run build gera uma árvore estática publicável', async () => {
  await runBuild();
  for (const relativePath of ['index.html', 'styles.css', 'app.js']) {
    await assert.doesNotReject(fs.access(path.join(dist, relativePath)));
  }
  await assert.doesNotReject(fs.access(path.join(dist, 'src/child-profile.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/money.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/addition.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/subtraction.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/sequences.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/subtraction-layout.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/cdu-layout.js')));
  await assert.doesNotReject(fs.access(path.join(dist, 'src/av2/progress.js')));
  const publicSources = await Promise.all([
    fs.readFile(path.join(dist, 'index.html'), 'utf8'),
    fs.readFile(path.join(dist, 'app.js'), 'utf8'),
    fs.readFile(path.join(dist, 'src/child-profile.js'), 'utf8'),
  ]);
  assert.doesNotMatch(publicSources.join('\n'), /Marina|João|Ana/);
});

test('dist preserva imports relativos e referências às imagens do catálogo', async () => {
  const files = await listFiles(dist);
  const javascriptFiles = files.filter((file) => file.endsWith('.js'));
  const importPattern = /(?:from\s+|import\(\s*)['"](\.[^'"]+)['"]/g;

  for (const relativePath of javascriptFiles) {
    const source = await fs.readFile(path.join(dist, relativePath), 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const importedPath = path.resolve(path.dirname(path.join(dist, relativePath)), match[1]);
      await assert.doesNotReject(fs.access(importedPath), `${relativePath} importa ${match[1]}`);
    }
  }

  const catalog = await import(path.join(dist, 'src/data/coloringPages.js'));
  for (const page of catalog.COLORING_PAGES) {
    const imageUrl = new URL(page.src);
    assert.ok(['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(imageUrl.hostname));
    assert.match(imageUrl.pathname, /\.(?:png|jpe?g|webp)$/i);
  }
  const officialCatalog = await import(path.join(dist, 'src/data/officialColoringPages.js'));
  assert.ok(officialCatalog.OFFICIAL_COLORING_PAGES.length >= 7);
  await assert.doesNotReject(fs.access(path.join(dist, 'src/data/officialColoringPages.js')));
});

test('dist não contém código privado, configurações ou segredos', async () => {
  const files = await listFiles(dist);
  const forbiddenSegments = new Set(['api', 'server', 'tests', 'scripts', 'node_modules']);
  for (const relativePath of files) {
    const segments = relativePath.split(path.sep);
    assert.equal(segments.some((segment) => forbiddenSegments.has(segment)), false, relativePath);
    assert.equal(segments.some((segment) => segment === '.env' || segment.startsWith('.env')), false, relativePath);
    assert.doesNotMatch(relativePath, /(?:\.pem|\.key|\.p12|\.pfx|\.secret|credentials)/i);
    const content = await fs.readFile(path.join(dist, relativePath), 'utf8');
    assert.doesNotMatch(content, /openrouter\.ai|api_key|tts_model|tts_voice|tts_response_format|Bearer\s+sk-or-v1-/i, relativePath);
  }
});

test('o frontend gerado preserva lang pt-BR e chama somente /api/tts', async () => {
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const publicJavaScript = (await Promise.all(
    (await listFiles(dist)).filter((file) => file.endsWith('.js')).map((file) => fs.readFile(path.join(dist, file), 'utf8')),
  )).join('\n');
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(publicJavaScript, /['"]\/api\/tts['"]/);
  assert.doesNotMatch(publicJavaScript, /openrouter\.ai|api_url|api_key/);
});

test('a configuração Vercel usa build/output estáticos sem rewrites legados', async () => {
  const config = JSON.parse(await fs.readFile(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal('builds' in config, false);
  assert.equal('routes' in config, false);
  assert.equal('rewrites' in config, false);
});

test('o entrypoint Vercel rejeita GET com 405 e Allow: POST', async () => {
  const response = responseMock();
  await apiHandler(requestMock({ method: 'GET' }), response);
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, 'POST');
});

test('o entrypoint Vercel usa o handler compartilhado com provedor mockado', async () => {
  const calls = [];
  const handler = createVercelHandler({
    env: configuredEnv(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return pcmResponse();
    },
    logger: () => {},
  });
  const response = responseMock();
  await handler(requestMock(), response);
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'audio/wav');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(Buffer.from(response.body).subarray(0, 4).toString(), 'RIFF');
  assert.equal(Buffer.from(response.body).subarray(8, 12).toString(), 'WAVE');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer server-secret');
});

test('o handler compartilhado não chama o provedor sem configuração', async () => {
  let calls = 0;
  const { handle } = createTtsHandler({
    env: {},
    fetchImpl: async () => {
      calls += 1;
      return pcmResponse();
    },
    logger: () => {},
  });
  const response = responseMock();
  await handle(requestMock(), response);
  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { error: 'A leitura não está disponível agora.' });
  assert.equal(calls, 0);
});
