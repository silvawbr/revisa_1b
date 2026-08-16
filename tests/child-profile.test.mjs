import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHILD_NAME_STORAGE_KEY,
  MAX_CHILD_NAME_LENGTH,
  createChildProfileStore,
  createPersonalizedMessage,
  formatChildText,
  getNeutralSpeechText,
  isValidChildName,
  normalizeChildName,
} from '../src/child-profile.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
    value(key) { return values.get(key); },
  };
}

test('normaliza e valida nomes infantis sem perder acentos, hífens ou apóstrofos', () => {
  assert.equal(normalizeChildName('  Ana   Clara  '), 'Ana Clara');
  assert.equal(normalizeChildName('João'), 'João');
  assert.equal(normalizeChildName("D'Ávila"), "D'Ávila");
  assert.equal(normalizeChildName('Maria-Luiza'), 'Maria-Luiza');
  assert.equal(isValidChildName('Ana'), true);
});

test('rejeita vazio, espaços, pontuação, controles e nomes acima do limite', () => {
  for (const value of ['', '   ', '!!!', '---', ' \t\n ']) assert.equal(isValidChildName(value), false);
  assert.equal(isValidChildName('Ana\u0000'), false);
  assert.equal(isValidChildName('a'.repeat(MAX_CHILD_NAME_LENGTH + 1)), false);
  assert.equal(isValidChildName('a'.repeat(MAX_CHILD_NAME_LENGTH)), true);
});

test('personaliza somente a versão visual e mantém a versão neutra para TTS', () => {
  const message = createPersonalizedMessage({
    childName: 'João',
    visualTemplate: 'Muito bem, {name}! 💛',
    speechText: 'Muito bem! Vamos continuar?',
  });
  assert.deepEqual(message, {
    visualText: 'Muito bem, João! 💛',
    speechText: 'Muito bem! Vamos continuar?',
  });
  assert.equal(formatChildText('Revisão de Matemática de {name}', 'Ana'), 'Revisão de Matemática de Ana');
  assert.equal(getNeutralSpeechText('  Você   conseguiu! '), 'Você conseguiu!');
  assert.throws(() => createPersonalizedMessage({
    childName: 'Ana',
    visualTemplate: 'Parabéns, {name}!',
    speechText: 'Parabéns, Ana!',
  }), /texto de voz/);
});

test('salva, lê, normaliza e remove somente o nome na chave versionada', () => {
  const storage = memoryStorage();
  const profile = createChildProfileStore({ storage });
  assert.equal(profile.getName(), null);
  assert.equal(profile.saveName('  Maria   Luiza '), 'Maria Luiza');
  assert.equal(storage.value(CHILD_NAME_STORAGE_KEY), 'Maria Luiza');
  assert.equal(createChildProfileStore({ storage }).getName(), 'Maria Luiza');
  profile.clearName();
  assert.equal(storage.has(CHILD_NAME_STORAGE_KEY), false);
});

test('descarta valor armazenado inválido e continua sem nome', () => {
  const storage = memoryStorage({ [CHILD_NAME_STORAGE_KEY]: '!!!' });
  const profile = createChildProfileStore({ storage });
  assert.equal(profile.getName(), null);
  assert.equal(storage.has(CHILD_NAME_STORAGE_KEY), false);
});

test('falha de localStorage usa memória somente durante a sessão', () => {
  const unavailableStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const profile = createChildProfileStore({ storage: unavailableStorage });
  assert.equal(profile.saveName('Ana'), 'Ana');
  assert.equal(profile.getName(), 'Ana');
  profile.clearName();
  assert.equal(profile.getName(), null);
});

test('a UI usa tela inicial de identificação, identidade Vita e ações de troca', async () => {
  const [appSource, htmlSource, readmeSource] = await Promise.all([
    fs.readFile(path.join(root, 'app.js'), 'utf8'),
    fs.readFile(path.join(root, 'index.html'), 'utf8'),
    fs.readFile(path.join(root, 'README.md'), 'utf8'),
  ]);
  assert.match(appSource, /screen: storedChildName \? 'home' : 'name'/);
  assert.match(appSource, /Bem-vinda! Bem-vindo! 🌟/);
  assert.match(appSource, /Seu primeiro nome ou apelido/);
  assert.match(appSource, /Use apenas seu primeiro nome ou apelido\./);
  assert.match(appSource, /event\.key !== 'Enter'/);
  assert.match(appSource, /data-action="change-child"/);
  assert.match(appSource, /Deseja trocar o nome da criança neste dispositivo\?/);
  assert.match(appSource, /data-action="cancel-change-child"/);
  assert.match(appSource, /data-action="confirm-change-child"/);
  assert.match(appSource, /data-action="restart"/);
  assert.match(appSource, /formatChildText\('Luna, uma gatinha professora/);
  assert.match(appSource, /escapeHtml\(currentChildName\(\)\)/);
  assert.match(htmlSource, /1º ano Vita/);
  assert.match(readmeSource, /1º ano Vita/);
  assert.doesNotMatch(appSource, /Marina|1º ano B|1° ano B|\b1B\b/);
});

test('o frontend mantém o nome fora do corpo do TTS e fora do HTML estático como dado', async () => {
  const [appSource, ttsSource] = await Promise.all([
    fs.readFile(path.join(root, 'app.js'), 'utf8'),
    fs.readFile(path.join(root, 'src/tts-client.js'), 'utf8'),
  ]);
  assert.match(appSource, /getNeutralSpeechText\(speechText\)/);
  assert.match(appSource, /'Muito bem! Vamos continuar\?'/);
  assert.match(ttsSource, /body: JSON\.stringify\(\{ text: normalizedText \}\)/);
});
