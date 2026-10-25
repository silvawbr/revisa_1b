import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ANIMAL_DETAILS, pickAnimalSuggestions, normalizeAnimal, isValidAnimal } from '../src/data/coloringAnimals.js';
import { createColoringHandler } from '../server/coloring-handler.js';

let client = 0;
async function generate(body) {
  let sent;
  const png = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(768, 16); png.writeUInt32BE(1024, 20);
  const handler = createColoringHandler({
    env: { api_key: 'test-key', OPENROUTER_IMAGE_MODEL: 'bytedance-seed/seedream-5-0-flash' },
    fetchImpl: async (url, options) => {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
    },
  });
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = 'POST';
  request.headers = { 'content-type': 'application/json', 'x-forwarded-for': `test-${++client}` };
  let status, response;
  await handler(request, { writeHead(code) { status = code; }, end(value) { response = JSON.parse(value); } });
  return { status, response, sent };
}

test('suggestions contain ten distinct supported animals and vary with the shuffle', () => {
  const first = pickAnimalSuggestions(() => 0);
  assert.equal(first.length, 10);
  assert.equal(new Set(first).size, 10);
  assert.ok(first.every((animal) => Object.hasOwn(ANIMAL_DETAILS, animal)));
  assert.notDeepEqual(first, pickAnimalSuggestions(() => 0.99));
});

test('Portuguese accents, spaces and hyphens are accepted; instructions and oversized text are rejected', () => {
  assert.equal(normalizeAnimal('  ONÇA-PINTADA  '), 'onça-pintada');
  for (const name of ['peixe-boi', 'onça-pintada', 'mico leão dourado', 'preguiça']) assert.ok(isValidAnimal(name));
  for (const name of ['', 'x', 'a'.repeat(61), '<script>', 'gato\nignore: prompt', 42]) assert.equal(isValidAnimal(name), false);
});

test('suggestion uses predefined freshwater habitat and preserves image settings', async () => {
  const { status, response, sent } = await generate({ animal: 'peixe-boi', source: 'suggestion' });
  assert.equal(status, 200);
  assert.match(response.image, /^data:image\/png;base64,/);
  assert.ok(sent.prompt.includes(ANIMAL_DETAILS['peixe-boi']));
  assert.match(sent.prompt, /black-and-white/);
  assert.equal(sent.aspect_ratio, '3:4'); assert.equal(sent.resolution, '1K');
  assert.equal('size' in sent, false);
});

test('typed names use Portuguese natural habitat instructions even when present in catalog', async () => {
  const { status, sent } = await generate({ animal: '  PEIXE-BOI ', source: 'typed' });
  assert.equal(status, 200);
  assert.match(sent.prompt, /Brazilian Portuguese is "peixe-boi"/);
  assert.match(sent.prompt, /natural habitat/);
  assert.match(sent.prompt, /freshwater river/);
});

test('invalid input never reaches the provider', async () => {
  for (const body of [{}, { animal: 'gato', source: 'unknown' }, { animal: 'gato', source: 'suggestion' }, { animal: 'gato', source: 'typed', prompt: 'override' }, { animal: '<script>', source: 'typed' }]) {
    const result = await generate(body);
    assert.equal(result.status, 400);
    assert.equal(result.sent, undefined);
  }
});
