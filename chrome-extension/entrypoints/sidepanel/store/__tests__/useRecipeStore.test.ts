import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecipeStore } from '../useRecipeStore';
import type { FieldTestResult } from '../../../../shared/types';

const store = () => useRecipeStore.getState();

beforeEach(() => {
  // Reset store to initial state between tests
  useRecipeStore.setState({
    recipes: {},
    activeRecipeId: null,
    pickerActive: false,
    pendingDuplicate: null,
    testResults: {},
    testRunning: false,
    fieldTesting: null,
    fullTestResult: null,
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

// ── Test action tests ──

const mockSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

function makeSuccessResult(overrides?: Partial<FieldTestResult>): FieldTestResult {
  return {
    success: true,
    raw: 'Hello',
    transformed: 'Hello',
    matchCount: 1,
    usedSelector: '.title',
    timestamp: Date.now(),
    ...overrides,
  };
}

async function setupRecipeWithField() {
  const recipeId = await store().createRecipe('Test', 'example.com/*');
  await store().addField({
    field_name: 'title',
    selector: '.title',
    selector_type: 'css',
    fallback_selectors: ['.alt-title'],
    extract: { type: 'text' },
    transforms: [{ type: 'trim' }],
    multiple: false,
  });
  const field = store().recipes[recipeId].fields[0];
  return { recipeId, field };
}

describe('testField', () => {
  it('sends EXTRACT_FIELD message and updates testResults on success', async () => {
    const { field } = await setupRecipeWithField();
    const mockResult = makeSuccessResult({ usedSelector: '.title' });
    mockSendMessage.mockResolvedValueOnce({ result: mockResult });

    await store().testField(field.id);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'EXTRACT_FIELD',
      field,
    });
    expect(store().testResults[field.id]).toEqual(mockResult);
    expect(store().fieldTesting).toBeNull();
  });

  it('sets fieldTesting while running', async () => {
    const { field } = await setupRecipeWithField();
    // Use a deferred promise to check intermediate state
    let resolveMsg!: (val: unknown) => void;
    mockSendMessage.mockReturnValueOnce(
      new Promise((r) => { resolveMsg = r; })
    );

    const promise = store().testField(field.id);
    expect(store().fieldTesting).toBe(field.id);

    resolveMsg({ result: makeSuccessResult() });
    await promise;
    expect(store().fieldTesting).toBeNull();
  });

  it('stores error result when response has no result', async () => {
    const { field } = await setupRecipeWithField();
    mockSendMessage.mockResolvedValueOnce({});

    await store().testField(field.id);

    const result = store().testResults[field.id];
    expect(result.success).toBe(false);
    expect(result.error).toBe('응답을 받지 못했습니다');
    expect(store().fieldTesting).toBeNull();
  });

  it('stores error result when sendMessage throws', async () => {
    const { field } = await setupRecipeWithField();
    mockSendMessage.mockRejectedValueOnce(new Error('No tab'));

    await store().testField(field.id);

    const result = store().testResults[field.id];
    expect(result.success).toBe(false);
    expect(result.error).toBe('이 페이지에서는 테스트할 수 없습니다');
    expect(result.usedSelector).toBe('.title');
    expect(store().fieldTesting).toBeNull();
  });

  it('does nothing when no active recipe', async () => {
    await store().testField('nonexistent');

    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXTRACT_FIELD' })
    );
  });
});

describe('testAllFields', () => {
  it('sends EXTRACT_ALL_FIELDS for content-script mode and updates fullTestResult', async () => {
    const { field } = await setupRecipeWithField();
    const mockResults = { [field.id]: makeSuccessResult() };
    mockSendMessage.mockResolvedValueOnce({ results: mockResults });

    await store().testAllFields('content-script');

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'EXTRACT_ALL_FIELDS',
      fields: [field],
    });

    const full = store().fullTestResult;
    expect(full).not.toBeNull();
    expect(full!.source).toBe('content-script');
    expect(full!.fields[field.id]).toEqual(mockResults[field.id]);
    expect(store().testRunning).toBe(false);
  });

  it('sends FETCH_AND_EXTRACT for fetch mode with url', async () => {
    const { field } = await setupRecipeWithField();
    const mockResults = { [field.id]: makeSuccessResult() };
    mockSendMessage.mockResolvedValueOnce({ results: mockResults });

    await store().testAllFields('fetch', 'https://example.com/page');

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'FETCH_AND_EXTRACT',
      url: 'https://example.com/page',
      fields: [field],
    });

    const full = store().fullTestResult;
    expect(full).not.toBeNull();
    expect(full!.source).toBe('fetch');
    expect(full!.url).toBe('https://example.com/page');
    expect(full!.fields[field.id]).toEqual(mockResults[field.id]);
  });

  it('returns early for fetch mode without url', async () => {
    await setupRecipeWithField();

    await store().testAllFields('fetch');

    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FETCH_AND_EXTRACT' })
    );
    expect(store().testRunning).toBe(false);
    expect(store().fullTestResult).toBeNull();
  });

  it('handles fetch error response with error field', async () => {
    const { field } = await setupRecipeWithField();
    mockSendMessage.mockResolvedValueOnce({ error: '네트워크 오류가 발생했습니다' });

    await store().testAllFields('fetch', 'https://invalid.example');

    const full = store().fullTestResult;
    expect(full).not.toBeNull();
    expect(full!.source).toBe('fetch');
    expect(full!.fields[field.id].success).toBe(false);
    expect(full!.fields[field.id].error).toBe('네트워크 오류가 발생했습니다');
    expect(store().testRunning).toBe(false);
  });

  it('sets testRunning while running', async () => {
    await setupRecipeWithField();
    let resolveMsg!: (val: unknown) => void;
    mockSendMessage.mockReturnValueOnce(
      new Promise((r) => { resolveMsg = r; })
    );

    const promise = store().testAllFields('content-script');
    expect(store().testRunning).toBe(true);

    resolveMsg({ results: {} });
    await promise;
    expect(store().testRunning).toBe(false);
  });

  it('handles sendMessage exception with error results for all fields', async () => {
    const { field } = await setupRecipeWithField();
    mockSendMessage.mockRejectedValueOnce(new Error('Extension error'));

    await store().testAllFields('content-script');

    const full = store().fullTestResult;
    expect(full).not.toBeNull();
    expect(full!.source).toBe('content-script');
    expect(full!.fields[field.id].success).toBe(false);
    expect(full!.fields[field.id].error).toBe('이 페이지에서는 테스트할 수 없습니다');
    expect(store().testRunning).toBe(false);
  });

  it('does nothing when no active recipe', async () => {
    await store().testAllFields('content-script');

    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXTRACT_ALL_FIELDS' })
    );
  });
});

describe('clearTestResults', () => {
  it('resets all test state to initial values', async () => {
    const { field } = await setupRecipeWithField();
    // Seed some test state
    useRecipeStore.setState({
      testResults: { [field.id]: makeSuccessResult() },
      testRunning: true,
      fieldTesting: field.id,
      fullTestResult: {
        url: 'https://example.com',
        extractedAt: new Date().toISOString(),
        fields: { [field.id]: makeSuccessResult() },
        source: 'content-script',
      },
    });

    store().clearTestResults();

    expect(store().testResults).toEqual({});
    expect(store().testRunning).toBe(false);
    expect(store().fieldTesting).toBeNull();
    expect(store().fullTestResult).toBeNull();
  });

  it('does not affect recipe or field data', async () => {
    const { recipeId, field } = await setupRecipeWithField();
    useRecipeStore.setState({
      testResults: { [field.id]: makeSuccessResult() },
    });

    store().clearTestResults();

    expect(store().recipes[recipeId]).toBeDefined();
    expect(store().recipes[recipeId].fields).toHaveLength(1);
    expect(store().activeRecipeId).toBe(recipeId);
  });
});
