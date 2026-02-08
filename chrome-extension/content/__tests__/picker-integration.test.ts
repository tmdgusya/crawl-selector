import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { activatePicker, deactivatePicker, isPickerActive } from '../picker';
import { extractDataFromSelector } from '../../shared/selector-generator';

// Mock chrome.runtime
const mockSendMessage = vi.fn(() => Promise.resolve());
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
} as any;

describe('Picker with data preview', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="test-container">
        <span class="title">Hello World</span>
        <a href="https://example.com" class="link">Link</a>
      </div>
    `;
  });

  afterEach(() => {
    deactivatePicker();
    document.body.innerHTML = '';
    mockSendMessage.mockClear();
  });

  it('should include preview data in hover message', () => {
    activatePicker();

    const span = document.querySelector('.title');
    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true });
    Object.defineProperty(moveEvent, 'target', { value: span, enumerable: true });

    document.dispatchEvent(moveEvent);

    expect(mockSendMessage).toHaveBeenCalled();
    const callArgs = mockSendMessage.mock.calls[0][0];
    expect(callArgs.type).toBe('ELEMENT_HOVERED');
    expect(callArgs.previewData).toBeDefined();
    expect(callArgs.previewData.samples).toContain('Hello World');
  });

  it('should include preview data in click message', () => {
    activatePicker();

    const link = document.querySelector('.link');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: link, enumerable: true });

    document.dispatchEvent(clickEvent);

    expect(mockSendMessage).toHaveBeenCalled();
    const callArgs = mockSendMessage.mock.calls.find((call: any) => call[0]?.type === 'ELEMENT_PICKED');
    expect(callArgs[0].previewData).toBeDefined();
  });
});
