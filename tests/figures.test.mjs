import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpatialSvg } from '../src/figures.js';

test('o cone tem corpo convergente e base elíptica na parte inferior', () => {
  const svg = renderSpatialSvg('cone', 'solid');

  assert.match(svg, /class="cone-body"/);
  assert.match(svg, /class="cone-base"/);
  assert.match(svg, /<ellipse[^>]+cy="108"/);
  assert.doesNotMatch(svg, /solid-surface/);
});

test('cubo e bloco retangular mostram três faces', () => {
  for (const shapeKey of ['cube', 'rectangular-block']) {
    const svg = renderSpatialSvg(shapeKey, 'solid');

    assert.match(svg, new RegExp(`class="${shapeKey === 'cube' ? 'cube' : 'block'}-front"`));
    assert.match(svg, new RegExp(`class="${shapeKey === 'cube' ? 'cube' : 'block'}-top"`));
    assert.match(svg, new RegExp(`class="${shapeKey === 'cube' ? 'cube' : 'block'}-side"`));
  }
});

test('as cinco formas espaciais produzem um SVG acessível', () => {
  for (const shapeKey of ['cube', 'rectangular-block', 'cylinder', 'cone', 'sphere']) {
    const svg = renderSpatialSvg(shapeKey, 'object');

    assert.match(svg, /^<svg class="spatial-svg"/);
    assert.match(svg, /aria-hidden="true"/);
  }
});
