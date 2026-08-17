/**
 * @typedef {Object} ColoringPage
 * @property {string} id
 * @property {string} src
 * @property {string} alt
 * @property {string} title
 * @property {'portrait'|'landscape'} orientation
 * @property {boolean} attributionRequired
 * @property {string} [author]
 * @property {string} sourceUrl
 * @property {string} sourceFileUrl
 * @property {string} license
 * @property {string} licenseUrl
 */

const LOCAL_ASSET_PREFIX = '/public/coloring-pages/';
export const COLORING_PAGE_HISTORY_KEY = 'revisao-matematica.coloringPages.v1';
export const LOCAL_COLORING_PAGE_HISTORY_LIMIT = 5;

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

/** @type {readonly ColoringPage[]} */
export const COLORING_PAGES = Object.freeze([
  {
    id: 'student-writing',
    src: `${LOCAL_ASSET_PREFIX}student-writing-02.svg`,
    alt: 'Desenho para colorir de uma criança escrevendo em uma mesa.',
    title: 'Criança escrevendo',
    orientation: 'portrait',
    attributionRequired: false,
    author: 'lmproulx',
    sourceUrl: 'https://openclipart.org/detail/50281/eleve-ecrivant-student-writing',
    sourceFileUrl: 'https://openclipart.org/download/50281',
    license: 'CC0 1.0 / domínio público',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'animals-bunny',
    src: `${LOCAL_ASSET_PREFIX}animals-bunny-02.svg`,
    alt: 'Desenho para colorir de um coelhinho simpático.',
    title: 'Coelhinho simpático',
    orientation: 'portrait',
    attributionRequired: false,
    author: 'frankes',
    sourceUrl: 'https://openclipart.org/detail/213606/bunny-outline',
    sourceFileUrl: 'https://openclipart.org/download/213606',
    license: 'CC0 1.0 / domínio público',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'school-bear',
    src: `${LOCAL_ASSET_PREFIX}school-bear-03.svg`,
    alt: 'Desenho para colorir de um ursinho com um livro.',
    title: 'Ursinho com livro',
    orientation: 'portrait',
    attributionRequired: false,
    author: 'pianoBrad',
    sourceUrl: 'https://openclipart.org/detail/187792/christmas-bear-coloring-page',
    sourceFileUrl: 'https://openclipart.org/download/187792',
    license: 'CC0 1.0 / domínio público',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'kitten-telescope',
    src: `${LOCAL_ASSET_PREFIX}kitten-telescope-07.svg`,
    alt: 'Desenho para colorir de um gatinho observando estrelas com um telescópio.',
    title: 'Gatinho observando as estrelas',
    orientation: 'portrait',
    attributionRequired: true,
    author: 'Jonsimsar25',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kitten_Telescope_Coloring_Page.svg',
    sourceFileUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kitten_Telescope_Coloring_Page.svg',
    license: 'CC BY-SA 4.0 Internacional',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    id: 'cat-line-art', src: `${LOCAL_ASSET_PREFIX}cat-line-art.svg`, alt: 'Gatinho de contorno preto para colorir.', title: 'Gatinho', orientation: 'landscape', attributionRequired: false, author: 'gammillian', sourceUrl: 'https://openclipart.org/detail/75883/cat-line-art', sourceFileUrl: 'https://openclipart.org/download/75883', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'owl-line-art', src: `${LOCAL_ASSET_PREFIX}owl-line-art.svg`, alt: 'Coruja de contorno preto para colorir.', title: 'Coruja', orientation: 'landscape', attributionRequired: false, author: 'gammillian', sourceUrl: 'https://openclipart.org/detail/75271/owl-line-art', sourceFileUrl: 'https://openclipart.org/download/75271', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'bunny-outline', src: `${LOCAL_ASSET_PREFIX}bunny-outline.svg`, alt: 'Coelhinho sentado de contorno preto para colorir.', title: 'Coelhinho sentado', orientation: 'portrait', attributionRequired: false, author: 'molumen', sourceUrl: 'https://openclipart.org/detail/213759/bunny-outline', sourceFileUrl: 'https://openclipart.org/download/213759', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'duck-outline', src: `${LOCAL_ASSET_PREFIX}duck-outline.svg`, alt: 'Patinho de contorno preto para colorir.', title: 'Patinho', orientation: 'landscape', attributionRequired: false, author: 'gammillian', sourceUrl: 'https://openclipart.org/detail/75889/duck-outline', sourceFileUrl: 'https://openclipart.org/download/75889', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'koala-line-art', src: `${LOCAL_ASSET_PREFIX}koala-line-art.svg`, alt: 'Coala de contorno preto para colorir.', title: 'Coala', orientation: 'portrait', attributionRequired: false, author: 'gammillian', sourceUrl: 'https://openclipart.org/detail/76225/koala-line-art', sourceFileUrl: 'https://openclipart.org/download/76225', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'baby-octopus', src: `${LOCAL_ASSET_PREFIX}baby-octopus.svg`, alt: 'Polvo bebê de contorno preto para colorir.', title: 'Polvo bebê', orientation: 'landscape', attributionRequired: false, author: 'Deadly44', sourceUrl: 'https://openclipart.org/detail/245072/baby-octopus-coloring-page', sourceFileUrl: 'https://openclipart.org/download/245072', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'caribou-coloring-page', src: `${LOCAL_ASSET_PREFIX}caribou-coloring-page.svg`, alt: 'Caribu de contorno preto para colorir.', title: 'Caribu', orientation: 'landscape', attributionRequired: false, author: 'pianoBrad', sourceUrl: 'https://openclipart.org/detail/187782/caribou-coloring-page', sourceFileUrl: 'https://openclipart.org/download/187782', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'dog-reading-book', src: `${LOCAL_ASSET_PREFIX}dog-reading-book.svg`, alt: 'Cachorro lendo um livro aberto para colorir.', title: 'Cachorro lendo', orientation: 'portrait', attributionRequired: false, author: 'nerdy', sourceUrl: 'https://openclipart.org/detail/355238/dog-reading-open-book-drawing', sourceFileUrl: 'https://openclipart.org/download/355238', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'surgeon-penguin', src: `${LOCAL_ASSET_PREFIX}surgeon-penguin.svg`, alt: 'Pinguim cirurgião de contorno preto para colorir.', title: 'Pinguim cirurgião', orientation: 'portrait', attributionRequired: false, author: 'mvolz', sourceUrl: 'https://openclipart.org/detail/274032/coloring-page-of-surgeon-penguin', sourceFileUrl: 'https://openclipart.org/download/274032', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'math-girl', src: `${LOCAL_ASSET_PREFIX}math-girl.svg`, alt: 'Menina com lápis e números de contorno preto para colorir.', title: 'Menina da matemática', orientation: 'landscape', attributionRequired: false, author: 'Scout', sourceUrl: 'https://openclipart.org/detail/191351/math-girl', sourceFileUrl: 'https://openclipart.org/download/191351', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'child-writing', src: `${LOCAL_ASSET_PREFIX}child-writing.svg`, alt: 'Criança escrevendo em um quadro de contorno preto para colorir.', title: 'Criança escrevendo', orientation: 'portrait', attributionRequired: false, author: 'kalapahejo', sourceUrl: 'https://openclipart.org/detail/194792/writing', sourceFileUrl: 'https://openclipart.org/download/194792', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'simple-flower', src: `${LOCAL_ASSET_PREFIX}simple-flower.svg`, alt: 'Flor simples de contorno preto para colorir.', title: 'Flor simples', orientation: 'portrait', attributionRequired: false, author: 'teck5', sourceUrl: 'https://openclipart.org/detail/352672/simple-flower-head-lineart', sourceFileUrl: 'https://openclipart.org/download/352672', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'lily-flower', src: `${LOCAL_ASSET_PREFIX}lily-flower.svg`, alt: 'Lírio de contorno preto para colorir.', title: 'Lírio', orientation: 'portrait', attributionRequired: false, author: 'elizavella', sourceUrl: 'https://openclipart.org/detail/333586/lilly-flower-abstract-art-coloring-page', sourceFileUrl: 'https://openclipart.org/download/333586', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'rose-coloring-page', src: `${LOCAL_ASSET_PREFIX}rose-coloring-page.svg`, alt: 'Rosa de contorno preto para colorir.', title: 'Rosa', orientation: 'landscape', attributionRequired: false, author: 'johnny_automatic', sourceUrl: 'https://openclipart.org/detail/637/pink-rose', sourceFileUrl: 'https://openclipart.org/download/637', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'fall-leaves', src: `${LOCAL_ASSET_PREFIX}fall-leaves.svg`, alt: 'Folhas de outono de contorno preto para colorir.', title: 'Folhas de outono', orientation: 'portrait', attributionRequired: false, author: 'pianoBrad', sourceUrl: 'https://openclipart.org/detail/187784/fall-leaves-coloring-page', sourceFileUrl: 'https://openclipart.org/download/187784', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'christmas-tree', src: `${LOCAL_ASSET_PREFIX}christmas-tree.svg`, alt: 'Árvore de Natal de contorno preto para colorir.', title: 'Árvore de Natal', orientation: 'portrait', attributionRequired: false, author: 'pianoBrad', sourceUrl: 'https://openclipart.org/detail/187781/christmas-tree-coloring-page', sourceFileUrl: 'https://openclipart.org/download/187781', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
]);

export const REWARD_MESSAGE = 'Você terminou a revisão! Parabéns, {name}! Escolha suas cores e divirta-se! 🎉';

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
  return Boolean(page?.src) && page.src.startsWith(LOCAL_ASSET_PREFIX) && !/^https?:\/\//i.test(page.src);
}
