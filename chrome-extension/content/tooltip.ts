/**
 * Floating tooltip that shows selector preview near the cursor.
 * Rendered inside the page DOM but with inline styles to minimize conflicts.
 */

let tooltipEl: HTMLDivElement | null = null;

function ensureTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement('div');
  tooltipEl.id = 'crawl-selector-tooltip';
  tooltipEl.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    background: #0f172a;
    color: #e2e8f0;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: none;
    transition: left 0.06s ease-out, top 0.06s ease-out;
    will-change: left, top;
    letter-spacing: -0.01em;
  `;
  document.documentElement.appendChild(tooltipEl);

  return tooltipEl;
}

export function showTooltip(x: number, y: number, selector: string, matchCount: number, tagName: string): void {
  const tip = ensureTooltip();
  const matchColor = matchCount === 1 ? '#4ade80' : '#fbbf24';
  const matchText = matchCount === 1 ? '1 match' : `${matchCount} matches`;

  tip.innerHTML = `<span style="color:#93c5fd;font-weight:500">${tagName.toLowerCase()}</span><span style="color:#475569;margin:0 5px">/</span><span style="color:#cbd5e1">${escapeHtml(truncate(selector, 55))}</span><span style="color:#475569;margin:0 5px">/</span><span style="color:${matchColor};font-weight:500">${matchText}</span>`;
  tip.style.display = 'block';

  // Position offset from cursor, clamped to viewport
  const offsetX = 12;
  const offsetY = 20;
  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;

  let left = x + offsetX;
  let top = y + offsetY;

  if (left + tipWidth > window.innerWidth - 8) {
    left = x - tipWidth - offsetX;
  }
  if (top + tipHeight > window.innerHeight - 8) {
    top = y - tipHeight - offsetX;
  }

  tip.style.left = `${Math.max(4, left)}px`;
  tip.style.top = `${Math.max(4, top)}px`;
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
  }
}

export function destroyTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
