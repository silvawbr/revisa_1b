import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const selectionSource = fs.readFileSync(path.join(root, 'src/association-interaction.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('as duas atividades usam alternativas visuais compartilhadas', () => {
  assert.match(appSource, /createVisualSelectionInteraction/);
  assert.match(appSource, /data-shape-option="\$\{shape\.key\}"/);
  assert.match(appSource, /data-shape-option/);
  assert.match(appSource, /shapeCatalog = isFlat \? FLAT_SHAPES : SPATIAL_SHAPES/);
  assert.match(appSource, /optionKeys/);
  assert.match(appSource, /Selecione a figura correta\./);
  assert.match(appSource, /shape-name-prompt/);
  assert.doesNotMatch(appSource, /data-match-source|data-match-target|state\.connection|name-card-dot/);
});

test('a seleção usa botões acessíveis, feedback anunciado e teclado', () => {
  assert.match(appSource, /<button class="shape-option[^>]+type="button"/);
  assert.match(appSource, /aria-label="Alternativa visual/);
  assert.match(appSource, /aria-live="polite"/);
  assert.match(selectionSource, /addEventListener\('click'/);
  assert.match(selectionSource, /addEventListener\('keydown'/);
  assert.match(selectionSource, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(stylesSource, /\.shape-option\s*\{[\s\S]*?min-height:\s*170px/);
  assert.match(stylesSource, /\.shape-option:focus-visible|button:focus-visible/);
  assert.match(stylesSource, /@media \(max-width: 760px\)/);
  assert.match(stylesSource, /@media \(max-width: 460px\)/);
});

test('não restam mecanismos ou textos públicos de drag and drop nas figuras', () => {
  const sources = `${appSource}\n${selectionSource}\n${stylesSource}`;
  assert.doesNotMatch(sources, /pointerdown|pointermove|pointerup|pointercancel|setPointerCapture|releasePointerCapture|elementFromPoint|DataTransfer/);
  assert.doesNotMatch(sources, /dragstart|dragover|drop-target|drag-preview|dragging|drag-ghost|touch-action\s*:\s*none|-webkit-user-drag|draggable\s*=/);
  assert.doesNotMatch(sources, /Arraste|arraste|solt(e|ura)|Ligue o nome|Ligue a figura|Ligação concluída|matching-arrow|visual-target/);
  assert.match(serverSource, /'src\/association-interaction\.js'/);
});
