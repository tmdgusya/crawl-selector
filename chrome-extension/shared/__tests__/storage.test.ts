import { describe, it, expect } from 'vitest';
import {
  getStorageData,
  saveRecipe,
  deleteRecipe,
  setActiveRecipe,
} from '../storage';
import type { CrawlRecipe } from '../types';

function makeRecipe(overrides: Partial<CrawlRecipe> = {}): CrawlRecipe {
  return {
    id: 'r1',
    name: 'Test Recipe',
    url_pattern: 'example.com/*',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    fields: [],
    ...overrides,
  };
}

describe('getStorageData', () => {
  it('returns default when storage is empty', async () => {
    const data = await getStorageData();
    expect(data).toEqual({
      version: 1,
      recipes: {},
      activeRecipeId: null,
    });
  });

  it('returns stored data when present', async () => {
    const recipe = makeRecipe();
    await chrome.storage.local.set({
      'crawl-selector-data': {
        version: 1,
        recipes: { r1: recipe },
        activeRecipeId: 'r1',
      },
    });

    const data = await getStorageData();
    expect(data.recipes.r1).toEqual(recipe);
    expect(data.activeRecipeId).toBe('r1');
  });
});

describe('saveRecipe', () => {
  it('creates new recipe in storage', async () => {
    const recipe = makeRecipe();
    await saveRecipe(recipe);

    const data = await getStorageData();
    expect(data.recipes.r1).toEqual(recipe);
  });

  it('updates existing recipe', async () => {
    const recipe = makeRecipe();
    await saveRecipe(recipe);

    const updated = makeRecipe({ name: 'Updated Name', updated_at: '2025-06-01T00:00:00Z' });
    await saveRecipe(updated);

    const data = await getStorageData();
    expect(data.recipes.r1.name).toBe('Updated Name');
  });
});

describe('deleteRecipe', () => {
  it('removes recipe from storage', async () => {
    await saveRecipe(makeRecipe());
    await deleteRecipe('r1');

    const data = await getStorageData();
    expect(data.recipes.r1).toBeUndefined();
  });

  it('clears activeRecipeId if it matches deleted recipe', async () => {
    await saveRecipe(makeRecipe());
    await setActiveRecipe('r1');
    await deleteRecipe('r1');

    const data = await getStorageData();
    expect(data.activeRecipeId).toBeNull();
  });

  it('does not clear activeRecipeId if it does not match', async () => {
    await saveRecipe(makeRecipe({ id: 'r1' }));
    await saveRecipe(makeRecipe({ id: 'r2' }));
    await setActiveRecipe('r2');
    await deleteRecipe('r1');

    const data = await getStorageData();
    expect(data.activeRecipeId).toBe('r2');
  });
});

describe('setActiveRecipe', () => {
  it('updates activeRecipeId in storage', async () => {
    await setActiveRecipe('r1');

    const data = await getStorageData();
    expect(data.activeRecipeId).toBe('r1');
  });

  it('can set activeRecipeId to null', async () => {
    await setActiveRecipe('r1');
    await setActiveRecipe(null);

    const data = await getStorageData();
    expect(data.activeRecipeId).toBeNull();
  });
});
