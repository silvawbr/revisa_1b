import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TtsProvider,
  getTtsCacheKey,
  normalizeTtsText,
  readTtsConfig,
} from '../server/tts-provider.js';
import { DEFAULT_WAV_OPTIONS, pcmToWav } from '../server/pcm-to-wav.js';
import { handleTts, serveStatic } from '../server.js';
import { createTtsClient } from '../src/tts-client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function configuredEnv(overrides = {}) {
  return {
    api_url: 'https://openrouter.ai/api/v1/audio/speech',
    api_key: 'server-secret',
    tts_model: 'google/gemini-3.1-flash-tts-preview',
    tts_voice: 'Zephyr',
    tts_response_format: 'pcm',
    ...overrides,
  };
}

const PCM_FIXTURE = Buffer.from([0x00, 0x01, 0xfe, 0x7f]);

function binaryResponse(bytes, contentType) {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

function pcmResponse(bytes = PCM_FIXTURE) {
  return binaryResponse(bytes, 'audio/pcm');
}

function wavResponse(bytes = Buffer.from([1, 2, 3])) {
  return binaryResponse(bytes, 'audio/wav');
}

function assertValidFixtureWav(wav, pcm = PCM_FIXTURE) {
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.subarray(12, 16).toString(), 'fmt ');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), DEFAULT_WAV_OPTIONS.channels);
  assert.equal(wav.readUInt32LE(24), DEFAULT_WAV_OPTIONS.sampleRate);
  assert.equal(wav.readUInt32LE(28), DEFAULT_WAV_OPTIONS.sampleRate * 2);
  assert.equal(wav.readUInt16LE(32), 2);
  assert.equal(wav.readUInt16LE(34), DEFAULT_WAV_OPTIONS.bitsPerSample);
  assert.equal(wav.subarray(36, 40).toString(), 'data');
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.deepEqual(wav.subarray(44), pcm);
}

test('example.env configura Gemini, Zephyr e PCM sem chave real', async () => {
  const content = await fs.readFile(path.join(root, 'example.env'), 'utf8');

  assert.match(content, /^api_url=https:\/\/openrouter\.ai\/api\/v1\/audio\/speech$/m);
  assert.match(content, /^api_key=\s*$/m);
  assert.match(content, /^tts_model=google\/gemini-3\.1-flash-tts-preview$/m);
  assert.match(content, /^tts_voice=Zephyr$/m);
  assert.match(content, /^tts_response_format=pcm$/m);
  assert.doesNotMatch(content, /sk-or-v1-[A-Za-z0-9]/);
});

test('a configuração lê somente as variáveis do contrato OpenRouter', () => {
  const configured = readTtsConfig(configuredEnv());
  assert.equal(configured.configured, true);
  assert.equal(configured.apiUrl, configuredEnv().api_url);
  assert.equal(configured.model, 'google/gemini-3.1-flash-tts-preview');
  assert.equal(configured.voice, 'Zephyr');
  assert.equal(configured.responseFormat, 'pcm');
  assert.equal(configured.providerContentType, 'audio/pcm');
  assert.equal(configured.contentType, 'audio/wav');

  const missing = readTtsConfig({});
  assert.equal(missing.configured, false);
  assert.deepEqual(missing.missingVariables, ['api_url', 'api_key', 'tts_model', 'tts_voice', 'tts_response_format']);
});

test('arquivos privados de ambiente continuam ignorados', async () => {
  const content = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
  const entries = content.split(/\r?\n/);

  for (const entry of ['.env', '.env.local', '.env.*.local', '*.env.local']) assert.ok(entries.includes(entry));
});

async function callTts(provider, { method = 'POST', contentType = 'application/json', payload = { text: 'Leia isto.' } } = {}) {
  const body = JSON.stringify(payload);
  const request = {
    method,
    headers: { 'content-type': contentType, 'content-length': String(Buffer.byteLength(body)) },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  };
  const response = {
    destroyed: false,
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(value = '') {
      this.body = value;
    },
  };
  await handleTts(request, response, provider, () => {});
  return response;
}

test('normalização de texto limita o contrato do endpoint', () => {
  assert.equal(normalizeTtsText('  uma   frase\ncurta  '), 'uma frase curta');
  assert.throws(() => normalizeTtsText(''), /não pode ficar vazio/);
  assert.throws(() => normalizeTtsText('a'.repeat(501)), /500 caracteres/);
});

test('pcmToWav gera cabeçalho PCM linear byte a byte e preserva os samples', () => {
  const wav = pcmToWav(PCM_FIXTURE);

  assertValidFixtureWav(wav);
  assert.equal(wav.length, 44 + PCM_FIXTURE.length);
});

test('pcmToWav rejeita bytes que não formam samples completos', () => {
  assert.throws(() => pcmToWav(Buffer.from([0x01])), /meio de um sample/);
  assert.throws(() => pcmToWav('pcm'), /Buffer ou Uint8Array/);
});

test('o endpoint aceita somente POST JSON e rejeita texto ou configuração enviados pelo cliente', async () => {
  const provider = new TtsProvider({ env: configuredEnv(), fetchImpl: async () => pcmResponse() });

  assert.equal((await callTts(provider, { method: 'GET' })).status, 405);
  assert.equal((await callTts(provider, { contentType: 'text/plain' })).status, 415);

  for (const payload of [
    { text: '' },
    { text: '   ' },
    { text: 42 },
    { text: 'a'.repeat(501) },
    { text: 'ok', api_key: 'client-secret' },
    { text: 'ok', api_url: 'https://attacker.example' },
    { text: 'ok', tts_model: 'client-model' },
    { text: 'ok', tts_voice: 'client-voice' },
    { text: 'ok', tts_response_format: 'wav' },
  ]) {
    const response = await callTts(provider, { payload });
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body), { error: 'Texto inválido.' });
  }
});

test('a chamada externa usa URL, Bearer e payload vindos da configuração do servidor', async () => {
  const calls = [];
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return pcmResponse();
    },
  });

  const result = await provider.generate({ text: '  Vinte   e três. ' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, configuredEnv().api_url);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer server-secret');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.headers.Accept, 'audio/pcm');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: 'google/gemini-3.1-flash-tts-preview',
    input: 'Vinte e três.',
    voice: 'Zephyr',
    response_format: 'pcm',
  });
  assert.equal(result.contentType, 'audio/wav');
  assertValidFixtureWav(result.audio);
});

test('o adaptador rejeita respostas JSON e preserva somente áudio binário', async () => {
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => new Response(JSON.stringify({ audio: 'not-forwarded' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });

  await assert.rejects(
    provider.generate({ text: 'Leia isto.' }),
    (error) => error.code === 'INVALID_AUDIO_RESPONSE',
  );
});

test('uma resposta PCM vazia falha antes do encapsulamento', async () => {
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => pcmResponse(Buffer.alloc(0)),
  });

  await assert.rejects(
    provider.generate({ text: 'Leia isto.' }),
    (error) => error.code === 'NO_AUDIO',
  );
});

test('configuração ausente falha de forma controlada sem chamar o provedor', async () => {
  const provider = new TtsProvider({
    env: { api_url: configuredEnv().api_url, api_key: '' },
    fetchImpl: async () => { throw new Error('não deveria chamar o provedor'); },
  });

  assert.equal(provider.configured, false);
  assert.deepEqual(provider.missingVariables, ['api_key', 'tts_model', 'tts_voice', 'tts_response_format']);
  await assert.rejects(
    provider.generate({ text: 'Leia isto.' }),
    (error) => error.code === 'PARTIAL_CONFIG',
  );
});

test('o timeout cobre a chamada externa', async () => {
  const provider = new TtsProvider({
    env: configuredEnv(),
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });

  await assert.rejects(
    provider.generate({ text: 'Leia isto.' }),
    (error) => error.code === 'TIMEOUT',
  );
});

test('o cache usa texto normalizado, modelo, voz e formato', async () => {
  let calls = 0;
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return pcmResponse();
    },
  });

  await provider.generate({ text: '  Leia   isto. ' });
  await provider.generate({ text: 'Leia isto.' });
  assert.equal(calls, 1);
  assert.notEqual(
    getTtsCacheKey('Leia isto.', { model: 'one', voice: 'alloy', responseFormat: 'mp3' }),
    getTtsCacheKey('Leia isto.', { model: 'two', voice: 'alloy', responseFormat: 'mp3' }),
  );
  assert.notEqual(
    getTtsCacheKey('Leia isto.', { model: 'one', voice: 'alloy', responseFormat: 'pcm', deliveredFormat: 'audio/wav' }),
    getTtsCacheKey('Leia isto.', { model: 'one', voice: 'alloy', responseFormat: 'pcm', deliveredFormat: 'audio/mpeg' }),
  );
  assert.notEqual(
    getTtsCacheKey('Leia isto.', { model: 'one', voice: 'alloy', responseFormat: 'pcm', styleVersion: 'one' }),
    getTtsCacheKey('Leia isto.', { model: 'one', voice: 'alloy', responseFormat: 'pcm', styleVersion: 'two' }),
  );
});

test('o endpoint devolve WAV binário com cabeçalho e sem expor a chave', async () => {
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => pcmResponse(),
  });

  const response = await callTts(provider);
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'audio/wav');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(response.headers['Content-Length'], response.body.length);
  assertValidFixtureWav(response.body);
  assert.equal(JSON.stringify(response.headers).includes('server-secret'), false);
});

test('erros do provedor retornam mensagem segura e não seu corpo bruto', async () => {
  const logs = [];
  const provider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'provider-secret' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  });

  const body = await callTts(provider);
  assert.equal(body.status, 502);
  assert.deepEqual(JSON.parse(body.body), { error: 'A leitura não está disponível agora.' });
  assert.doesNotMatch(String(body.body), /provider-secret|server-secret/);

  const loggingProvider = new TtsProvider({
    env: configuredEnv(),
    fetchImpl: async () => { throw new Error('provider-secret'); },
  });
  await handleTts(
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ text: 'ok' })); },
    },
    { destroyed: true, writeHead() {}, end() {} },
    loggingProvider,
    (line) => logs.push(line),
  );
  assert.equal(logs.join('\n').includes('provider-secret'), false);
  assert.equal(logs.join('\n').includes('server-secret'), false);
});

test('arquivos de ambiente não são servidos pelo servidor estático', async () => {
  const response = {
    status: null,
    writeHead(status) { this.status = status; },
    end() {},
  };

  await serveStatic({ method: 'GET', url: '/.env' }, response);
  assert.equal(response.status, 404);
});

test('o cliente usa somente /api/tts, envia somente texto e cacheia o Blob binário', async () => {
  const calls = [];
  const client = createTtsClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return wavResponse();
    },
  });

  const first = await client.getAudio('  Leia   isto. ');
  const second = await client.getAudio('Leia isto.');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/tts');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { text: 'Leia isto.' });
  assert.equal(first.type, 'audio/wav');
  assert.equal(first.size, 3);
  assert.equal(second, first);
});

test('o frontend mantém a leitura explícita, cancelável e sem speechSynthesis', async () => {
  const files = ['app.js', 'src/tts-client.js'];
  const content = (await Promise.all(files.map((file) => fs.readFile(path.join(root, file), 'utf8')))).join('\n');

  assert.doesNotMatch(content, /speechSynthesis|api_url|openrouter\.ai/);
  assert.match(content, /\/api\/tts/);
  assert.match(content, /new Audio\(url\)/);
  assert.match(content, /audio\.pause\(\)/);
  assert.match(content, /URL\.createObjectURL\(blob\)/);
  assert.match(content, /URL\.revokeObjectURL\(speech\.active\.url\)/);
  assert.match(content, /button\.disabled = loading/);
  assert.match(content, /button\.addEventListener\('click'/);
  assert.doesNotMatch(content, /checkAvailability|\/api\/tts\/status/);
});
