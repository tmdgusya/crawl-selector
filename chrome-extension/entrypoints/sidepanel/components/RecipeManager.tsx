import { useState, useCallback } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { PlusIcon, TrashIcon } from './Icons';

/** Strip protocol and convert URL to a glob-like pattern. */
function urlToPattern(url: string): string {
  try {
    const u = new URL(url);
    // e.g. "https://news.ycombinator.com/item?id=123" → "news.ycombinator.com/item*"
    const path = u.pathname === '/' ? '/*' : u.pathname + '*';
    return u.hostname + path;
  } catch {
    return url;
  }
}

export function RecipeManager() {
  const { recipes, activeRecipeId, createRecipe, switchRecipe, removeRecipe } =
    useRecipeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const recipeList = Object.values(recipes);
  const activeRecipe = activeRecipeId ? recipes[activeRecipeId] : null;
  const fieldCount = activeRecipe?.fields.length ?? 0;

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createRecipe(newName.trim(), newUrl.trim() || '*');
    setNewName('');
    setNewUrl('');
    setShowCreate(false);
  }, [newName, newUrl, createRecipe]);

  const handleDelete = useCallback(() => {
    if (activeRecipeId && confirm('Delete this recipe?')) {
      removeRecipe(activeRecipeId);
    }
  }, [activeRecipeId, removeRecipe]);

  return (
    <div
      className="bg-surface-card rounded-lg border border-border-default p-3 shadow-xs"
      role="region"
      aria-label="Recipe management"
    >
      {/* Recipe dropdown */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="recipe-select"
          className="text-[11px] font-medium text-text-muted uppercase tracking-wider shrink-0"
        >
          Recipe
        </label>
        {recipeList.length > 0 ? (
          <div className="flex-1 flex items-center gap-1.5">
            <select
              id="recipe-select"
              value={activeRecipeId ?? ''}
              onChange={(e) => switchRecipe(e.target.value)}
              className="flex-1 text-sm border border-border-default rounded-md px-2 py-1 bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
              aria-label="Select active recipe"
            >
              {recipeList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.fields.length})
                </option>
              ))}
            </select>
            {fieldCount > 0 && (
              <span
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold tabular-nums"
                aria-label={`${fieldCount} field${fieldCount !== 1 ? 's' : ''}`}
              >
                {fieldCount}
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1 text-xs text-text-muted italic">
            No recipes yet — create one to start
          </div>
        )}
        <button
          onClick={async () => {
            if (showCreate) {
              setShowCreate(false);
              return;
            }
            // Pre-fill with current tab info
            try {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tab) {
                setNewName(tab.title ?? '');
                setNewUrl(tab.url ? urlToPattern(tab.url) : '');
              }
            } catch {
              // Fallback: leave fields empty
            }
            setShowCreate(true);
          }}
          className="btn-press focus-ring inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-xs"
          aria-label="Create new recipe"
          aria-expanded={showCreate}
        >
          <PlusIcon size={12} /> New
        </button>
        {activeRecipeId && (
          <button
            onClick={handleDelete}
            className="btn-press focus-ring p-1.5 rounded-md text-danger-500 hover:bg-danger-50 transition-colors"
            aria-label={`Delete recipe ${activeRecipe?.name ?? ''}`}
            title="Delete recipe"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>

      {/* URL pattern display */}
      {activeRecipe && (
        <div
          className="mt-2 text-[11px] text-text-muted font-mono truncate"
          title={activeRecipe.url_pattern}
          aria-label={`URL pattern: ${activeRecipe.url_pattern}`}
        >
          {activeRecipe.url_pattern}
        </div>
      )}

      {/* Create new recipe form */}
      {showCreate && (
        <div className="mt-3 space-y-2 border-t border-border-subtle pt-3" role="form" aria-label="Create new recipe">
          <input
            type="text"
            placeholder="Recipe name (e.g. Amazon Products)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full text-sm border border-border-default rounded-md px-2.5 py-1.5 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
            aria-label="Recipe name"
            autoFocus
          />
          <input
            type="text"
            placeholder="URL pattern (e.g. amazon.com/dp/*)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full text-sm border border-border-default rounded-md px-2.5 py-1.5 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
            aria-label="URL pattern"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="btn-press focus-ring text-xs px-3 py-1.5 rounded-md bg-success-500 text-white hover:bg-success-600 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Create recipe"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="btn-press focus-ring text-xs px-3 py-1.5 rounded-md bg-surface-inset text-text-secondary hover:bg-border-default transition-colors"
              aria-label="Cancel creation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
