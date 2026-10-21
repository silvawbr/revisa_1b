import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TtsProvider } from './server/tts-provider.js';
import { handleTts } from './server/tts-handler.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
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
  'src/association-interaction.js',
  'src/tts-client.js',
  'src/child-profile.js',
  'src/data/coloringPages.js',
  'src/data/officialColoringPages.js',
  'src/av2/money.js',
  'src/av2/progress.js',
  'public/currency/ATTRIBUTIONS.md',
  'public/coloring-pages/ATTRIBUTIONS.md',
  'public/coloring-pages/animals-bunny-02.svg',
  'public/coloring-pages/kitten-telescope-07.svg',
  'public/coloring-pages/school-bear-03.svg',
  'public/coloring-pages/student-writing-02.svg',
]);

function isPublicFile(relativePath) {
  return PUBLIC_FILES.has(relativePath)
    || /^public\/coloring-pages\/[^/]+\.svg$/.test(relativePath);
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
  if (!relativePath || !isPublicFile(relativePath)) {
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

export { handleTts } from './server/tts-handler.js';

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
