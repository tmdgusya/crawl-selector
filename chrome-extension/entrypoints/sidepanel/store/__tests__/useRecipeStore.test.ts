import { describe, it, expect, beforeEach } from 'vitest';
import { useRecipeStore } from '../useRecipeStore';

const store = () => useRecipeStore.getState();

beforeEach(() => {
  // Reset store to initial state between tests
  useRecipeStore.setState({
    recipes: {},
    activeRecipeId: null,
    pickerActive: false,
    pendingDuplicate: null,
  });
});

describe('createRecipe', () => {
  it('adds a recipe to the store and sets it as active', async () => {
    const id = await store().createRecipe('Test Recipe', 'example.com/*');

    expect(id).toBeTruthy();
    expect(store().recipes[id]).toBeDefined();
    expect(store().recipes[id].name).toBe('Test Recipe');
    expect(store().recipes[id].url_pattern).toBe('example.com/*');
    expect(store().recipes[id].fields).toEqual([]);
    expect(store().activeRecipeId).toBe(id);
  });

  it('persists recipe to chrome.storage', async () => {
    await store().createRecipe('Persisted', '*');

    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});

describe('addField', () => {
  it('appends a field to the active recipe', async () => {
    const recipeId = await store().createRecipe('Test', '*');
    await store().addField({
      field_name: 'title',
      selector: '.title',
      selector_type: 'css',
      fallback_selectors: [],
      extract: { type: 'text' },
      transforms: [{ type: 'trim' }],
      multiple: false,
    });

    const recipe = store().recipes[recipeId];
    expect(recipe.fields).toHaveLength(1);
    expect(recipe.fields[0].field_name).toBe('title');
    expect(recipe.fields[0].selector).toBe('.title');
    expect(recipe.fields[0].id).toBeTruthy();
  });
});

describe('addFieldFromPicker', () => {
  it('adds a field when the selector is unique', async () => {
    const recipeId = await store().createRecipe('Test', '*');
    await store().addFieldFromPicker('.product-name', ['.alt-selector'], { class: 'product-name' });

    const recipe = store().recipes[recipeId];
    expect(recipe.fields).toHaveLength(1);
    expect(recipe.fields[0].selector).toBe('.product-name');
    expect(store().pendingDuplicate).toBeNull();
  });

  it('sets pendingDuplicate when the selector already exists', async () => {
    const recipeId = await store().createRecipe('Test', '*');
    // Add first field
    await store().addFieldFromPicker('.product-name', ['.alt1'], { class: 'product-name' });
    const existingField = store().recipes[recipeId].fields[0];

    // Try to add with same selector
    await store().addFieldFromPicker('.product-name', ['.alt2'], { class: 'product-name' });

    // Should NOT add a second field
    expect(store().recipes[recipeId].fields).toHaveLength(1);

    // Should set pendingDuplicate
    const pending = store().pendingDuplicate;
    expect(pending).not.toBeNull();
    expect(pending!.selector).toBe('.product-name');
    expect(pending!.existingFieldId).toBe(existingField.id);
    expect(pending!.existingFieldName).toBe(existingField.field_name);
    expect(pending!.alternatives).toEqual(['.alt2']);
  });
});

describe('resolveDuplicate', () => {
  async function setupDuplicate() {
    const recipeId = await store().createRecipe('Test', '*');
    await store().addFieldFromPicker('.item-link', [], { href: '/page', class: 'item-link' });
    // Trigger duplicate
    await store().addFieldFromPicker('.item-link', ['.alt'], { href: '/page2', class: 'item-link' });
    return recipeId;
  }

  it('merge=true sets multiple: true on the existing field', async () => {
    const recipeId = await setupDuplicate();
    expect(store().pendingDuplicate).not.toBeNull();

    await store().resolveDuplicate(true);

    const recipe = store().recipes[recipeId];
    expect(recipe.fields).toHaveLength(1);
    expect(recipe.fields[0].multiple).toBe(true);
    expect(store().pendingDuplicate).toBeNull();
  });

  it('merge=false adds a new field with the same selector', async () => {
    const recipeId = await setupDuplicate();
    expect(store().pendingDuplicate).not.toBeNull();

    await store().resolveDuplicate(false);

    const recipe = store().recipes[recipeId];
    expect(recipe.fields).toHaveLength(2);
    expect(recipe.fields[0].selector).toBe('.item-link');
    expect(recipe.fields[1].selector).toBe('.item-link');
    expect(recipe.fields[0].multiple).toBe(false); // original unchanged
    expect(store().pendingDuplicate).toBeNull();
  });

  it('does nothing if there is no pending duplicate', async () => {
    await store().createRecipe('Test', '*');
    await store().resolveDuplicate(true);
    // No error thrown, no state change
    expect(store().pendingDuplicate).toBeNull();
  });
});

describe('deleteField', () => {
  it('removes a field from the recipe', async () => {
    const recipeId = await store().createRecipe('Test', '*');
    await store().addFieldFromPicker('.title', [], { class: 'title' });
    await store().addFieldFromPicker('.price', [], { class: 'price' });

    const fieldId = store().recipes[recipeId].fields[0].id;
    await store().deleteField(fieldId);

    const recipe = store().recipes[recipeId];
    expect(recipe.fields).toHaveLength(1);
    expect(recipe.fields[0].selector).toBe('.price');
  });
});

describe('exportRecipe', () => {
  it('returns correct JSON shape', async () => {
    const recipeId = await store().createRecipe('My Recipe', 'example.com/*');
    await store().addFieldFromPicker('.title', ['.fallback'], { class: 'title' });

    const exported = store().exportRecipe(recipeId);
    expect(exported).not.toBeNull();
    expect(exported!.$schema).toBe('https://crawl-bot/recipe.schema.json');
    expect(exported!.name).toBe('My Recipe');
    expect(exported!.url_pattern).toBe('example.com/*');
    expect(exported!.version).toBe('1.0');
    expect(exported!.fields).toHaveLength(1);
    expect(exported!.fields[0].field_name).toBe('title');
    expect(exported!.fields[0].selector).toBe('.title');
    expect(exported!.fields[0].fallback_selectors).toEqual(['.fallback']);
    expect(exported!.fields[0].extract).toEqual({ type: 'text' });
    expect(exported!.fields[0].multiple).toBe(false);
  });

  it('returns null for non-existent recipe', () => {
    expect(store().exportRecipe('nonexistent')).toBeNull();
  });

  it('omits fallback_selectors when empty', async () => {
    const recipeId = await store().createRecipe('Test', '*');
    await store().addFieldFromPicker('.title', [], { class: 'title' });

    const exported = store().exportRecipe(recipeId);
    expect(exported!.fields[0].fallback_selectors).toBeUndefined();
  });
});

describe('clearPendingDuplicate', () => {
  it('clears the pending duplicate state', async () => {
    await store().createRecipe('Test', '*');
    await store().addFieldFromPicker('.item', [], { class: 'item' });
    await store().addFieldFromPicker('.item', [], { class: 'item' });
    expect(store().pendingDuplicate).not.toBeNull();

    store().clearPendingDuplicate();
    expect(store().pendingDuplicate).toBeNull();
  });
});
