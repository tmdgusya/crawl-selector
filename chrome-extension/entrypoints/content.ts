import { activatePicker, deactivatePicker } from '../content/picker';
import { highlightTestMatches, clearAllHighlights } from '../content/highlighter';
import { extractFieldValue, extractAllFields, createFieldErrorResult } from '../shared/extractor';
import type { BackgroundToContentMessage } from '../shared/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',

  main() {
    // Listen for messages from background service worker
    browser.runtime.onMessage.addListener((message: BackgroundToContentMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'ACTIVATE_PICKER':
          activatePicker();
          break;
        case 'DEACTIVATE_PICKER':
          deactivatePicker();
          break;
        case 'HIGHLIGHT_SELECTOR':
          highlightTestMatches(message.selector);
          break;
        case 'CLEAR_HIGHLIGHTS':
          clearAllHighlights();
          break;
        case 'EXTRACT_FIELD': {
          try {
            const result = extractFieldValue(message.field, document);
            sendResponse({ fieldId: message.field.id, result });
          } catch {
            sendResponse({
              fieldId: message.field.id,
              result: createFieldErrorResult(message.field, '추출 중 오류가 발생했습니다'),
            });
          }
          return true;
        }
        case 'EXTRACT_ALL_FIELDS': {
          try {
            const results = extractAllFields(message.fields, document);
            sendResponse({ results });
          } catch {
            sendResponse({ results: {}, error: '추출 중 오류가 발생했습니다' });
          }
          return true;
        }
      }
    });
  },
});
