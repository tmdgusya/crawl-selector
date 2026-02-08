import { useState, useMemo, useCallback } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { CopyIcon, DownloadIcon, UploadIcon, CheckIcon, ChevronDownIcon } from './Icons';

export function ExportPanel() {
  const { activeRecipeId, exportRecipe, recipes } = useRecipeStore();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!activeRecipeId) return null;

  const recipe = recipes[activeRecipeId];
  if (!recipe) return null;

  const previewJson = useMemo(() => {
    if (!showPreview) return '';
    const exported = exportRecipe(activeRecipeId!);
    return exported ? JSON.stringify(exported, null, 2) : '';
  }, [showPreview, activeRecipeId, exportRecipe]);

  const handleCopy = useCallback(() => {
    const exported = exportRecipe(activeRecipeId!);
    if (!exported) return;
    const json = JSON.stringify(exported, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeRecipeId, exportRecipe]);

  const handleDownload = useCallback(() => {
    const exported = exportRecipe(activeRecipeId!);
    if (!exported) return;
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipe.name.replace(/\s+/g, '-').toLowerCase()}.recipe.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeRecipeId, exportRecipe, recipe.name]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.fields && data.name) {
          const store = useRecipeStore.getState();
          await store.createRecipe(data.name, data.url_pattern || '*');
          for (const f of data.fields) {
            await store.addField({
              field_name: f.field_name || 'imported_field',
              selector: f.selector || '',
              selector_type: f.selector_type || 'css',
              fallback_selectors: f.fallback_selectors || [],
              extract: f.extract || { type: 'text' },
              transforms: f.transforms || [],
              multiple: f.multiple || false,
              list_container: f.list_container,
            });
          }
        }
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    input.click();
  }, []);

  return (
    <div role="region" aria-label="Export and import" className="space-y-2">
      {/* Field count summary */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          Export
        </span>
        <span className="text-[11px] text-text-muted tabular-nums">
          {recipe.fields.length} field{recipe.fields.length !== 1 ? 's' : ''} in recipe
        </span>
      </div>

      {/* JSON preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="focus-ring w-full flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-md bg-surface-card border border-border-default text-text-secondary hover:bg-surface-inset transition-colors"
        aria-expanded={showPreview}
        aria-controls="json-preview"
      >
        <span>Preview JSON</span>
        <ChevronDownIcon
          size={12}
          className={`transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`}
        />
      </button>

      {showPreview && (
        <pre
          id="json-preview"
          className="text-[10px] font-mono text-text-secondary bg-surface-card border border-border-default rounded-md p-2.5 max-h-48 overflow-auto whitespace-pre"
          aria-label="JSON export preview"
        >
          {previewJson}
        </pre>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className={`btn-press focus-ring flex-1 py-2 px-3 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all duration-150 ${
            copied
              ? 'bg-success-50 text-success-600 border border-success-500/30'
              : 'bg-surface-card border border-border-default text-text-secondary hover:bg-surface-inset hover:border-border-default shadow-xs'
          }`}
          aria-label={copied ? 'JSON copied to clipboard' : 'Copy recipe JSON to clipboard'}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="btn-press focus-ring flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-surface-card border border-border-default text-text-secondary hover:bg-surface-inset hover:border-border-default shadow-xs transition-colors inline-flex items-center justify-center gap-1.5"
          aria-label={`Download recipe as ${recipe.name.replace(/\s+/g, '-').toLowerCase()}.recipe.json`}
        >
          <DownloadIcon size={13} />
          Export
        </button>
        <button
          onClick={handleImport}
          className="btn-press focus-ring flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-surface-card border border-border-default text-text-secondary hover:bg-surface-inset hover:border-border-default shadow-xs transition-colors inline-flex items-center justify-center gap-1.5"
          aria-label="Import recipe from JSON file"
        >
          <UploadIcon size={13} />
          Import
        </button>
      </div>
    </div>
  );
}
