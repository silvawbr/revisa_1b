import { SEARCH_COLORING_PAGES } from './searchColoringPages.js';

/**
 * @typedef {Object} ColoringPage
 * @property {string} id
 * @property {string} src
 * @property {string} alt
 * @property {string} title
 * @property {'portrait'|'landscape'} orientation
 * @property {boolean} attributionRequired
 * @property {string} author
 * @property {string} sourceUrl
 * @property {string} sourceFileUrl
 * @property {string} license
 * @property {string} licenseUrl
 */

const LOCAL_ASSET_PREFIX = '/public/coloring-pages/';
const TRUSTED_IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
export const COLORING_PAGE_HISTORY_KEY = 'revisao-matematica.coloringPages.v1';
export const LOCAL_COLORING_PAGE_HISTORY_LIMIT = 5;

export const COLORING_PAGES = Object.freeze([...SEARCH_COLORING_PAGES]);
export const REWARD_MESSAGE = 'Você terminou a revisão! Parabéns, {name}! Escolha suas cores e divirta-se! 🎉';

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function parseRecentIds(value) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function createRecentIdStore({ key, limit, storage = getDefaultStorage() } = {}) {
  let recentIds = [];
  try {
    recentIds = parseRecentIds(storage?.getItem(key)).slice(0, limit);
  } catch {
    recentIds = [];
  }

  function persist() {
    try {
      storage?.setItem(key, JSON.stringify(recentIds));
    } catch {
      // A blocked or full localStorage must not stop the reward flow.
    }
  }

  return {
    get: () => recentIds.slice(),
    remember(id) {
      if (typeof id !== 'string' || !id) return;
      recentIds = [id, ...recentIds.filter((recentId) => recentId !== id)].slice(0, limit);
      persist();
    },
  };
}

export function getColoringPageById(id, pages = COLORING_PAGES) {
  return pages.find((page) => page.id === id) ?? null;
}

function pickFromCatalog({ pages, random, excludeId, recentIds, unavailableIds }) {
  const availablePages = pages.filter((page) => page.id !== excludeId && !unavailableIds.has(page.id));
  const recent = new Set(recentIds);
  const freshPages = availablePages.filter((page) => !recent.has(page.id));
  const candidates = freshPages.length > 0
    ? freshPages
    : availablePages.length > 0
      ? availablePages
      : pages.filter((page) => !unavailableIds.has(page.id));
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}

export function pickColoringPage({
  pages = COLORING_PAGES,
  random = Math.random,
  excludeId = null,
  recentIds = [],
  unavailableIds = new Set(),
} = {}) {
  return pickFromCatalog({ pages, random, excludeId, recentIds, unavailableIds });
}

export function isLocalColoringPage(page) {
  const src = typeof page?.src === 'string' ? page.src.split(/[?#]/, 1)[0] : '';
  return src.startsWith(LOCAL_ASSET_PREFIX) && /\.(?:png|jpe?g|webp)$/i.test(src);
}

export function isDisplayableColoringPage(page) {
  if (isLocalColoringPage(page)) return true;
  try {
    const url = new URL(page?.src);
    return url.protocol === 'https:'
      && TRUSTED_IMAGE_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/wikipedia/commons/')
      && /\.(?:png|jpe?g|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
