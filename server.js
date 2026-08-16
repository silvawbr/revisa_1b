import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  TtsProvider,
  TtsProviderError,
  normalizeTtsText,
} from './server/tts-provider.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const PUBLIC_FILES = new Set([
  'index.html',
  'styles.css',
  'app.js',
  'src/game.js',
  'src/figures.js',
  'src/tts-client.js',
  'src/data/coloringPages.js',
  'public/coloring-pages/ATTRIBUTIONS.md',
  'public/coloring-pages/animals-bunny-02.svg',
  'public/coloring-pages/kitten-telescope-07.svg',
  'public/coloring-pages/school-bear-03.svg',
  'public/coloring-pages/student-writing-02.svg',
]);

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
}

function safeErrorResponse(response, status = 503, message = 'A leitura não está disponível agora.') {
  sendJson(response, status, { error: message });
}

function safeRequestError(response, status, message = 'Texto inválido.') {
  sendJson(response, status, { error: message });
}

async function readRequestBody(request) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw Object.assign(new Error('request too large'), { status: 413 });
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_REQUEST_BODY_BYTES) throw Object.assign(new Error('request too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseTtsRequest(body) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('invalid payload'), { status: 400 });
  }
  const allowedKeys = new Set(['text']);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) {
    throw Object.assign(new Error('unsupported field'), { status: 400 });
  }
  let text;
  try {
    text = normalizeTtsText(payload.text);
  } catch (error) {
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return { text };
}

function providerErrorStatus(error) {
  if (!(error instanceof TtsProviderError)) return 502;
  if (error.code === 'INVALID_INPUT') return 400;
  if (error.code === 'MISSING_CONFIG' || error.code === 'PARTIAL_CONFIG' || error.code === 'INVALID_CONFIG') return 503;
  if (error.code === 'QUOTA_EXCEEDED') return 429;
  return 502;
}

function logProviderResult(logger, { requestId, startedAt, error = null, providerStatus = null }) {
  logger(JSON.stringify({
    requestId,
    category: error?.code ?? 'SUCCESS',
    providerStatus,
    durationMs: Date.now() - startedAt,
  }));
}

export async function handleTts(request, response, provider, logger = () => {}) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' }, { Allow: 'POST' });
    return;
  }
  const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    sendJson(response, 415, { error: 'Envie JSON.' });
    return;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  let input;
  try {
    input = parseTtsRequest(await readRequestBody(request));
  } catch (error) {
    safeRequestError(response, error.status ?? 400, 'Texto inválido.');
    return;
  }

  try {
    const result = await provider.generate(input);
    logProviderResult(logger, { requestId, startedAt });
    if (response.destroyed) return;
    response.writeHead(200, {
      'Content-Type': result.contentType,
      'Content-Length': result.audio.byteLength,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(Buffer.from(result.audio));
  } catch (error) {
    logProviderResult(logger, {
      requestId,
      startedAt,
      error,
      providerStatus: error instanceof TtsProviderError ? error.providerStatus : null,
    });
    if (!response.destroyed) safeErrorResponse(response, providerErrorStatus(error));
  }
}

function safeStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);
  return filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`) ? filePath : null;
}

export async function serveStatic(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const filePath = safeStaticPath(pathname);
  const relativePath = filePath ? path.relative(ROOT, filePath) : null;
  if (!relativePath || !PUBLIC_FILES.has(relativePath)) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

export function createServer({ env = process.env, fetchImpl = globalThis.fetch, logger = console.info } = {}) {
  const provider = new TtsProvider({ env, fetchImpl });
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/tts') {
      await handleTts(request, response, provider, logger);
      return;
    }
    await serveStatic(request, response);
  });
  server.ttsProvider = provider;
  return server;
}

function loadDotEnv(filePath = path.join(ROOT, '.env')) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

export function startServer({ port = Number(process.env.PORT) || 4173, host = '127.0.0.1' } = {}) {
  loadDotEnv();
  const server = createServer();
  if (!server.ttsProvider.configured) {
    const missing = server.ttsProvider.missingVariables;
    if (missing.length > 0) {
      for (const variable of missing) console.warn(`TTS indisponível: variável ausente ${variable}.`);
    } else {
      console.warn(`TTS indisponível: configuração inválida (${server.ttsProvider.configurationReason}).`);
    }
  }
  server.listen(port, host, () => console.info(`Aplicação disponível em http://${host}:${port}`));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
