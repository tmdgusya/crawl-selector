import { useEffect, useCallback } from 'react';
import { useRecipeStore } from './store/useRecipeStore';
import { RecipeManager } from './components/RecipeManager';
import { PickerButton } from './components/PickerButton';
import { FieldList } from './components/FieldList';
import { ExportPanel } from './components/ExportPanel';
import { CrosshairIcon } from './components/Icons';
import { DuplicateToast } from './components/DuplicateToast';
import { FullTestPanel } from './components/FullTestPanel';
import type { ContentMessage, BackgroundToSidePanelMessage } from '../../shared/messages';

type IncomingMessage = BackgroundToSidePanelMessage | ContentMessage;

export default function App() {
  const { loadFromStorage, addFieldFromPicker, setPickerActive, getActiveRecipe, activeRecipeId } =
    useRecipeStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleMessage = useCallback((message: IncomingMessage) => {
    switch (message.type) {
      case 'ELEMENT_PICKED':
        addFieldFromPicker(message.selector, message.alternatives, message.attributes);
        break;
      case 'PICKER_DEACTIVATED':
        setPickerActive(false);
        break;
      case 'PICKER_STATE_CHANGED':
        setPickerActive(message.active);
        break;
    }
  }, [addFieldFromPicker, setPickerActive]);

  // Listen for messages from background (element picked events)
  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleMessage]);

  const recipe = getActiveRecipe();

  return (
    <div className="min-h-screen bg-surface-base text-text-primary text-sm" role="application" aria-label="Crawl Selector">
      {/* Header */}
      <header className="bg-surface-card border-b border-border-default px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <CrosshairIcon className="text-brand-500" size={18} />
          <h1 className="text-base font-semibold text-text-primary tracking-tight">Crawl Selector</h1>
        </div>
      </header>

      <main className="p-3 space-y-3" aria-live="polite">
        {/* Recipe selector */}
        <RecipeManager />

        {/* Picker toggle */}
        {activeRecipeId && <PickerButton />}

        {/* Field list */}
        {recipe && recipe.fields.length > 0 && <FieldList fields={recipe.fields} />}

        {/* Empty state */}
        {recipe && recipe.fields.length === 0 && (
          <div className="text-center py-10 text-text-muted" role="status">
            <CrosshairIcon className="mx-auto mb-3 text-border-default" size={32} />
            <p className="font-medium text-text-secondary">No fields yet</p>
            <p className="text-xs mt-1">Click "Start Picking" to select elements from the page.</p>
          </div>
        )}

        {/* Full test panel */}
        {recipe && recipe.fields.length > 0 && <FullTestPanel />}

        {/* Export */}
        {recipe && recipe.fields.length > 0 && <ExportPanel />}
      </main>

      <DuplicateToast />
    </div>
  );
}
