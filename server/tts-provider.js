import { createHash } from 'node:crypto';
import { DEFAULT_WAV_OPTIONS, pcmToWav } from './pcm-to-wav.js';

export const TTS_CONFIG_VERSION = 'openrouter-gemini-pcm-wav-v2';
export const TTS_STYLE_VERSION = 'pt-br-child-friendly-v1';
export const MAX_TTS_TEXT_LENGTH = 500;
export const MAX_TTS_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_TTS_CACHE_ENTRIES = 100;
export const TTS_TIMEOUT_MS = 15_000;

const REQUIRED_TTS_VARIABLES = ['api_url', 'api_key', 'tts_model', 'tts_voice', 'tts_response_format'];
const AUDIO_FORMATS = Object.freeze({
  mp3: Object.freeze({
    outputContentType: 'audio/mpeg',
    providerContentTypes: new Set(['audio/mpeg']),
    accept: 'audio/mpeg',
  }),
  wav: Object.freeze({
    outputContentType: 'audio/wav',
    providerContentTypes: new Set(['audio/wav']),
    accept: 'audio/wav',
  }),
  ogg: Object.freeze({
    outputContentType: 'audio/ogg',
    providerContentTypes: new Set(['audio/ogg']),
    accept: 'audio/ogg',
  }),
  pcm: Object.freeze({
    outputContentType: 'audio/wav',
    providerContentTypes: new Set(['audio/pcm', 'audio/raw', 'audio/l16', 'application/octet-stream']),
    accept: 'audio/pcm',
    wav: DEFAULT_WAV_OPTIONS,
  }),
});

export class TtsProviderError extends Error {
  constructor(code, message, { providerStatus = null, cause = undefined } = {}) {
    super(message, { cause });
    this.name = 'TtsProviderError';
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

export function normalizeTtsText(value) {
  if (typeof value !== 'string') throw new TtsProviderError('INVALID_INPUT', 'O texto deve ser uma string.');
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) throw new TtsProviderError('INVALID_INPUT', 'O texto não pode ficar vazio.');
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    throw new TtsProviderError('INVALID_INPUT', `O texto deve ter no máximo ${MAX_TTS_TEXT_LENGTH} caracteres.`);
  }
  return text;
}

export function getTtsCacheKey(
  text,
  {
    model = '',
    voice = '',
    responseFormat = '',
    deliveredFormat = responseFormat === 'pcm' ? 'audio/wav' : responseFormat,
    sampleRate = DEFAULT_WAV_OPTIONS.sampleRate,
    bitsPerSample = DEFAULT_WAV_OPTIONS.bitsPerSample,
    channels = DEFAULT_WAV_OPTIONS.channels,
    styleVersion = TTS_STYLE_VERSION,
    configVersion = TTS_CONFIG_VERSION,
  } = {},
) {
  const normalizedText = normalizeTtsText(text);
  const material = JSON.stringify({
    bitsPerSample,
    channels,
    configVersion,
    deliveredFormat,
    model,
    responseFormat,
    sampleRate,
    styleVersion,
    text: normalizedText,
    voice,
  });
  return createHash('sha256').update(material).digest('hex');
}

function readEnvironmentValue(env, name) {
  return typeof env[name] === 'string' ? env[name].trim() : '';
}

export function readTtsConfig(env = process.env, { configVersion = TTS_CONFIG_VERSION } = {}) {
  const values = Object.fromEntries(REQUIRED_TTS_VARIABLES.map((name) => [name, readEnvironmentValue(env, name)]));
  const missingVariables = REQUIRED_TTS_VARIABLES.filter((name) => !values[name]);
  const reason = missingVariables.length === REQUIRED_TTS_VARIABLES.length
    ? 'MISSING_CONFIG'
    : missingVariables.length > 0
      ? 'PARTIAL_CONFIG'
      : null;

  if (reason) {
    return {
      configured: false,
      reason,
      missingVariables,
      apiUrl: '',
      apiKey: '',
      model: values.tts_model,
      voice: values.tts_voice,
      responseFormat: values.tts_response_format,
      contentType: null,
      providerContentType: null,
      configVersion,
    };
  }

  let apiUrl;
  try {
    const parsedUrl = new URL(values.api_url);
    if (parsedUrl.protocol !== 'https:') throw new Error('URL não é HTTPS.');
    apiUrl = parsedUrl.toString();
  } catch {
    return {
      configured: false,
      reason: 'INVALID_CONFIG',
      missingVariables: [],
      apiUrl: '',
      apiKey: '',
      model: values.tts_model,
      voice: values.tts_voice,
      responseFormat: values.tts_response_format,
      contentType: null,
      providerContentType: null,
      configVersion,
    };
  }

  const audioFormat = AUDIO_FORMATS[values.tts_response_format];
  if (!audioFormat) {
    return {
      configured: false,
      reason: 'INVALID_CONFIG',
      missingVariables: [],
      apiUrl: '',
      apiKey: '',
      model: values.tts_model,
      voice: values.tts_voice,
      responseFormat: values.tts_response_format,
      contentType: null,
      providerContentType: null,
      configVersion,
    };
  }

  return {
    configured: true,
    reason: null,
    missingVariables: [],
    apiUrl,
    apiKey: values.api_key,
    model: values.tts_model,
    voice: values.tts_voice,
    responseFormat: values.tts_response_format,
    contentType: audioFormat.outputContentType,
    providerContentType: audioFormat.accept,
    configVersion,
  };
}

function contentTypeWithoutParameters(value) {
  return String(value ?? '').split(';', 1)[0].trim().toLowerCase();
}

function safeProviderContentType(value, responseFormat) {
  const contentType = contentTypeWithoutParameters(value);
  if (!contentType) return responseFormat === 'pcm' ? 'audio/pcm' : null;
  const audioFormat = AUDIO_FORMATS[responseFormat];
  return audioFormat?.providerContentTypes.has(contentType) ? contentType : null;
}

async function readResponseBytes(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new TtsProviderError('RESPONSE_TOO_LARGE', 'A resposta de áudio excedeu o limite.');
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new TtsProviderError('RESPONSE_TOO_LARGE', 'A resposta de áudio excedeu o limite.');
    return bytes;
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
        throw new TtsProviderError('RESPONSE_TOO_LARGE', 'A resposta de áudio excedeu o limite.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function extractAudio(response, { responseFormat, contentType, maxBytes }) {
  const rawContentType = contentTypeWithoutParameters(response.headers.get('content-type'));
  const providerContentType = safeProviderContentType(rawContentType, responseFormat);
  if (rawContentType === 'application/json' || !providerContentType) {
    throw new TtsProviderError('INVALID_AUDIO_RESPONSE', 'O provedor não retornou o formato de áudio esperado.');
  }

  const audio = await readResponseBytes(response, maxBytes);
  if (!audio.byteLength) throw new TtsProviderError('NO_AUDIO', 'A resposta não contém áudio.');
  if (responseFormat === 'pcm') {
    try {
      return { audio: pcmToWav(audio, DEFAULT_WAV_OPTIONS), contentType };
    } catch (error) {
      throw new TtsProviderError('INVALID_AUDIO_RESPONSE', 'O PCM retornado pelo provedor é inválido.', { cause: error });
    }
  }
  return { audio, contentType };
}

function classifyFetchError(error, timedOut) {
  if (timedOut || error?.name === 'AbortError') {
    return new TtsProviderError('TIMEOUT', 'A chamada ao provedor expirou.', { cause: error });
  }
  return new TtsProviderError('TEMPORARY_PROVIDER_ERROR', 'Não foi possível acessar o provedor.', { cause: error });
}

export class TtsProvider {
  constructor({
    env = process.env,
    fetchImpl = globalThis.fetch,
    timeoutMs = TTS_TIMEOUT_MS,
    maxResponseBytes = MAX_TTS_RESPONSE_BYTES,
    maxCacheEntries = MAX_TTS_CACHE_ENTRIES,
    configVersion = TTS_CONFIG_VERSION,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl deve ser uma função.');
    this.config = readTtsConfig(env, { configVersion });
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.maxCacheEntries = maxCacheEntries;
    this.cache = new Map();
    this.pending = new Map();
  }

  get configured() {
    return this.config.configured;
  }

  get configurationReason() {
    return this.config.reason;
  }

  get missingVariables() {
    return this.config.missingVariables;
  }

  async generate({ text }) {
    const normalizedText = normalizeTtsText(text);
    if (!this.configured) throw new TtsProviderError(this.config.reason, 'A integração de voz não está configurada.');

    const cacheKey = getTtsCacheKey(normalizedText, {
      bitsPerSample: DEFAULT_WAV_OPTIONS.bitsPerSample,
      channels: DEFAULT_WAV_OPTIONS.channels,
      deliveredFormat: this.config.contentType,
      model: this.config.model,
      voice: this.config.voice,
      responseFormat: this.config.responseFormat,
      sampleRate: DEFAULT_WAV_OPTIONS.sampleRate,
      styleVersion: TTS_STYLE_VERSION,
      configVersion: this.config.configVersion,
    });
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);

    const pending = this.requestProvider(normalizedText);
    this.pending.set(cacheKey, pending);
    try {
      const result = await pending;
      this.cache.set(cacheKey, result);
      while (this.cache.size > this.maxCacheEntries) this.cache.delete(this.cache.keys().next().value);
      return result;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  async requestProvider(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: this.config.providerContentType,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: text,
          voice: this.config.voice,
          response_format: this.config.responseFormat,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const code = response.status === 401 || response.status === 403
          ? 'AUTHENTICATION_REJECTED'
          : response.status === 429
            ? 'QUOTA_EXCEEDED'
            : response.status >= 500 || response.status === 408 || response.status === 425
              ? 'TEMPORARY_PROVIDER_ERROR'
              : 'PROVIDER_ERROR';
        throw new TtsProviderError(code, 'O provedor rejeitou a geração de voz.', { providerStatus: response.status });
      }

      return await extractAudio(response, {
        responseFormat: this.config.responseFormat,
        contentType: this.config.contentType,
        maxBytes: this.maxResponseBytes,
      });
    } catch (error) {
      if (error instanceof TtsProviderError) throw error;
      throw classifyFetchError(error, controller.signal.aborted);
    } finally {
      clearTimeout(timeout);
    }
  }
}
