/**
 * Floating tooltip that shows selector preview with extracted data.
 * Rendered inside the page DOM but with inline styles to minimize conflicts.
 */

interface PreviewData {
  samples: string[];
  extractType: 'text' | 'html' | 'attribute';
}

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
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
    max-width: 450px;
    white-space: normal;
    overflow: hidden;
    display: none;
    transition: left 0.06s ease-out, top 0.06s ease-out;
    will-change: left, top;
    letter-spacing: -0.01em;
  `;
  document.documentElement.appendChild(tooltipEl);

  return tooltipEl;
}

function formatPreviewData(data: PreviewData): string {
  const { samples, extractType } = data;

  if (samples.length === 0) {
    return '<span style="color:#64748b;font-style:italic">No data</span>';
  }

  // For single match, show the data directly
  if (samples.length === 1) {
    const preview = truncate(samples[0], 60);
    const escaped = escapeHtml(preview);
    const typeIcon = extractType === 'html' ? '&lt;&gt;' : extractType === 'attribute' ? '@' : 'T';

    return `<span style="color:#64748b;margin:0 4px">|</span><span style="color:#10b981" title="${extractType}">${typeIcon}</span><span style="color:#e2e8f0;margin-left:4px">${escaped}</span>`;
  }

  // For multiple matches, show count + first 2 samples
  const previewSamples = samples.slice(0, 2).map(s => truncate(s, 25));
  const moreCount = samples.length > 2 ? samples.length - 2 : 0;

  let html = `<span style="color:#64748b;margin:0 4px">|</span><span style="color:#fbbf24">${samples.length}×</span><span style="color:#64748b;margin:0 4px">→</span>`;

  previewSamples.forEach((sample, i) => {
    html += `<span style="color:#94a3b8${i > 0 ? ';margin-left:6px' : ''}">${escapeHtml(sample)}</span>`;
  });

  if (moreCount > 0) {
    html += `<span style="color:#64748b;margin-left:6px">+${moreCount} more</span>`;
  }

  return html;
}

export function showTooltip(
  x: number,
  y: number,
  selector: string,
  matchCount: number,
  tagName: string,
  previewData?: PreviewData
): void {
  const tip = ensureTooltip();
  const matchColor = matchCount === 1 ? '#4ade80' : '#fbbf24';
  const matchText = matchCount === 1 ? '1 match' : `${matchCount} matches`;

  let html = `<span style="color:#93c5fd;font-weight:500">${tagName.toLowerCase()}</span><span style="color:#475569;margin:0 5px">/</span><span style="color:#cbd5e1">${escapeHtml(truncate(selector, 50))}</span><span style="color:#475569;margin:0 5px">/</span><span style="color:${matchColor};font-weight:500">${matchText}</span>`;

  if (previewData) {
    html += formatPreviewData(previewData);
  }

  tip.innerHTML = html;
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
