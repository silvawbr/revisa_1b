import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REQUIRED_FILES = ['index.html', 'styles.css', 'app.js'];
const PUBLIC_DIRECTORIES = ['src', 'public'];
const FORBIDDEN_NAMES = new Set([
  '.env',
  'example.env',
  'server.js',
  'server',
  'api',
  'tests',
  'scripts',
  'node_modules',
  'package.json',
  'package-lock.json',
  'vercel.json',
]);

async function assertFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error('não é um arquivo regular');
  } catch (error) {
    throw new Error(`Arquivo público obrigatório ausente ou inválido: ${relativePath}`, { cause: error });
  }
  return absolutePath;
}

function assertSafeRelativePath(relativePath) {
  const segments = relativePath.split(path.sep);
  if (segments.some((segment) => FORBIDDEN_NAMES.has(segment) || segment.startsWith('.env'))) {
    throw new Error(`Conteúdo privado não pode ser publicado em dist/: ${relativePath}`);
  }
}

async function copyDirectory(relativeDirectory) {
  const sourceDirectory = path.join(ROOT, relativeDirectory);
  const destinationDirectory = path.join(DIST, relativeDirectory);
  let entries;
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Diretório público obrigatório ausente: ${relativeDirectory}`, { cause: error });
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(relativeDirectory, entry.name);
    assertSafeRelativePath(relativePath);
    const sourcePath = path.join(ROOT, relativePath);
    const destinationPath = path.join(DIST, relativePath);
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copyDirectory(relativePath);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Arquivo público não regular: ${relativePath}`);
    await cp(sourcePath, destinationPath);
  }
}

export async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const relativePath of REQUIRED_FILES) {
    const sourcePath = await assertFile(relativePath);
    await cp(sourcePath, path.join(DIST, relativePath));
  }
  for (const relativeDirectory of PUBLIC_DIRECTORIES) await copyDirectory(relativeDirectory);

  console.info(`Build estático concluído: ${path.relative(ROOT, DIST)}/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((error) => {
    console.error(`Falha no build estático: ${error.message}`);
    process.exitCode = 1;
  });
}
