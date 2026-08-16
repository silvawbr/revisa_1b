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
]);

export const REWARD_MESSAGE = 'Você terminou a revisão! Parabéns, {name}! Escolha suas cores e divirta-se! 🎉';

export function getColoringPageById(id, pages = COLORING_PAGES) {
  return pages.find((page) => page.id === id) ?? null;
}

export function pickColoringPage({
  pages = COLORING_PAGES,
  random = Math.random,
  excludeId = null,
  unavailableIds = new Set(),
} = {}) {
  const availablePages = pages.filter((page) => page.id !== excludeId && !unavailableIds.has(page.id));
  const candidates = availablePages.length > 0
    ? availablePages
    : pages.filter((page) => !unavailableIds.has(page.id));
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}

export function isLocalColoringPage(page) {
  return Boolean(page?.src) && page.src.startsWith(LOCAL_ASSET_PREFIX) && !/^https?:\/\//i.test(page.src);
}
