import { useState, useCallback } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { CrosshairIcon, StopIcon } from './Icons';

export function PickerButton() {
  const { pickerActive, setPickerActive } = useRecipeStore();
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_PICKER' });
      if (response && typeof response.pickerActive === 'boolean') {
        setPickerActive(response.pickerActive);
      }
    } catch (err) {
      console.error('Failed to toggle picker:', err);
    } finally {
      setLoading(false);
    }
  }, [setPickerActive]);

  return (
    <div role="status" aria-live="polite">
      <button
        onClick={toggle}
        disabled={loading}
        className={`btn-press focus-ring w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
          pickerActive
            ? 'picker-active-pulse bg-danger-50 text-danger-600 border border-danger-500/30 hover:bg-danger-100'
            : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm hover:shadow-md'
        } disabled:opacity-50`}
        aria-label={pickerActive ? 'Stop picking elements' : 'Start picking elements from the page'}
        aria-pressed={pickerActive}
      >
        {loading ? (
          <span className="animate-pulse" aria-label="Loading">...</span>
        ) : pickerActive ? (
          <>
            <StopIcon size={14} /> Stop Picking
          </>
        ) : (
          <>
            <CrosshairIcon size={14} /> Start Picking
          </>
        )}
      </button>
      {pickerActive && (
        <p className="text-center text-[11px] text-text-muted mt-1.5">
          Click elements on the page to capture selectors. Press <kbd className="px-1 py-0.5 rounded bg-surface-inset border border-border-default font-mono text-[10px]">Esc</kbd> to stop.
        </p>
      )}
    </div>
  );
}
