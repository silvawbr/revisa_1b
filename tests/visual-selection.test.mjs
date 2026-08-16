import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualSelectionInteraction } from '../src/association-interaction.js';

class FakeElement {
  constructor(shapeKey) {
    this.dataset = { shapeOption: shapeKey };
    this.disabled = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(type, init = {}) {
    const event = {
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...init,
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }
}

test('mouse e toque selecionam a alternativa pelo mesmo caminho', () => {
  const option = new FakeElement('circle');
  const selections = [];
  const interaction = createVisualSelectionInteraction({
    options: [option],
    onSelect: (shapeKey, event) => selections.push({ shapeKey, type: event.type }),
  });

  option.dispatch('click', { type: 'click' });
  option.dispatch('click', { type: 'click' });

  assert.deepEqual(selections, [
    { shapeKey: 'circle', type: 'click' },
    { shapeKey: 'circle', type: 'click' },
  ]);
  interaction.destroy();
});

test('Enter e Espaço ativam a alternativa focalizada', () => {
  const option = new FakeElement('cube');
  const selections = [];
  createVisualSelectionInteraction({ options: [option], onSelect: (shapeKey) => selections.push(shapeKey) });

  const enter = option.dispatch('keydown', { key: 'Enter' });
  const space = option.dispatch('keydown', { key: ' ' });

  assert.equal(enter.defaultPrevented, true);
  assert.equal(space.defaultPrevented, true);
  assert.deepEqual(selections, ['cube', 'cube']);
});

test('alternativas desabilitadas e interação destruída não selecionam novas respostas', () => {
  const option = new FakeElement('sphere');
  const selections = [];
  const interaction = createVisualSelectionInteraction({ options: [option], onSelect: (shapeKey) => selections.push(shapeKey) });

  option.disabled = true;
  option.dispatch('click');
  interaction.destroy();
  option.disabled = false;
  option.dispatch('click');

  assert.deepEqual(selections, []);
});
