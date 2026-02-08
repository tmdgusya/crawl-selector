import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { CrawlRecipe, SelectorField, ExtractConfig, TransformStep, CrawlRecipeExport, ExportField } from '../../../shared/types';
import { getStorageData, saveRecipe, deleteRecipe as deleteRecipeFromStorage, setActiveRecipe } from '../../../shared/storage';
import { guessFieldName, guessExtractConfig } from '../../../shared/helpers';

export interface PendingDuplicate {
  selector: string;
  alternatives: string[];
  attributes: Record<string, string>;
  existingFieldId: string;
  existingFieldName: string;
}

interface RecipeState {
  recipes: Record<string, CrawlRecipe>;
  activeRecipeId: string | null;
  pickerActive: boolean;
  pendingDuplicate: PendingDuplicate | null;

  // Initialization
  loadFromStorage: () => Promise<void>;

  // Recipe CRUD
  createRecipe: (name: string, urlPattern: string) => Promise<string>;
  renameRecipe: (id: string, name: string) => Promise<void>;
  switchRecipe: (id: string) => Promise<void>;
  removeRecipe: (id: string) => Promise<void>;

  // Field CRUD
  addField: (field: Omit<SelectorField, 'id'>) => Promise<void>;
  addFieldFromPicker: (selector: string, alternatives: string[], attributes: Record<string, string>) => Promise<void>;
  updateField: (fieldId: string, changes: Partial<SelectorField>) => Promise<void>;
  deleteField: (fieldId: string) => Promise<void>;

  // Duplicate resolution
  resolveDuplicate: (merge: boolean) => Promise<void>;
  clearPendingDuplicate: () => void;

  // Picker state
  setPickerActive: (active: boolean) => void;

  // Export
  exportRecipe: (recipeId: string) => CrawlRecipeExport | null;

  // Helpers
  getActiveRecipe: () => CrawlRecipe | null;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: {},
  activeRecipeId: null,
  pickerActive: false,
  pendingDuplicate: null,

  loadFromStorage: async () => {
    const data = await getStorageData();
    set({ recipes: data.recipes, activeRecipeId: data.activeRecipeId });
  },

  createRecipe: async (name, urlPattern) => {
    const id = uuid();
    const now = new Date().toISOString();
    const recipe: CrawlRecipe = {
      id,
      name,
      url_pattern: urlPattern,
      created_at: now,
      updated_at: now,
      fields: [],
    };
    await saveRecipe(recipe);
    set((s) => ({
      recipes: { ...s.recipes, [id]: recipe },
      activeRecipeId: id,
    }));
    await setActiveRecipe(id);
    return id;
  },

  renameRecipe: async (id, name) => {
    const recipe = get().recipes[id];
    if (!recipe) return;
    const updated = { ...recipe, name, updated_at: new Date().toISOString() };
    await saveRecipe(updated);
    set((s) => ({ recipes: { ...s.recipes, [id]: updated } }));
  },

  switchRecipe: async (id) => {
    await setActiveRecipe(id);
    set({ activeRecipeId: id });
  },

  removeRecipe: async (id) => {
    await deleteRecipeFromStorage(id);
    set((s) => {
      const { [id]: _, ...rest } = s.recipes;
      const recipeIds = Object.keys(rest);
      return {
        recipes: rest,
        activeRecipeId: s.activeRecipeId === id ? (recipeIds[0] ?? null) : s.activeRecipeId,
      };
    });
  },

  addField: async (fieldData) => {
    const { activeRecipeId, recipes } = get();
    if (!activeRecipeId) return;
    const recipe = recipes[activeRecipeId];
    if (!recipe) return;

    const field: SelectorField = { id: uuid(), ...fieldData };
    const updated = {
      ...recipe,
      fields: [...recipe.fields, field],
      updated_at: new Date().toISOString(),
    };
    await saveRecipe(updated);
    set((s) => ({ recipes: { ...s.recipes, [activeRecipeId]: updated } }));
  },

  addFieldFromPicker: async (selector, alternatives, attributes) => {
    const recipe = get().getActiveRecipe();
    if (!recipe) return;

    // Check for duplicate selector
    const existing = recipe.fields.find((f) => f.selector === selector);
    if (existing) {
      set({
        pendingDuplicate: {
          selector,
          alternatives,
          attributes,
          existingFieldId: existing.id,
          existingFieldName: existing.field_name,
        },
      });
      return;
    }

    const fieldName = guessFieldName(selector, attributes);
    await get().addField({
      field_name: fieldName,
      selector,
      selector_type: 'css',
      fallback_selectors: alternatives,
      extract: guessExtractConfig(selector, attributes),
      transforms: [{ type: 'trim' }],
      multiple: false,
    });
  },

  updateField: async (fieldId, changes) => {
    const { activeRecipeId, recipes } = get();
    if (!activeRecipeId) return;
    const recipe = recipes[activeRecipeId];
    if (!recipe) return;

    const updated = {
      ...recipe,
      fields: recipe.fields.map((f) => (f.id === fieldId ? { ...f, ...changes } : f)),
      updated_at: new Date().toISOString(),
    };
    await saveRecipe(updated);
    set((s) => ({ recipes: { ...s.recipes, [activeRecipeId]: updated } }));
  },

  deleteField: async (fieldId) => {
    const { activeRecipeId, recipes } = get();
    if (!activeRecipeId) return;
    const recipe = recipes[activeRecipeId];
    if (!recipe) return;

    const updated = {
      ...recipe,
      fields: recipe.fields.filter((f) => f.id !== fieldId),
      updated_at: new Date().toISOString(),
    };
    await saveRecipe(updated);
    set((s) => ({ recipes: { ...s.recipes, [activeRecipeId]: updated } }));
  },

  resolveDuplicate: async (merge) => {
    const { pendingDuplicate } = get();
    if (!pendingDuplicate) return;

    // Clear pendingDuplicate FIRST to hide the toast immediately
    set({ pendingDuplicate: null });

    if (merge) {
      try {
        await get().updateField(pendingDuplicate.existingFieldId, { multiple: true });
      } catch (error) {
        console.error('Failed to update field:', error);
      }
    } else {
      // Add new field with same selector
      try {
        const fieldName = guessFieldName(pendingDuplicate.selector, pendingDuplicate.attributes);
        await get().addField({
          field_name: fieldName,
          selector: pendingDuplicate.selector,
          selector_type: 'css',
          fallback_selectors: pendingDuplicate.alternatives,
          extract: guessExtractConfig(pendingDuplicate.selector, pendingDuplicate.attributes),
          transforms: [{ type: 'trim' }],
          multiple: false,
        });
      } catch (error) {
        console.error('Failed to add field:', error);
      }
    }
  },

  clearPendingDuplicate: () => set({ pendingDuplicate: null }),

  setPickerActive: (active) => set({ pickerActive: active }),

  exportRecipe: (recipeId) => {
    const recipe = get().recipes[recipeId];
    if (!recipe) return null;

    const fields: ExportField[] = recipe.fields.map((f) => {
      const exported: ExportField = {
        field_name: f.field_name,
        selector: f.selector,
        selector_type: f.selector_type,
        extract: f.extract,
        transforms: f.transforms,
        multiple: f.multiple,
      };
      if (f.fallback_selectors.length > 0) exported.fallback_selectors = f.fallback_selectors;
      if (f.list_container) exported.list_container = f.list_container;
      return exported;
    });

    const result: CrawlRecipeExport = {
      $schema: 'https://crawl-bot/recipe.schema.json',
      name: recipe.name,
      url_pattern: recipe.url_pattern,
      version: '1.0',
      fields,
    };

    if (recipe.pagination) result.pagination = recipe.pagination;
    return result;
  },

  getActiveRecipe: () => {
    const { activeRecipeId, recipes } = get();
    if (!activeRecipeId) return null;
    return recipes[activeRecipeId] ?? null;
  },
}));

