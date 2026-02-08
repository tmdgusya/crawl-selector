import { vi } from 'vitest';

// In-memory storage mock
function createStorageMock() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
      if (typeof keys === 'string') {
        const val = store.get(keys);
        return val !== undefined ? { [keys]: val } : {};
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          const val = store.get(k);
          if (val !== undefined) result[k] = val;
        }
        return result;
      }
      // Object with defaults
      const result: Record<string, unknown> = {};
      for (const [k, defaultVal] of Object.entries(keys)) {
        result[k] = store.get(k) ?? defaultVal;
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const arr = typeof keys === 'string' ? [keys] : keys;
      for (const k of arr) store.delete(k);
    }),
    clear: vi.fn(async () => store.clear()),
    _store: store,
  };
}

const localMock = createStorageMock();
const sessionMock = createStorageMock();

// Global chrome mock
const chromeMock = {
  storage: {
    local: localMock,
    session: sessionMock,
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
  },
};

// Assign to globalThis
(globalThis as any).chrome = chromeMock;

// CSS.escape mock (not available in jsdom)
if (typeof CSS === 'undefined') {
  (globalThis as any).CSS = {
    escape: (value: string) => {
      return value.replace(/([^\w-])/g, '\\$1');
    },
  };
} else if (!CSS.escape) {
  CSS.escape = (value: string) => {
    return value.replace(/([^\w-])/g, '\\$1');
  };
}

// Reset storage between tests
beforeEach(() => {
  localMock._store.clear();
  sessionMock._store.clear();
  vi.clearAllMocks();
});
