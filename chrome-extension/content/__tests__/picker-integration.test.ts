import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { activatePicker, deactivatePicker, isPickerActive } from '../picker';
import { extractDataFromSelector } from '../../shared/selector-generator';

// Mock chrome.runtime
const mockSendMessage = vi.fn((..._args: unknown[]) => Promise.resolve());
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
} as any;

describe('Picker with data preview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });

  it('should include preview data in hover message', async () => {
    activatePicker();

    const span = document.querySelector('.title');
    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true });
    Object.defineProperty(moveEvent, 'target', { value: span, enumerable: true });

    document.dispatchEvent(moveEvent);

    // processHover runs inside rAF — flush it
    await vi.advanceTimersToNextTimerAsync();
    // ELEMENT_HOVERED is debounced by 100ms
    await vi.advanceTimersByTimeAsync(150);

    expect(mockSendMessage).toHaveBeenCalled();
    const callArgs = mockSendMessage.mock.calls.find(
      (call) => (call[0] as any)?.type === 'ELEMENT_HOVERED',
    );
    expect(callArgs).toBeDefined();
    expect((callArgs![0] as any).previewData).toBeDefined();
    expect((callArgs![0] as any).previewData.samples).toContain('Hello World');
  });

  it('should include preview data in click message', () => {
    activatePicker();

    const link = document.querySelector('.link');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: link, enumerable: true });

    document.dispatchEvent(clickEvent);

    expect(mockSendMessage).toHaveBeenCalled();
    const callArgs = mockSendMessage.mock.calls.find(
      (call) => (call[0] as any)?.type === 'ELEMENT_PICKED',
    );
    expect(callArgs).toBeDefined();
    expect((callArgs![0] as any).previewData).toBeDefined();
  });
});
