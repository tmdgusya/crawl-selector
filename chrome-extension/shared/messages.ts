// ── Message protocol between content script, background, and side panel ──

// Content Script → Background
export type ContentMessage =
  | { type: 'ELEMENT_HOVERED'; selector: string; matchCount: number; tagName: string }
  | { type: 'ELEMENT_PICKED'; selector: string; alternatives: string[]; attributes: Record<string, string> }
  | { type: 'PICKER_DEACTIVATED' };

// Background → Content Script
export type BackgroundToContentMessage =
  | { type: 'ACTIVATE_PICKER' }
  | { type: 'DEACTIVATE_PICKER' }
  | { type: 'HIGHLIGHT_SELECTOR'; selector: string }
  | { type: 'CLEAR_HIGHLIGHTS' };

// Side Panel → Background
export type SidePanelMessage =
  | { type: 'TOGGLE_PICKER' }
  | { type: 'TEST_SELECTOR'; selector: string }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'GET_STATE' };

// Background → Side Panel (via storage change events primarily, but also direct responses)
export type BackgroundToSidePanelMessage =
  | { type: 'PICKER_STATE_CHANGED'; active: boolean }
  | { type: 'ELEMENT_PICKED'; selector: string; alternatives: string[]; attributes: Record<string, string> };

// Union of all messages for the background router
export type ExtensionMessage = ContentMessage | SidePanelMessage | BackgroundToContentMessage;
