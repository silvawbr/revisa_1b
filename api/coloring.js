import { createColoringHandler } from '../server/coloring-handler.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
};

export function createVercelColoringHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return createColoringHandler({ env, fetchImpl });
}

const handler = createVercelColoringHandler();

export default handler;
