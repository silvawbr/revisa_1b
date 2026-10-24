const IMAGE_API_URL = 'https://openrouter.ai/api/v1/images';
const MAX_REQUEST_BODY_BYTES = 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PROVIDER_JSON_BYTES = 5 * 1024 * 1024;
const GENERATION_TIMEOUT_MS = 55_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 5;

const THEMES = Object.freeze([
  'a friendly original kitten sitting beside three large flowers',
  'a happy puppy playing with a ball in a simple garden',
  'a small friendly robot watering plants in a garden',
  'a smiling whale swimming among bubbles and a few fish',
  'a cheerful rocket flying past a smiling moon and two stars',
  'a friendly turtle walking beside large leaves and flowers',
  'a small bird sitting on a branch with large leaves',
  'a friendly dinosaur walking among simple plants',
  'a child-friendly castle with a small dragon and clouds',
]);

const STYLE_PROMPT = [
  'Create one original black-and-white coloring-book illustration for a young child.',
  'Use crisp, smooth, solid black outlines on a pure white background.',
  'Leave large enclosed white areas for coloring; use no gray, color, shadows, gradients, hatching or solid black regions except tiny facial details.',
  'Use a few clear, separated objects and a simple uncluttered composition.',
  'Make the drawing print-ready on one A4 portrait page with a generous white margin.',
  'Do not include words, letters, numbers, logos, watermarks, or recognizable copyrighted characters.',
  'Return only the image. Do not use names, photos, or personal information.',
].join(' ');

const requestTimesByClient = new Map();

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function configFromEnv(env) {
  const apiKey = typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.trim()
    ? env.OPENROUTER_API_KEY.trim()
    : typeof env.api_key === 'string' ? env.api_key.trim() : '';
  const model = typeof env.OPENROUTER_IMAGE_MODEL === 'string' ? env.OPENROUTER_IMAGE_MODEL.trim() : '';
  return apiKey && model ? { apiKey, model } : null;
}

function requestClientId(request) {
  const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || request.socket?.remoteAddress || 'unknown';
}

function isRateLimited(clientId, now = Date.now()) {
  for (const [key, times] of requestTimesByClient) {
    const recent = times.filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
    if (recent.length) requestTimesByClient.set(key, recent);
    else requestTimesByClient.delete(key);
  }
  const times = requestTimesByClient.get(clientId) ?? [];
  if (times.length >= RATE_LIMIT_MAX) return true;
  times.push(now);
  requestTimesByClient.set(clientId, times);
  if (requestTimesByClient.size > 2000) requestTimesByClient.delete(requestTimesByClient.keys().next().value);
  return false;
}

async function readRequestBody(request) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) throw new Error('invalid request');
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_REQUEST_BODY_BYTES) throw new Error('invalid request');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readBytes(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('image too large');
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('image too large');
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('image too large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function extractImage(payload) {
  const image = payload?.data?.[0]
    ?? payload?.images?.[0]
    ?? payload?.choices?.[0]?.message?.images?.[0]
    ?? payload?.choices?.[0]?.message?.content?.find?.((part) => part.type === 'image_url')
    ?? payload?.image;
  if (!image) throw new Error('invalid image response');

  const url = typeof image === 'string' ? image : image.url ?? image.image_url?.url ?? image.image_url ?? image.uri;
  const encoded = typeof image === 'object' ? image.b64_json ?? image.base64 ?? image.data : null;
  const declaredType = typeof image === 'object' ? image.mime_type ?? image.mimeType ?? image.media_type : null;
  const dataUrl = typeof url === 'string' ? url.match(/^data:(image\/(?:png|jpeg));base64,([\s\S]+)$/) : null;
  const encodedDataUrl = typeof encoded === 'string' ? encoded.match(/^data:(image\/(?:png|jpeg));base64,([\s\S]+)$/) : null;
  const base64 = dataUrl?.[2] ?? encodedDataUrl?.[2] ?? encoded;
  if (typeof base64 === 'string') {
    const normalized = base64.replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) throw new Error('invalid image data');
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('image too large');
    return { buffer, mimeType: dataUrl?.[1] ?? encodedDataUrl?.[1] ?? declaredType ?? 'image/png' };
  }
  if (typeof url === 'string' && /^https:\/\//i.test(url)) return { url, mimeType: declaredType ?? null };
  throw new Error('invalid image response');
}

function imageDimensions(buffer, mimeType) {
  if (mimeType === 'image/png' && buffer.length >= 24 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }
  throw new Error('invalid image format');
}

function validateImage(buffer, mimeType) {
  if (!['image/png', 'image/jpeg'].includes(mimeType)) throw new Error('invalid image format');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('image too large');
  const { width, height } = imageDimensions(buffer, mimeType);
  const ratio = width / height;
  if (width < 700 || height < 700 || ratio < 0.60 || ratio > 0.82) throw new Error('invalid image dimensions');
}

async function getImage(payload, fetchImpl, signal) {
  const result = extractImage(payload);
  if (result.buffer) return { ...result, mimeType: String(result.mimeType).split(';')[0].toLowerCase() };
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.hostname.endsWith('.local')) {
    throw new Error('invalid image url');
  }
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal });
  if (!response.ok) throw new Error('image download failed');
  const mimeType = String(response.headers.get('content-type') || result.mimeType || '').split(';')[0].toLowerCase();
  const buffer = await readBytes(response, MAX_IMAGE_BYTES);
  return { buffer, mimeType };
}

function requestTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  return { controller, clear: () => clearTimeout(timeout) };
}

export function createColoringHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async function handleColoring(request, response) {
    if (request.method !== 'POST') {
      json(response, 405, { error: 'Método não permitido.' });
      return;
    }
    const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      json(response, 415, { error: 'Envie JSON.' });
      return;
    }
    let body;
    try {
      body = await readRequestBody(request);
      if (JSON.stringify(JSON.parse(body)) !== '{}') throw new Error('invalid request');
    } catch {
      json(response, 400, { error: 'Não foi possível criar o desenho agora. Tente de novo.' });
      return;
    }
    const config = configFromEnv(env);
    if (!config) {
      json(response, 503, { error: 'Este desenho novo não está disponível agora. Escolha um dos desenhos que já estão aqui.' });
      return;
    }
    if (isRateLimited(requestClientId(request))) {
      json(response, 429, { error: 'Espere um pouquinho antes de criar outro desenho.' });
      return;
    }

    const { controller, clear } = requestTimeout();
    try {
      const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
      const generated = await fetchImpl(IMAGE_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/silvawbr/revisa_1b',
          'X-OpenRouter-Title': 'Revisao Matematica Coloring Page',
        },
        body: JSON.stringify({
          model: config.model,
          prompt: `${STYLE_PROMPT} Theme: ${theme}`,
          n: 1,
          size: '1024x1536',
        }),
        signal: controller.signal,
      });
      if (!generated.ok) {
        json(response, generated.status === 429 ? 429 : 502, {
          error: generated.status === 429 ? 'A criação de desenhos está ocupada. Tente mais tarde.' : 'Não foi possível criar o desenho agora. Tente de novo.',
        });
        return;
      }
      const providerBytes = await readBytes(generated, MAX_PROVIDER_JSON_BYTES);
      const payload = JSON.parse(providerBytes.toString('utf8'));
      const image = await getImage(payload, fetchImpl, controller.signal);
      validateImage(image.buffer, image.mimeType);
      json(response, 200, { image: `data:${image.mimeType};base64,${image.buffer.toString('base64')}` });
    } catch {
      const timedOut = controller.signal.aborted;
      json(response, timedOut ? 504 : 502, {
        error: timedOut ? 'O desenho está demorando. Tente de novo.' : 'Não foi possível criar um desenho válido agora. Tente de novo.',
      });
    } finally {
      clear();
    }
  };
}
