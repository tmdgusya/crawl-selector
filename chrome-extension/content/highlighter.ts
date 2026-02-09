/**
 * Shadow DOM-based highlighter overlay.
 * All styles are isolated from the host page via Shadow DOM.
 */

let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let overlayContainer: HTMLDivElement | null = null;
let hoverDiv: HTMLDivElement | null = null;

function ensureShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  shadowHost = document.createElement('div');
  shadowHost.id = 'crawl-selector-highlighter';
  shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(shadowHost);

  shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .cs-overlay {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      transition: all 0.08s ease-out;
      border-radius: 3px;
    }
    .cs-hover {
      outline: 2px dashed #3b82f6;
      outline-offset: 1px;
      background: rgba(59, 130, 246, 0.06);
    }
    .cs-selected {
      outline: 2px solid #22c55e;
      outline-offset: 1px;
      background: rgba(34, 197, 94, 0.06);
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
    }
    .cs-test {
      outline: 2px solid #f59e0b;
      outline-offset: 1px;
      background: rgba(245, 158, 11, 0.06);
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.08);
    }
  `;
  shadowRoot.appendChild(style);

  overlayContainer = document.createElement('div');
  shadowRoot.appendChild(overlayContainer);

  return shadowRoot;
}

function createOverlayDiv(rect: DOMRect, className: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `cs-overlay ${className}`;
  div.style.cssText = `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;`;
  return div;
}

export function highlightHover(element: Element): void {
  ensureShadowRoot();
  const rect = element.getBoundingClientRect();

  if (hoverDiv) {
    // Reuse existing div — just update position
    hoverDiv.style.cssText = `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;`;
  } else {
    hoverDiv = createOverlayDiv(rect, 'cs-hover');
    hoverDiv.dataset.type = 'hover';
    overlayContainer!.appendChild(hoverDiv);
  }
}

export function clearHover(): void {
  if (hoverDiv) {
    hoverDiv.remove();
    hoverDiv = null;
  }
}

export function highlightSelected(element: Element): void {
  ensureShadowRoot();
  const rect = element.getBoundingClientRect();
  const div = createOverlayDiv(rect, 'cs-selected');
  div.dataset.type = 'selected';
  overlayContainer!.appendChild(div);

  // Auto-remove after 1.5s
  setTimeout(() => div.remove(), 1500);
}

export function highlightTestMatches(selector: string): void {
  clearTestHighlights();
  ensureShadowRoot();
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const div = createOverlayDiv(rect, 'cs-test');
      div.dataset.type = 'test';
      overlayContainer!.appendChild(div);
    });
  } catch {
    // invalid selector
  }
}

export function clearTestHighlights(): void {
  if (!overlayContainer) return;
  overlayContainer.querySelectorAll('[data-type="test"]').forEach((el) => el.remove());
}

export function clearAllHighlights(): void {
  if (!overlayContainer) return;
  overlayContainer.innerHTML = '';
  hoverDiv = null;
}

export function destroyHighlighter(): void {
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
    shadowRoot = null;
    overlayContainer = null;
    hoverDiv = null;
  }
}
