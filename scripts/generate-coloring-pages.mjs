import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_DIR = path.resolve(ROOT, process.env.COLORING_REVIEW_DIR || 'work/coloring-pages-review');
const PUBLIC_DIR = path.join(ROOT, 'public/coloring-pages');
const CATALOG_FILE = path.join(ROOT, 'src/data/generatedColoringPages.js');
const ATTRIBUTIONS_FILE = path.join(PUBLIC_DIR, 'ATTRIBUTIONS.md');
const API_URL = 'https://openrouter.ai/api/v1/images';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const THEMES = Object.freeze({
  animals: 'a friendly original animal character in a simple nature scene',
  cats: 'an original playful kitten with a few simple toys',
  dogs: 'an original friendly puppy playing outdoors',
  nature: 'a calm garden with flowers, leaves, butterflies and a small bird',
  adventure: 'an original explorer discovering a friendly fantasy landscape',
  robots: 'a friendly original robot helping with a simple task',
  space: 'an original astronaut, rocket or rover exploring a peaceful planet',
  sports: 'an original child-friendly sports scene with simple equipment',
  characters: 'a charming original fantasy creature with simple props',
});

const STYLE_PROMPT = [
  'Create one original black-and-white coloring-book illustration for children.',
  'Use crisp, smooth, solid black outlines on a pure white background.',
  'Leave large enclosed white areas for coloring; use no gray, color, shadows, gradients, hatching or solid black regions except tiny facial details.',
  'Use a few clear, separated objects and a simple uncluttered composition.',
  'Make the drawing print-ready on a single A4 page in the requested orientation with a generous white margin.',
  'Do not include words, letters, numbers, logos, watermarks, borders with text, or recognizable copyrighted characters.',
  'Return only the image. Do not use names, photos, or personal information.',
].join(' ');

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith('--')) throw new Error('Argumento inesperado: ' + item);
    const key = item.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error('Informe um valor para --' + key);
    options[key] = value;
    index += 1;
  }
  return options;
}

function help() {
  return [
    'Geração: OPENROUTER_API_KEY=... OPENROUTER_IMAGE_MODEL=... npm run coloring:generate -- generate --count 3 --theme animals --orientation portrait',
    'Revisão: npm run coloring:generate -- review',
    'Aprovação: npm run coloring:generate -- approve --id ID --title "Título" --alt "Descrição" --author "Autor" --license "Licença" --license-url "https://..."',
    'Temas: ' + Object.keys(THEMES).join(', '),
  ].join('\n');
}

function slug(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52) || 'coloring-page';
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function imageDimensions(buffer, mimeType) {
  if (mimeType === 'image/png') {
    if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      throw new Error('O arquivo não contém um PNG válido.');
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (mimeType === 'image/jpeg') {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new Error('O arquivo não contém um JPEG válido.');
    }
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
    throw new Error('Não foi possível ler as dimensões do JPEG.');
  }

  throw new Error('Formato não aceito; use PNG ou JPEG.');
}

function validateDimensions({ width, height }, orientation) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 700 || height < 700) {
    throw new Error('A imagem precisa ter pelo menos 700 × 700 pixels.');
  }
  const ratio = width / height;
  const matches = orientation === 'portrait'
    ? ratio >= 0.60 && ratio <= 0.82
    : ratio >= 1.22 && ratio <= 1.68;
  if (!matches) throw new Error('A proporção da imagem não corresponde à orientação A4 ' + orientation + '.');
}

function extractImage(payload) {
  const image = payload?.data?.[0]
    ?? payload?.images?.[0]
    ?? payload?.choices?.[0]?.message?.images?.[0]
    ?? payload?.choices?.[0]?.message?.content?.find?.((part) => part.type === 'image_url')
    ?? payload?.image;
  if (!image) throw new Error('A resposta da API não trouxe uma imagem reconhecida.');

  const imageUrl = typeof image === 'string'
    ? image
    : image.url ?? image.image_url?.url ?? image.image_url ?? image.uri;
  const encoded = typeof image === 'object'
    ? image.b64_json ?? image.base64 ?? image.data
    : null;
  const declaredType = typeof image === 'object'
    ? image.mime_type ?? image.mimeType ?? image.media_type
    : null;

  if (typeof image === 'string' && /^data:image\/(?:png|jpeg);base64,/s.test(image)) {
    const dataMatch = image.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/s);
    return { buffer: Buffer.from(dataMatch[2], 'base64'), mimeType: dataMatch[1] };
  }
  if (typeof encoded === 'string') {
    const dataMatch = encoded.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/s);
    return {
      buffer: Buffer.from(dataMatch ? dataMatch[2] : encoded, 'base64'),
      mimeType: dataMatch?.[1] ?? declaredType ?? 'image/png',
    };
  }
  if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
    return { url: imageUrl, mimeType: declaredType ?? null };
  }
  throw new Error('A resposta da API não contém uma URL ou conteúdo de imagem válido.');
}

async function fetchImage(payload) {
  const result = extractImage(payload);
  if (result.buffer) return result;
  const response = await fetch(result.url);
  if (!response.ok) throw new Error('A URL da imagem retornou HTTP ' + response.status + '.');
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = (response.headers.get('content-type') || result.mimeType || '').split(';')[0].toLowerCase();
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('A imagem ultrapassa o limite de 20 MiB.');
  return { buffer, mimeType };
}

async function readManifest() {
  try {
    const parsed = JSON.parse(await readFile(path.join(REVIEW_DIR, 'manifest.json'), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('manifest.json inválido');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveManifest(manifest) {
  await mkdir(REVIEW_DIR, { recursive: true });
  const target = path.join(REVIEW_DIR, 'manifest.json');
  const temporary = target + '.tmp';
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n');
  await rename(temporary, target);
}

async function generate(options) {
  const key = process.env.OPENROUTER_API_KEY;
  const model = options.model || process.env.OPENROUTER_IMAGE_MODEL;
  if (!key) throw new Error('Defina OPENROUTER_API_KEY no ambiente seguro do terminal.');
  if (!model) throw new Error('Defina OPENROUTER_IMAGE_MODEL ou informe --model.');
  const count = Number(options.count || 1);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('--count deve ser um número entre 1 e 20.');
  const orientation = options.orientation || 'portrait';
  if (!['portrait', 'landscape'].includes(orientation)) throw new Error('--orientation deve ser portrait ou landscape.');
  const themes = (options.themes || options.theme || 'animals').split(',').map((theme) => theme.trim());
  for (const theme of themes) if (!THEMES[theme]) throw new Error('Tema desconhecido: ' + theme);

  await mkdir(REVIEW_DIR, { recursive: true });
  const manifest = await readManifest();
  for (let index = 0; index < count; index += 1) {
    const theme = themes[index % themes.length];
    const prompt = STYLE_PROMPT + ' Theme: ' + THEMES[theme] + '. Orientation: A4 ' + orientation + '.';
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/silvawbr/revisa_1b',
        'X-OpenRouter-Title': 'Coloring Page Catalog Admin',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: orientation === 'portrait' ? '1024x1536' : '1536x1024',
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error('OpenRouter retornou HTTP ' + response.status + ': ' + detail);
    }
    const image = await fetchImage(await response.json());
    if (image.buffer.length > MAX_IMAGE_BYTES) throw new Error('A imagem ultrapassa o limite de 20 MiB.');
    const dimensions = imageDimensions(image.buffer, image.mimeType);
    validateDimensions(dimensions, orientation);
    const extension = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const id = 'review-' + slug(theme) + '-' + randomUUID().slice(0, 8);
    const assetName = id + '.' + extension;
    const checksum = hash(image.buffer);
    const existing = [...manifest];
    if (existing.some((candidate) => candidate.sha256 === checksum)) {
      throw new Error('A imagem é duplicada de um candidato já gerado: ' + id);
    }
    await writeFile(path.join(REVIEW_DIR, assetName), image.buffer, { flag: 'wx' });
    const candidate = {
      id,
      title: 'Desenho para revisar',
      alt: 'Ilustração para colorir pendente de revisão.',
      theme,
      orientation,
      model,
      prompt,
      generatedAt: new Date().toISOString(),
      assetName,
      mimeType: image.mimeType,
      dimensions,
      sha256: checksum,
      status: 'pending-review',
    };
    manifest.push(candidate);
    await saveManifest(manifest);
    process.stdout.write('Gerado para revisão: ' + id + ' (' + dimensions.width + '×' + dimensions.height + ')\n');
  }
  process.stdout.write('Arquivos pendentes em: ' + path.relative(ROOT, REVIEW_DIR) + '\n');
}

async function review() {
  const manifest = await readManifest();
  const pending = manifest.filter((candidate) => candidate.status === 'pending-review');
  if (pending.length === 0) {
    process.stdout.write('Não há imagens pendentes de revisão.\n');
    return;
  }
  for (const candidate of pending) {
    process.stdout.write([
      candidate.id + ' — ' + candidate.theme + ' — A4 ' + candidate.orientation,
      '  Imagem: ' + path.join(path.relative(ROOT, REVIEW_DIR), candidate.assetName),
      '  Dimensões: ' + candidate.dimensions.width + '×' + candidate.dimensions.height,
      '  Modelo: ' + candidate.model,
      '  Aprove com metadados de título, descrição, autor e licença após a revisão visual.',
    ].join('\n') + '\n');
  }
}

function required(options, name) {
  const value = options[name]?.trim();
  if (!value) throw new Error('Informe --' + name + ' para aprovação.');
  return value;
}

async function appendApprovedPage(page) {
  let source = await readFile(CATALOG_FILE, 'utf8');
  const marker = 'export const GENERATED_COLORING_PAGES = Object.freeze([';
  const start = source.indexOf(marker);
  const end = source.indexOf(']);', start);
  if (start < 0 || end < 0) throw new Error('Não encontrei o bloco gerado em generatedColoringPages.js.');
  const existingModule = await import(pathToFileURL(CATALOG_FILE).href + '?approval=' + Date.now());
  if (existingModule.GENERATED_COLORING_PAGES.some((candidate) => candidate.id === page.id)) {
    throw new Error('O ID já está registrado no catálogo: ' + page.id);
  }
  const entry = JSON.stringify(page, null, 2).split('\n').map((line) => '  ' + line).join('\n');
  const current = source.slice(start + marker.length, end).trim();
  source = source.slice(0, end) + (current ? ',\n' : '\n') + entry + '\n' + source.slice(end);
  await writeFile(CATALOG_FILE, source);
}

async function approvedHashes() {
  const hashes = new Set();
  for (const entry of await readdir(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(svg|png|jpe?g)$/i.test(entry.name)) continue;
    hashes.add(hash(await readFile(path.join(PUBLIC_DIR, entry.name))));
  }
  return hashes;
}

async function approve(options) {
  const id = required(options, 'id');
  if (!/^review-[a-z0-9-]+-[0-9a-f]{8}$/.test(id)) throw new Error('ID pendente inválido.');
  const manifest = await readManifest();
  const candidate = manifest.find((item) => item.id === id);
  if (!candidate) throw new Error('Candidato não encontrado: ' + id);
  if (candidate.status !== 'pending-review') throw new Error('O candidato já foi aprovado ou não está pendente.');
  if (!new RegExp('^' + id + '\\.(?:png|jpg)$').test(candidate.assetName)) {
    throw new Error('O nome do arquivo do candidato é inválido.');
  }
  const title = required(options, 'title');
  const alt = required(options, 'alt');
  const author = required(options, 'author');
  const license = required(options, 'license');
  const licenseUrl = required(options, 'license-url');
  if (!/^https:\/\//i.test(licenseUrl)) throw new Error('--license-url deve usar HTTPS.');

  const sourceFile = path.join(REVIEW_DIR, candidate.assetName);
  const sourceStat = await stat(sourceFile);
  if (sourceStat.size > MAX_IMAGE_BYTES) throw new Error('A imagem ultrapassa o limite de 20 MiB.');
  const bytes = await readFile(sourceFile);
  if (hash(bytes) !== candidate.sha256) throw new Error('O arquivo mudou desde a geração; gere outro candidato.');
  const dimensions = imageDimensions(bytes, candidate.mimeType);
  validateDimensions(dimensions, candidate.orientation);
  if ((await approvedHashes()).has(candidate.sha256)) throw new Error('Esse arquivo já existe no catálogo local.');

  const { COLORING_PAGES } = await import('../src/data/coloringPages.js');
  if (COLORING_PAGES.some((page) => page.id === id)) throw new Error('O ID já existe no catálogo.');
  const destination = path.join(PUBLIC_DIR, candidate.assetName);
  try {
    await stat(destination);
    throw new Error('O nome do arquivo já existe: ' + candidate.assetName);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const page = {
    id,
    src: '/public/coloring-pages/' + candidate.assetName,
    alt,
    title,
    orientation: candidate.orientation,
    origin: 'ai',
    attributionRequired: false,
    author,
    sourceUrl: 'https://openrouter.ai/' + candidate.model,
    sourceFileUrl: API_URL,
    license,
    licenseUrl,
  };
  const originalCatalog = await readFile(CATALOG_FILE, 'utf8');
  const originalAttributions = await readFile(ATTRIBUTIONS_FILE, 'utf8');
  await rename(sourceFile, destination);
  try {
    await appendApprovedPage(page);
    const record = [
      '',
      '',
      '## ' + candidate.assetName,
      '',
      '- Título: ' + title,
      '- Origem: imagem original gerada sob demanda por OpenRouter.',
      '- Modelo: ' + candidate.model,
      '- Data de geração: ' + candidate.generatedAt,
      '- Prompt padronizado: ' + candidate.prompt,
      '- Autor informado na aprovação: ' + author,
      '- Licença informada na aprovação: ' + license,
      '- Link da licença: ' + licenseUrl,
      '- SHA-256: ' + candidate.sha256,
      '- Revisão visual: aprovada manualmente antes de entrar no catálogo.',
      '',
    ].join('\n');
    await writeFile(ATTRIBUTIONS_FILE, originalAttributions + record);
    candidate.status = 'approved';
    candidate.approvedAt = new Date().toISOString();
    candidate.title = title;
    candidate.alt = alt;
    candidate.author = author;
    candidate.license = license;
    candidate.licenseUrl = licenseUrl;
    await saveManifest(manifest);
  } catch (error) {
    await writeFile(CATALOG_FILE, originalCatalog).catch(() => {});
    await writeFile(ATTRIBUTIONS_FILE, originalAttributions).catch(() => {});
    await rename(destination, sourceFile).catch(() => {});
    throw error;
  }
  process.stdout.write('Aprovado e adicionado ao catálogo local: ' + id + '\n');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(help() + '\n');
    return;
  }
  const options = parseOptions(args);
  if (command === 'generate') return generate(options);
  if (command === 'review') return review();
  if (command === 'approve') return approve(options);
  throw new Error('Comando desconhecido: ' + command + '\n' + help());
}

main().catch((error) => {
  process.stderr.write('Falha na ferramenta de desenhos: ' + error.message + '\n');
  process.exitCode = 1;
});

