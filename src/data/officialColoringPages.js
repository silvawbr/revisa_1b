/**
 * @typedef {Object} OfficialColoringPage
 * @property {string} id
 * @property {string} title
 * @property {string} provider
 * @property {string} url
 * @property {string} sourcePage
 * @property {true} external
 */

export const OFFICIAL_COLORING_PAGE_HISTORY_KEY = 'revisao-matematica.officialColoringPages.v1';
export const OFFICIAL_COLORING_PAGE_HISTORY_LIMIT = 3;

/** @type {readonly OfficialColoringPage[]} */
export const OFFICIAL_COLORING_PAGES = Object.freeze([
  {
    id: 'disney-encanto',
    title: 'Encanto',
    provider: 'Disney Books',
    url: 'https://books.disney.com/content/uploads/2022/03/ENCANTO-COLORING-D-WORKSHEET99-scaled.jpg',
    sourcePage: 'https://books.disney.com/activity-sheets/',
    external: true,
  },
  {
    id: 'disney-frozen',
    title: 'Frozen',
    provider: 'Disney Books',
    url: 'https://books.disney.com/content/uploads/2019/10/Frozen_ActivityKit_FINAL1.pdf',
    sourcePage: 'https://books.disney.com/activity-sheets/',
    external: true,
  },
  {
    id: 'disney-activity-sheets',
    title: 'Disney, Pixar, Bluey e outras histórias',
    provider: 'Disney Books',
    url: 'https://books.disney.com/activity-sheets/',
    sourcePage: 'https://books.disney.com/activity-sheets/',
    external: true,
  },
  {
    id: 'disney-mira',
    title: 'Mira, Royal Detective',
    provider: 'Disney',
    url: 'https://news.disney.com/mira-royal-detective-coloring-pages',
    sourcePage: 'https://news.disney.com/mira-royal-detective-coloring-pages',
    external: true,
  },
  {
    id: 'lego-friends',
    title: 'LEGO Friends',
    provider: 'LEGOLAND Florida',
    url: 'https://www.legoland.com/florida/blog/lego-friends-weekends-coloring-sheets/',
    sourcePage: 'https://www.legoland.com/florida/blog/lego-friends-weekends-coloring-sheets/',
    external: true,
  },
  {
    id: 'daniel-tiger',
    title: 'Daniel Tiger',
    provider: 'PBS KIDS',
    url: 'https://www.pbs.org/parents/shows/daniel/daniel-coloring-pages',
    sourcePage: 'https://www.pbs.org/parents/shows/daniel/daniel-coloring-pages',
    external: true,
  },
  {
    id: 'crayola-coloring-pages',
    title: 'Crayola',
    provider: 'Crayola',
    url: 'https://www.crayola.com/free-coloring-pages',
    sourcePage: 'https://www.crayola.com/free-coloring-pages',
    external: true,
  },
]);

export function pickOfficialColoringPage({
  pages = OFFICIAL_COLORING_PAGES,
  random = Math.random,
  excludeId = null,
  recentIds = [],
} = {}) {
  const availablePages = pages.filter((page) => page.id !== excludeId);
  const recent = new Set(recentIds);
  const freshPages = availablePages.filter((page) => !recent.has(page.id));
  const candidates = freshPages.length > 0 ? freshPages : availablePages;
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}
