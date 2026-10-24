export const AV2_SUBTRACTION_PROGRESS_STORAGE_KEY = 'av2-matematica.block-04.subtracao.progress.v1';
export const AV2_MONEY_COMPOSITION_PROGRESS_STORAGE_KEY = 'av2-matematica.block-06.formar-quantias.progress.v1';
export const AV2_PROGRESS_STORAGE_KEY = 'av2-matematica.block-01.dinheiro.progress.v1';
export const AV2_SHOPPING_PROGRESS_STORAGE_KEY = 'av2-matematica.block-02.compras.progress.v1';
export const AV2_ADDITION_PROGRESS_STORAGE_KEY = 'av2-matematica.block-03.adicao.progress.v1';

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeProgress(value) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.roundsCompleted) || value.roundsCompleted < 0) {
    return { version: 1, roundsCompleted: 0 };
  }
  return { version: 1, roundsCompleted: value.roundsCompleted };
}

export function createAv2ProgressStore({ storage = getDefaultStorage(), key = AV2_PROGRESS_STORAGE_KEY } = {}) {
  let memoryProgress = { version: 1, roundsCompleted: 0 };

  function get() {
    if (!storage) return { roundsCompleted: memoryProgress.roundsCompleted };
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? 'null');
      memoryProgress = normalizeProgress(parsed);
    } catch {
      return { roundsCompleted: memoryProgress.roundsCompleted };
    }
    return { roundsCompleted: memoryProgress.roundsCompleted };
  }

  function completeRound() {
    memoryProgress = { version: 1, roundsCompleted: get().roundsCompleted + 1 };
    try {
      storage?.setItem(key, JSON.stringify(memoryProgress));
    } catch {
      // Progress remains available in memory for this session.
    }
    return { roundsCompleted: memoryProgress.roundsCompleted };
  }

  return Object.freeze({ get, completeRound, key });
}
