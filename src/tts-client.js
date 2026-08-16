function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

const AUDIO_CACHE_VERSION = 'gemini-pcm-wav-24000hz-mono-s16-style-v1';

function cacheKey(text) {
  return `${AUDIO_CACHE_VERSION}:${normalizeText(text)}`;
}

const AUDIO_CONTENT_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg']);

export function createTtsClient({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl deve ser uma função.');
  const cache = new Map();
  const pending = new Map();

  return {
    async getAudio(text, signal) {
      const normalizedText = normalizeText(text);
      if (!normalizedText) throw new Error('O texto de voz não pode ficar vazio.');
      const key = cacheKey(normalizedText);
      if (cache.has(key)) return cache.get(key);
      if (pending.has(key)) return pending.get(key);

      const request = (async () => {
        const response = await fetchImpl('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: normalizedText }),
          signal,
        });
        if (!response.ok) throw new Error('VOICE_UNAVAILABLE');
        const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        if (!AUDIO_CONTENT_TYPES.has(contentType)) throw new Error('VOICE_UNAVAILABLE');
        const audio = await response.blob();
        if (!audio.size) throw new Error('VOICE_UNAVAILABLE');
        cache.set(key, audio);
        return audio;
      })();

      pending.set(key, request);
      try {
        return await request;
      } finally {
        pending.delete(key);
      }
    },
  };
}
