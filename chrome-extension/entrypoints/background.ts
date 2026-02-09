import { getSessionState, setSessionState } from '../shared/storage';
import type { ContentMessage, SidePanelMessage, BackgroundToContentMessage } from '../shared/messages';
import { extractAllFields, createFieldErrorResult } from '../shared/extractor';

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

  /** Query the active tab and validate it's not a restricted page. */
  async function getActiveTab(): Promise<{ tabId: number; tab: chrome.tabs.Tab } | { error: string }> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const tabId = tab?.id;
    if (!tabId) return { error: '활성 탭을 찾을 수 없습니다' };

    const tabUrl = tab.url ?? '';
    if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('about:') || tabUrl === '') {
      return { error: '이 페이지에서는 테스트할 수 없습니다' };
    }

    return { tabId, tab };
  }

  async function handleMessage(
    message: ContentMessage | SidePanelMessage,
    _sender: chrome.runtime.MessageSender,
  ) {
    switch (message.type) {
      // ── From Side Panel ──
      case 'TOGGLE_PICKER': {
        const session = await getSessionState();
        const result = await getActiveTab();
        if ('error' in result) return;
        const { tabId } = result;

        if (session.pickerActive) {
          await sendToTab(tabId, { type: 'DEACTIVATE_PICKER' });
          await setSessionState({ pickerActive: false, currentTabId: null });
        } else {
          await injectContentScript(tabId);
          await sendToTab(tabId, { type: 'ACTIVATE_PICKER' });
          await setSessionState({ pickerActive: true, currentTabId: tabId });
        }
        return { pickerActive: !session.pickerActive };
      }

      case 'TEST_SELECTOR': {
        const result = await getActiveTab();
        if ('error' in result) return;
        await injectContentScript(result.tabId);
        await sendToTab(result.tabId, { type: 'HIGHLIGHT_SELECTOR', selector: message.selector });
        return;
      }

      case 'CLEAR_HIGHLIGHTS': {
        const result = await getActiveTab();
        if ('error' in result) return;
        await sendToTab(result.tabId, { type: 'CLEAR_HIGHLIGHTS' });
        return;
      }

      case 'EXTRACT_FIELD': {
        const result = await getActiveTab();
        if ('error' in result) {
          return { fieldId: message.field.id, result: createFieldErrorResult(message.field, result.error) };
        }

        try {
          await injectContentScript(result.tabId);
          return await browser.tabs.sendMessage(result.tabId, {
            type: 'EXTRACT_FIELD',
            field: message.field,
          });
        } catch {
          return { fieldId: message.field.id, result: createFieldErrorResult(message.field, '콘텐츠 스크립트와 통신할 수 없습니다') };
        }
      }

      case 'EXTRACT_ALL_FIELDS': {
        const result = await getActiveTab();
        if ('error' in result) {
          return { results: {}, error: result.error };
        }

        try {
          await injectContentScript(result.tabId);
          return await browser.tabs.sendMessage(result.tabId, {
            type: 'EXTRACT_ALL_FIELDS',
            fields: message.fields,
          });
        } catch {
          return { results: {}, error: '콘텐츠 스크립트와 통신할 수 없습니다' };
        }
      }

      case 'FETCH_AND_EXTRACT': {
        const { url, fields } = message;

        // Validate URL
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          return { url, error: '유효하지 않은 URL입니다' };
        }

        if (!parsedUrl.protocol.startsWith('http')) {
          return { url, error: '유효하지 않은 URL입니다 (http/https만 지원)' };
        }

        // Fetch HTML with timeout
        let html: string;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const resp = await fetch(url, { signal: controller.signal });
          if (!resp.ok) {
            return { url, error: `HTTP 오류: ${resp.status} ${resp.statusText}` };
          }
          html = await resp.text();
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            return { url, error: '요청 시간이 초과되었습니다 (15초)' };
          }
          return { url, error: '네트워크 오류가 발생했습니다' };
        } finally {
          clearTimeout(timeoutId);
        }

        // Parse HTML and extract fields
        // DOMParser is available in Chrome 124+ service workers
        try {
          if (typeof DOMParser === 'undefined') {
            return { url, error: 'HTML 파싱이 지원되지 않습니다 (Chrome 124 이상 필요)' };
          }
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const results = extractAllFields(fields, doc);
          return { url, results };
        } catch {
          return { url, error: 'HTML 파싱에 실패했습니다' };
        }
      }

      case 'GET_STATE': {
        return await getSessionState();
      }

      // ── From Content Script ──
      case 'ELEMENT_PICKED': {
        // Forward to side panel by re-broadcasting via runtime messaging
        await setSessionState({ pickerActive: true });
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
