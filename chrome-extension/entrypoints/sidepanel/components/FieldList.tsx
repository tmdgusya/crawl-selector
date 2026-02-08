import { useCallback } from 'react';
import type { SelectorField } from '../../../shared/types';
import { FieldCard } from './FieldCard';
import { useRecipeStore } from '../store/useRecipeStore';
import { PlusIcon } from './Icons';

interface Props {
  fields: SelectorField[];
}

export function FieldList({ fields }: Props) {
  const { addField } = useRecipeStore();

  const handleAddManual = useCallback(async () => {
    await addField({
      field_name: 'new_field',
      selector: '',
      selector_type: 'css',
      fallback_selectors: [],
      extract: { type: 'text' },
      transforms: [{ type: 'trim' }],
      multiple: false,
    });
  }, [addField]);

  return (
    <div className="space-y-2" role="region" aria-label={`Fields (${fields.length})`}>
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Fields</h3>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-inset text-text-muted font-semibold tabular-nums"
          aria-hidden="true"
        >
          {fields.length}
        </span>
      </div>
      <div role="list" aria-label="Selector fields">
        {fields.map((field) => (
          <div role="listitem" key={field.id} className="mb-2 last:mb-0">
            <FieldCard field={field} />
          </div>
        ))}
      </div>
      <button
        onClick={handleAddManual}
        className="btn-press focus-ring w-full py-2 border border-dashed border-border-default rounded-lg text-xs text-text-muted hover:border-brand-400 hover:text-brand-600 transition-colors inline-flex items-center justify-center gap-1"
        aria-label="Add a new field manually"
      >
        <PlusIcon size={12} /> Add Field Manually
      </button>
    </div>
  );
}
