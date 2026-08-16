import { createTtsHandler } from '../server/tts-handler.js';

// Preserve the raw request stream so the shared handler can enforce its own
// body-size limit and reject malformed or unsupported payloads consistently.
export const config = {
  api: {
    bodyParser: false,
  },
};

export function createVercelHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console.info,
} = {}) {
  const tts = createTtsHandler({ env, fetchImpl, logger });
  return function handler(request, response) {
    return tts.handle(request, response);
  };
}

// The provider is created once per warm function instance. Correctness never
// depends on that instance-level cache surviving another invocation.
const handler = createVercelHandler({
  env: process.env,
  logger: console.info,
});

export default handler;
