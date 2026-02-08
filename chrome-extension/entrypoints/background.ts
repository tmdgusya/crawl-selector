import { getSessionState, setSessionState } from '../shared/storage';
import type { ContentMessage, SidePanelMessage, BackgroundToContentMessage } from '../shared/messages';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Disable default popup so action.onClicked fires
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  // Central message router
  browser.runtime.onMessage.addListener((message: ContentMessage | SidePanelMessage, sender, sendResponse) => {
    // Messages re-broadcast by background itself have no sender.tab and no sender.url matching sidepanel.
    // Skip them to prevent infinite loops.
    const fromContentScript = !!sender.tab;
    const fromSidePanel = !sender.tab && sender.url?.includes('sidepanel');
    if (!fromContentScript && !fromSidePanel) {
      // This is a re-broadcast from background — ignore
      return false;
    }

    handleMessage(message, sender).then(sendResponse).catch(() => sendResponse(undefined));
    return true; // keep message channel open for async response
  });

  async function handleMessage(
    message: ContentMessage | SidePanelMessage,
    _sender: chrome.runtime.MessageSender,
  ) {
    switch (message.type) {
      // ── From Side Panel ──
      case 'TOGGLE_PICKER': {
        const session = await getSessionState();
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId) return;

        if (session.pickerActive) {
          await sendToTab(tabId, { type: 'DEACTIVATE_PICKER' });
          await setSessionState({ pickerActive: false, currentTabId: null });
        } else {
          // Inject content script first, then activate picker
          await injectContentScript(tabId);
          await sendToTab(tabId, { type: 'ACTIVATE_PICKER' });
          await setSessionState({ pickerActive: true, currentTabId: tabId });
        }
        return { pickerActive: !session.pickerActive };
      }

      case 'TEST_SELECTOR': {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId) return;
        await injectContentScript(tabId);
        await sendToTab(tabId, { type: 'HIGHLIGHT_SELECTOR', selector: message.selector });
        return;
      }

      case 'CLEAR_HIGHLIGHTS': {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId) return;
        await sendToTab(tabId, { type: 'CLEAR_HIGHLIGHTS' });
        return;
      }

      case 'GET_STATE': {
        return await getSessionState();
      }

      // ── From Content Script ──
      case 'ELEMENT_PICKED': {
        // Forward to side panel by re-broadcasting via runtime messaging
        await setSessionState({ pickerActive: true });
        // Re-broadcast so the side panel's onMessage listener receives it
        browser.runtime.sendMessage({
          type: 'ELEMENT_PICKED',
          selector: message.selector,
          alternatives: message.alternatives,
          attributes: message.attributes,
        }).catch(() => {});
        return;
      }

      case 'ELEMENT_HOVERED': {
        await setSessionState({
          hoveredSelector: message.selector,
          hoveredMatchCount: message.matchCount,
        });
        return;
      }

      case 'PICKER_DEACTIVATED': {
        await setSessionState({ pickerActive: false, currentTabId: null });
        // Notify side panel that picker was deactivated (e.g. user pressed Escape)
        browser.runtime.sendMessage({ type: 'PICKER_DEACTIVATED' }).catch(() => {});
        return;
      }
    }
  }

  async function injectContentScript(tabId: number): Promise<void> {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });
    } catch {
      // Already injected or page doesn't allow injection
    }
  }

  async function sendToTab(tabId: number, message: BackgroundToContentMessage): Promise<void> {
    try {
      await browser.tabs.sendMessage(tabId, message);
    } catch {
      // Tab might not have content script
    }
  }
});
