import { activatePicker, deactivatePicker } from '../content/picker';
import { highlightTestMatches, clearAllHighlights } from '../content/highlighter';
import type { BackgroundToContentMessage } from '../shared/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',

  main() {
    // Listen for messages from background service worker
    browser.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
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
      }
    });
  },
});
