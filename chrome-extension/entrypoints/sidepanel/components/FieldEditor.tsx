import { useState, useRef, useCallback } from 'react';
import type { SelectorField, ExtractConfig, TransformStep } from '../../../shared/types';
import { useRecipeStore } from '../store/useRecipeStore';
import { ChevronDownIcon } from './Icons';

interface Props {
  field: SelectorField;
}

const EXTRACT_OPTIONS = [
  { value: 'text', label: 'Text Content' },
  { value: 'html', label: 'Inner HTML' },
  { value: 'attribute:href', label: 'Attribute: href' },
  { value: 'attribute:src', label: 'Attribute: src' },
  { value: 'attribute:alt', label: 'Attribute: alt' },
  { value: 'attribute:title', label: 'Attribute: title' },
];

const TRANSFORM_OPTIONS: TransformStep['type'][] = [
  'trim',
  'strip_html',
  'extract_number',
  'regex',
  'replace',
  'default',
];

export function FieldEditor({ field }: Props) {
  const { updateField } = useRecipeStore();
  const [selectorInput, setSelectorInput] = useState(field.selector);
  const [customAttr, setCustomAttr] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSelectorChange = useCallback((value: string) => {
    setSelectorInput(value);
    // Debounce storage writes to avoid excessive updates
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateField(field.id, { selector: value });
    }, 300);
  }, [field.id, updateField]);

  const handleExtractChange = useCallback((value: string) => {
    let extract: ExtractConfig;
    if (value.startsWith('attribute:')) {
      extract = { type: 'attribute', attribute: value.split(':')[1] };
    } else {
      extract = { type: value as 'text' | 'html' };
    }
    updateField(field.id, { extract });
  }, [field.id, updateField]);

  const handleCustomAttribute = useCallback(() => {
    if (!customAttr.trim()) return;
    updateField(field.id, { extract: { type: 'attribute', attribute: customAttr.trim() } });
    setCustomAttr('');
  }, [customAttr, field.id, updateField]);

  const toggleTransform = useCallback((type: TransformStep['type']) => {
    const existing = field.transforms.find((t) => t.type === type);
    if (existing) {
      updateField(field.id, { transforms: field.transforms.filter((t) => t.type !== type) });
    } else {
      updateField(field.id, { transforms: [...field.transforms, { type }] });
    }
  }, [field.id, field.transforms, updateField]);

  const toggleMultiple = useCallback(() => {
    updateField(field.id, { multiple: !field.multiple });
  }, [field.id, field.multiple, updateField]);

  const currentExtract =
    field.extract.type === 'attribute' ? `attribute:${field.extract.attribute}` : field.extract.type;

  const hasAdvancedConfig = field.fallback_selectors.length > 0 || field.transforms.length > 0;

  return (
    <div className="border-t border-border-subtle p-3 bg-surface-inset space-y-3" role="region" aria-label={`Editor for ${field.field_name}`}>
      {/* Selector */}
      <fieldset>
        <label
          htmlFor={`selector-${field.id}`}
          className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1"
        >
          CSS Selector
        </label>
        <input
          id={`selector-${field.id}`}
          type="text"
          value={selectorInput}
          onChange={(e) => handleSelectorChange(e.target.value)}
          className="w-full font-mono text-xs border border-border-default rounded-md px-2.5 py-1.5 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
          placeholder="e.g. .product-title"
          aria-label="CSS selector for this field"
          spellCheck={false}
          autoComplete="off"
        />
      </fieldset>

      {/* Extract type */}
      <fieldset>
        <label
          htmlFor={`extract-${field.id}`}
          className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1"
        >
          Extract
        </label>
        <select
          id={`extract-${field.id}`}
          value={EXTRACT_OPTIONS.some((o) => o.value === currentExtract) ? currentExtract : 'custom'}
          onChange={(e) => e.target.value !== 'custom' && handleExtractChange(e.target.value)}
          className="w-full text-xs border border-border-default rounded-md px-2.5 py-1.5 bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
          aria-label="Select extraction type"
        >
          {EXTRACT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {!EXTRACT_OPTIONS.some((o) => o.value === currentExtract) && (
            <option value="custom">attribute: {field.extract.attribute}</option>
          )}
        </select>
        <div className="flex gap-1 mt-1.5">
          <input
            type="text"
            value={customAttr}
            onChange={(e) => setCustomAttr(e.target.value)}
            placeholder="Custom attribute..."
            className="flex-1 text-xs border border-border-default rounded-md px-2 py-1 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-shadow"
            onKeyDown={(e) => e.key === 'Enter' && handleCustomAttribute()}
            aria-label="Custom attribute name"
          />
          <button
            onClick={handleCustomAttribute}
            disabled={!customAttr.trim()}
            className="btn-press focus-ring text-[11px] px-2.5 py-1 rounded-md bg-surface-card border border-border-default text-text-secondary hover:bg-border-default transition-colors disabled:opacity-50"
            aria-label="Set custom attribute"
          >
            Set
          </button>
        </div>
      </fieldset>

      {/* Multiple toggle */}
      <div className="flex items-center gap-2">
        <label
          htmlFor={`multiple-${field.id}`}
          className="text-[11px] font-medium text-text-muted uppercase tracking-wider"
        >
          Extract multiple
        </label>
        <button
          id={`multiple-${field.id}`}
          role="switch"
          aria-checked={field.multiple}
          aria-label={`Extract multiple elements: ${field.multiple ? 'on' : 'off'}`}
          onClick={toggleMultiple}
          className={`focus-ring w-8 h-[18px] rounded-full transition-colors relative ${
            field.multiple ? 'bg-brand-500' : 'bg-border-default'
          }`}
        >
          <span
            className={`absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${
              field.multiple ? 'left-[14px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      {/* Advanced section (collapsible) */}
      <div className="border-t border-border-subtle pt-2">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="focus-ring w-full flex items-center justify-between text-[11px] font-medium text-text-muted uppercase tracking-wider py-1"
          aria-expanded={advancedOpen}
          aria-controls={`advanced-${field.id}`}
        >
          <span>
            Advanced
            {hasAdvancedConfig && (
              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-brand-50 text-brand-600 normal-case tracking-normal font-normal">
                configured
              </span>
            )}
          </span>
          <ChevronDownIcon
            size={12}
            className={`transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div
          id={`advanced-${field.id}`}
          className="section-collapse"
          data-collapsed={!advancedOpen}
        >
          <div>
            <div className="space-y-3 pt-2">
              {/* Fallback selectors */}
              {field.fallback_selectors.length > 0 && (
                <fieldset>
                  <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1">
                    Fallbacks
                  </label>
                  <div className="space-y-1" role="list" aria-label="Fallback selectors">
                    {field.fallback_selectors.map((sel, i) => (
                      <div key={i} className="flex items-center gap-1" role="listitem">
                        <span className="text-[10px] text-text-muted w-4 text-right" aria-hidden="true">{i + 1}.</span>
                        <code className="text-xs text-text-secondary bg-surface-card border border-border-default rounded-md px-1.5 py-0.5 flex-1 truncate font-mono">
                          {sel}
                        </code>
                        <button
                          onClick={() =>
                            updateField(field.id, {
                              fallback_selectors: field.fallback_selectors.filter((_, idx) => idx !== i),
                            })
                          }
                          className="focus-ring text-[10px] text-danger-500 hover:text-danger-600 px-1"
                          aria-label={`Remove fallback selector ${i + 1}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Transforms */}
              <fieldset>
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1">
                  Transforms
                </label>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Transform options">
                  {TRANSFORM_OPTIONS.map((type) => {
                    const active = field.transforms.some((t) => t.type === type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleTransform(type)}
                        className={`btn-press focus-ring text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                          active
                            ? 'bg-brand-100 text-brand-700 border border-brand-200 shadow-xs'
                            : 'bg-surface-card text-text-muted border border-border-default hover:border-border-default hover:text-text-secondary'
                        }`}
                        aria-pressed={active}
                        aria-label={`Transform: ${type}`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
