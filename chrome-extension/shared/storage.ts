import type { StorageSchema, CrawlRecipe, SessionState } from './types';

const STORAGE_KEY = 'crawl-selector-data';
const DEFAULT_STORAGE: StorageSchema = {
  version: 1,
  recipes: {},
  activeRecipeId: null,
};

// ── Persistent storage (chrome.storage.local) ──

export async function getStorageData(): Promise<StorageSchema> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageSchema | undefined) ?? DEFAULT_STORAGE;
}

export async function setStorageData(data: StorageSchema): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

export async function updateStorageData(
  updater: (data: StorageSchema) => StorageSchema,
): Promise<StorageSchema> {
  const current = await getStorageData();
  const updated = updater(current);
  await setStorageData(updated);
  return updated;
}

// ── Recipe helpers ──

export async function saveRecipe(recipe: CrawlRecipe): Promise<void> {
  await updateStorageData((data) => ({
    ...data,
    recipes: { ...data.recipes, [recipe.id]: recipe },
  }));
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await updateStorageData((data) => {
    const { [recipeId]: _, ...rest } = data.recipes;
    return {
      ...data,
      recipes: rest,
      activeRecipeId: data.activeRecipeId === recipeId ? null : data.activeRecipeId,
    };
  });
}

export async function setActiveRecipe(recipeId: string | null): Promise<void> {
  await updateStorageData((data) => ({ ...data, activeRecipeId: recipeId }));
}

// ── Session state (chrome.storage.session — ephemeral, cleared on browser restart) ──

const SESSION_KEY = 'crawl-selector-session';
const DEFAULT_SESSION: SessionState = {
  pickerActive: false,
  hoveredSelector: null,
  hoveredMatchCount: 0,
  currentTabId: null,
};

export async function getSessionState(): Promise<SessionState> {
  const result = await chrome.storage.session.get(SESSION_KEY);
  return (result[SESSION_KEY] as SessionState | undefined) ?? DEFAULT_SESSION;
}

export async function setSessionState(state: Partial<SessionState>): Promise<void> {
  const current = await getSessionState();
  await chrome.storage.session.set({ [SESSION_KEY]: { ...current, ...state } });
}
