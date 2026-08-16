const UINT32_MAX = 0xffffffff;
const UINT16_MAX = 0xffff;
const WAV_HEADER_BYTES = 44;

export const DEFAULT_WAV_OPTIONS = Object.freeze({
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
});

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

export function pcmToWav(pcm, options = {}) {
  if (!(pcm instanceof Uint8Array)) {
    throw new TypeError('PCM deve ser um Buffer ou Uint8Array.');
  }

  const resolvedOptions = { ...DEFAULT_WAV_OPTIONS, ...options };
  const sampleRate = positiveInteger(resolvedOptions.sampleRate, 'sampleRate');
  const channels = positiveInteger(resolvedOptions.channels, 'channels');
  const bitsPerSample = positiveInteger(resolvedOptions.bitsPerSample, 'bitsPerSample');
  if (bitsPerSample % 8 !== 0) {
    throw new RangeError('bitsPerSample deve ser múltiplo de 8.');
  }

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const riffSize = 36 + dataSize;
  if (
    channels > UINT16_MAX
    || bitsPerSample > UINT16_MAX
    || blockAlign > UINT16_MAX
    || byteRate > UINT32_MAX
    || riffSize > UINT32_MAX
  ) {
    throw new RangeError('O áudio excede os limites do formato WAV.');
  }
  if (dataSize % blockAlign !== 0) {
    throw new RangeError('O PCM termina no meio de um sample.');
  }

  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(riffSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, Buffer.from(pcm)]);
}
