import { randomUUID } from 'node:crypto';
import {
  TtsProvider,
  TtsProviderError,
  normalizeTtsText,
} from './tts-provider.js';

const MAX_REQUEST_BODY_BYTES = 32 * 1024;

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

export function createTtsHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = () => {},
} = {}) {
  const provider = new TtsProvider({ env, fetchImpl });
  return {
    provider,
    handle(request, response) {
      return handleTts(request, response, provider, logger);
    },
  };
}
