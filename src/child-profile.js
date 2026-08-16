export const CHILD_NAME_STORAGE_KEY = 'revisao-matematica.childName.v1';
export const MAX_CHILD_NAME_LENGTH = 40;

const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u;
const NAME_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

export function normalizeChildName(value) {
  if (typeof value !== 'string' || CONTROL_CHARACTER_PATTERN.test(value)) return '';

  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized || Array.from(normalized).length > MAX_CHILD_NAME_LENGTH) return '';
  if (!NAME_CHARACTER_PATTERN.test(normalized)) return '';
  return normalized;
}

export function isValidChildName(value) {
  return Boolean(normalizeChildName(value));
}

export function formatChildText(template, childName) {
  const normalizedName = normalizeChildName(childName);
  if (!normalizedName || typeof template !== 'string') return '';
  return template.replaceAll('{name}', normalizedName);
}

export function getNeutralSpeechText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/gu, ' ').trim();
}

function containsChildName(text, childName) {
  const escapedName = childName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedName}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export function createPersonalizedMessage({ childName, visualTemplate, speechText }) {
  const visualText = formatChildText(visualTemplate, childName);
  const neutralSpeechText = getNeutralSpeechText(speechText);
  if (!visualText || !neutralSpeechText) {
    throw new TypeError('Uma mensagem personalizada precisa de nome e texto de voz.');
  }
  if (containsChildName(neutralSpeechText, normalizeChildName(childName))) {
    throw new TypeError('O texto de voz de uma mensagem personalizada não pode conter o nome da criança.');
  }
  return Object.freeze({ visualText, speechText: neutralSpeechText });
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createChildProfileStore({ storage } = {}) {
  let storageRef = resolveStorage(storage);
  let memoryName = null;

  function readStoredName() {
    if (!storageRef) return null;
    try {
      const rawValue = storageRef.getItem(CHILD_NAME_STORAGE_KEY);
      const normalized = normalizeChildName(rawValue);
      if (normalized) return normalized;
      if (rawValue !== null) storageRef.removeItem(CHILD_NAME_STORAGE_KEY);
    } catch {
      storageRef = null;
    }
    return null;
  }

  return {
    getName() {
      const storedName = readStoredName();
      if (storedName) {
        memoryName = storedName;
        return storedName;
      }
      return memoryName;
    },

    saveName(value) {
      const normalized = normalizeChildName(value);
      if (!normalized) return null;

      memoryName = normalized;
      if (storageRef) {
        try {
          storageRef.setItem(CHILD_NAME_STORAGE_KEY, normalized);
        } catch {
          // A blocked or full localStorage must not block the current session.
          storageRef = null;
        }
      }
      return normalized;
    },

    clearName() {
      memoryName = null;
      if (!storageRef) return;
      try {
        storageRef.removeItem(CHILD_NAME_STORAGE_KEY);
      } catch {
        storageRef = null;
      }
    },
  };
}
