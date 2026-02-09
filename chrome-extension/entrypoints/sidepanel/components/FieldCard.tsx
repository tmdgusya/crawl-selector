import { useState, useCallback } from 'react';
import type { SelectorField } from '../../../shared/types';
import { useRecipeStore } from '../store/useRecipeStore';
import { FieldEditor } from './FieldEditor';
import { FieldTestResultView } from './FieldTestResultView';
import { TrashIcon, ChevronDownIcon, PlayIcon } from './Icons';

interface Props {
  field: SelectorField;
}

export function FieldCard({ field }: Props) {
  const { updateField, deleteField } = useRecipeStore();
  const testField = useRecipeStore((s) => s.testField);
  const fieldTesting = useRecipeStore((s) => s.fieldTesting);
  const testResult = useRecipeStore((s) => s.testResults[field.id]);
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(field.field_name);

  const isTestingThisField = fieldTesting === field.id;
  const isAnyFieldTesting = fieldTesting !== null;

  const handleTest = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'TEST_SELECTOR', selector: field.selector });
  }, [field.selector]);

  const handleClearHighlights = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_HIGHLIGHTS' });
  }, []);

  const handleExtractTest = useCallback(() => {
    testField(field.id);
  }, [testField, field.id]);

  const handleNameSave = useCallback(() => {
    const cleaned = nameValue.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    if (cleaned) {
      updateField(field.id, { field_name: cleaned });
      setNameValue(cleaned);
    }
    setEditingName(false);
  }, [nameValue, field.id, updateField]);

  const handleDelete = useCallback(() => {
    if (confirm('Delete this field?')) deleteField(field.id);
  }, [field.id, deleteField]);

  return (
    <div
      className="bg-surface-card rounded-lg border border-border-default overflow-hidden shadow-xs hover:shadow-sm transition-shadow duration-150"
      aria-label={`Field: ${field.field_name}`}
    >
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') {
                    setNameValue(field.field_name);
                    setEditingName(false);
                  }
                }}
                className="text-sm font-medium border border-brand-400 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-400/40 w-40"
                aria-label="Edit field name"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-text-primary hover:text-brand-600 transition-colors truncate focus-ring"
                aria-label={`Rename field "${field.field_name}" (click to edit)`}
                title="Click to rename"
              >
                {field.field_name}
              </button>
            )}
            {field.multiple && (
              <span
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 font-semibold tracking-wide"
                aria-label="Extracts multiple elements"
              >
                LIST
              </span>
            )}
          </div>

          {/* Extract type badge */}
          <span
            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-surface-inset text-text-muted font-mono"
            aria-label={`Extract type: ${field.extract.type === 'attribute' ? field.extract.attribute : field.extract.type}`}
          >
            {field.extract.type === 'attribute' ? `@${field.extract.attribute}` : field.extract.type}
          </span>
        </div>

        <div className="mt-1.5 font-mono text-xs text-text-muted truncate" title={field.selector}>
          {field.selector || <span className="italic text-border-default">no selector</span>}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`btn-press focus-ring inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
              expanded
                ? 'bg-brand-50 text-brand-700'
                : 'bg-surface-inset text-text-secondary hover:bg-border-default'
            }`}
            aria-expanded={expanded}
            aria-label={expanded ? 'Close field editor' : 'Edit field settings'}
          >
            {expanded ? 'Close' : 'Edit'}
            <ChevronDownIcon
              size={12}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            onClick={handleTest}
            onMouseLeave={handleClearHighlights}
            className="btn-press focus-ring text-[11px] px-2 py-0.5 rounded-md bg-warning-50 text-warning-700 hover:bg-warning-100 transition-colors"
            aria-label={`Test selector "${field.selector}" on page`}
          >
            Test
          </button>
          <button
            onClick={handleExtractTest}
            disabled={isAnyFieldTesting}
            className="btn-press focus-ring inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-md bg-success-50 text-success-700 hover:bg-success-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`추출 테스트 "${field.field_name}"`}
            title="추출 테스트"
          >
            <PlayIcon size={10} />
            추출
          </button>
          <button
            onClick={handleDelete}
            className="btn-press focus-ring p-0.5 rounded-md text-danger-500 hover:bg-danger-50 transition-colors ml-auto"
            aria-label={`Delete field "${field.field_name}"`}
            title="Delete field"
          >
            <TrashIcon size={13} />
          </button>
        </div>
      </div>

      {/* Extraction test result */}
      {(isTestingThisField || testResult) && (
        <div className="px-3 pb-3">
          <FieldTestResultView
            result={testResult}
            loading={isTestingThisField}
          />
        </div>
      )}

      {/* Expanded editor with animation */}
      {expanded && (
        <div className="field-editor-enter">
          <div>
            <FieldEditor field={field} />
          </div>
        </div>
      )}
    </div>
  );
}
